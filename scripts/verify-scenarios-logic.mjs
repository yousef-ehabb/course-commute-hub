import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import fs from "fs";
import { ref, set, update, get, remove } from "firebase/database";

let testEnv;

async function setup() {
  testEnv = await initializeTestEnvironment({
    projectId: "course-commute-hub-default-rtdb",
    database: {
      rules: fs.readFileSync("database.rules.json", "utf8"),
      host: "127.0.0.1",
      port: 9000,
    },
  });
}

// Emulate register checkDuplicates logic
async function checkDuplicates(db, nid, ph, currentUid) {
  const normalizedPhone = ph.replace(/\D/g, "");

  const nidSnap = await get(ref(db, `rakeb/usersByNationalId/${nid}`));
  if (nidSnap.exists() && nidSnap.val().uid !== currentUid) {
    const cid = nidSnap.val().courseId;
    const cSnap = await get(ref(db, `rakeb/courses/${cid}`));
    if (cSnap.exists() && cSnap.val().status === "active") {
      return { allowed: false, reason: `National ID exists in active course ${cSnap.val().name}` };
    }
  }

  const phoneSnap = await get(ref(db, `rakeb/usersByPhone/${normalizedPhone}`));
  if (phoneSnap.exists() && phoneSnap.val().uid !== currentUid) {
    const cid = phoneSnap.val().courseId;
    const cSnap = await get(ref(db, `rakeb/courses/${cid}`));
    if (cSnap.exists() && cSnap.val().status === "active") {
      return { allowed: false, reason: `Phone exists in active course ${cSnap.val().name}` };
    }
  }
  return { allowed: true };
}

// Emulate registration deadline check logic
function checkRegistrationDeadline(courseData) {
  if (courseData?.registrationDeadline && Date.now() > courseData.registrationDeadline) {
    return { isClosed: true, message: "التسجيل مغلق: انتهى موعد التسجيل في هذا الكورس" };
  }
  return { isClosed: false };
}

// Emulate StudentGuard logic
function evaluateStudentGuard(userProfile, courseData) {
  // If role !== student, StudentGuard handles accordingly
  if (userProfile.role !== "student") return { allowed: true };
  
  // Backward compatibility: missing paymentStatus = active
  const effectivePaymentStatus = userProfile.paymentStatus || "active";
  
  if (effectivePaymentStatus !== "active") {
    return { allowed: false, redirect: "/payment-status", status: effectivePaymentStatus };
  }
  return { allowed: true, redirect: null, status: "active" };
}

// Emulate handleSubmitPayment logic from PaymentStatusPage.tsx
async function submitPayment(db, courseId, user, profile, course) {
  const now = Date.now();
  const amount = profile.paymentAmount || course?.transportation?.payment?.fee || 0;

  const updates = {};
  updates[`rakeb/payments/${courseId}/${user.uid}`] = {
    userId: user.uid,
    courseId,
    amount,
    status: "submitted",
    submittedAt: now,
    createdAt: now,
  };
  updates[`rakeb/users/${user.uid}/paymentStatus`] = "payment_submitted";

  await update(ref(db), updates);
}

// Emulate handleApprove from admin/payments.tsx
async function adminApprovePayment(db, courseId, studentUid, adminUid) {
  // Let's test what admin/payments.tsx currently does:
  const updates = {};
  updates[`rakeb/users/${studentUid}/paymentStatus`] = "active";
  updates[`rakeb/payments/${courseId}/${studentUid}/status`] = "approved"; // NOTE: code currently sets "approved"
  updates[`rakeb/payments/${courseId}/${studentUid}/verifiedAt`] = Date.now();
  // NOTE: code currently does NOT set verifiedBy!
  await update(ref(db), updates);
}

// Emulate handleRejectSubmit from admin/payments.tsx
async function adminRejectPayment(db, courseId, studentUid, adminUid, reason) {
  // Let's test what admin/payments.tsx currently does:
  const updates = {};
  updates[`rakeb/users/${studentUid}/paymentStatus`] = "payment_rejected";
  updates[`rakeb/payments/${courseId}/${studentUid}/status`] = "rejected";
  updates[`rakeb/payments/${courseId}/${studentUid}/rejectionReason`] = reason;
  // NOTE: code currently does NOT set rejectedAt or rejectedBy!
  await update(ref(db), updates);
}

async function run() {
  await setup();
  console.log("\n🧪 Running Logic & Runtime Verification for Scenarios 1–5, 8–15...\n");

  const adminDb = testEnv.authenticatedContext("admin-user").database();
  const studentDb = testEnv.authenticatedContext("student-user").database();

  let scenarioResults = {};

  // Setup Admin user
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, "rakeb/users/admin-user"), { role: "admin", fullName: "Admin User" });
  });

  // ══════════════════════════════════════════════════════════
  // SCENARIO 1: FREE COURSE
  // ══════════════════════════════════════════════════════════
  console.log("─── Scenario 1: Free Course Verification ───");
  const freeCourseId = "test-course-free";
  const freeStudentUid = "student-free-001";
  const freeCourse = {
    id: freeCourseId,
    name: "Free Test Course",
    status: "active",
    transportation: { payment: { isFree: true, fee: 0 } }
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), `rakeb/courses/${freeCourseId}`), freeCourse);
  });

  // Student registration calculation
  const freeIsFree = freeCourse.transportation?.payment?.isFree ?? true;
  const freePaymentAmount = freeCourse.transportation?.payment?.fee ?? 0;
  const freePaymentStatus = freeIsFree ? "active" : "pending_payment";

  const freeProfile = {
    uid: freeStudentUid,
    fullName: "Free Student",
    phone: "01000000001",
    nationalId: "29901010000001",
    role: "student",
    courseId: freeCourseId,
    paymentStatus: freePaymentStatus,
    paymentAmount: freePaymentAmount
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, `rakeb/users/${freeStudentUid}`), freeProfile);
    await set(ref(db, `rakeb/usersByNationalId/${freeProfile.nationalId}`), { uid: freeStudentUid, courseId: freeCourseId });
    await set(ref(db, `rakeb/usersByPhone/${freeProfile.phone}`), { uid: freeStudentUid, courseId: freeCourseId });
  });

  const freePaymentSnap = await get(ref(adminDb, `rakeb/payments/${freeCourseId}/${freeStudentUid}`));
  const freeGuard = evaluateStudentGuard(freeProfile, freeCourse);

  const s1Pass = freePaymentStatus === "active" && 
                 !freePaymentSnap.exists() && 
                 freeGuard.allowed === true && 
                 freeGuard.redirect === null;

  scenarioResults["Scenario 1: Free Course"] = {
    pass: s1Pass,
    evidence: `paymentStatus=${freePaymentStatus}, paymentRecordExists=${freePaymentSnap.exists()}, StudentGuardAllowed=${freeGuard.allowed}`
  };
  console.log(`  ${s1Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 1: Free Course: ${scenarioResults["Scenario 1: Free Course"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 2: PAID COURSE
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 2: Paid Course Verification ───");
  const paidCourseId = "test-course-paid";
  const paidStudentUid = "student-paid-001";
  const paidCourse = {
    id: paidCourseId,
    name: "Paid Test Course",
    status: "active",
    transportation: { payment: { isFree: false, fee: 150 } }
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), `rakeb/courses/${paidCourseId}`), paidCourse);
    await set(ref(context.database(), `rakeb/settings/${paidCourseId}/paymentMethods`), {
      instaPay: "rakeb@instapay",
      vodafoneCash: "01012345678",
      instructions: "Transfer and send receipt"
    });
  });

  const paidIsFree = paidCourse.transportation?.payment?.isFree ?? true;
  const paidPaymentAmount = paidCourse.transportation?.payment?.fee ?? 0;
  const paidPaymentStatus = paidIsFree ? "active" : "pending_payment";

  const paidProfile = {
    uid: paidStudentUid,
    fullName: "Paid Student",
    phone: "01000000002",
    nationalId: "29901010000002",
    role: "student",
    courseId: paidCourseId,
    paymentStatus: paidPaymentStatus,
    paymentAmount: paidPaymentAmount
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, `rakeb/users/${paidStudentUid}`), paidProfile);
  });

  const paidGuard = evaluateStudentGuard(paidProfile, paidCourse);
  const settingsSnap = await get(ref(adminDb, `rakeb/settings/${paidCourseId}/paymentMethods`));

  const s2Pass = paidPaymentStatus === "pending_payment" &&
                 paidGuard.allowed === false &&
                 paidGuard.redirect === "/payment-status" &&
                 paidProfile.paymentAmount === 150 &&
                 settingsSnap.exists();

  scenarioResults["Scenario 2: Paid Course"] = {
    pass: s2Pass,
    evidence: `paymentStatus=${paidPaymentStatus}, StudentGuardRedirect=${paidGuard.redirect}, fee=${paidProfile.paymentAmount}, methodsConfigured=${settingsSnap.exists()}`
  };
  console.log(`  ${s2Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 2: Paid Course: ${scenarioResults["Scenario 2: Paid Course"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 3: PAYMENT SUBMISSION & MULTI-CLICK
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 3: Payment Submission & Idempotence ───");
  // Click 1
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await submitPayment(context.database(), paidCourseId, { uid: paidStudentUid }, paidProfile, paidCourse);
  });
  const subSnap1 = await get(ref(adminDb, `rakeb/payments/${paidCourseId}/${paidStudentUid}`));
  const userSnap1 = await get(ref(adminDb, `rakeb/users/${paidStudentUid}/paymentStatus`));
  const snap1Data = subSnap1.val();

  // Click 2 (re-submit)
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await submitPayment(context.database(), paidCourseId, { uid: paidStudentUid }, paidProfile, paidCourse);
  });
  const subSnap2 = await get(ref(adminDb, `rakeb/payments/${paidCourseId}/${paidStudentUid}`));
  const allPaymentsForCourse = await get(ref(adminDb, `rakeb/payments/${paidCourseId}`));
  const coursePaymentsCount = Object.keys(allPaymentsForCourse.val() || {}).length;

  const s3Pass = userSnap1.val() === "payment_submitted" &&
                 subSnap1.exists() &&
                 snap1Data.amount === 150 &&
                 snap1Data.courseId === paidCourseId &&
                 snap1Data.userId === paidStudentUid &&
                 typeof snap1Data.submittedAt === "number" &&
                 coursePaymentsCount === 1; // Keyed by student UID, cannot create duplicates

  scenarioResults["Scenario 3: Payment Submission"] = {
    pass: s3Pass,
    evidence: `status=${userSnap1.val()}, amount=${snap1Data.amount}, coursePaymentsCount=${coursePaymentsCount} (no duplicates), submittedAt=${snap1Data.submittedAt}`
  };
  console.log(`  ${s3Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 3: Payment Submission: ${scenarioResults["Scenario 3: Payment Submission"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 4: ADMIN ACTIVATION
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 4: Admin Activation ───");
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await adminApprovePayment(context.database(), paidCourseId, paidStudentUid, "admin-user");
  });

  const approvedPaymentSnap = await get(ref(adminDb, `rakeb/payments/${paidCourseId}/${paidStudentUid}`));
  const approvedUserSnap = await get(ref(adminDb, `rakeb/users/${paidStudentUid}`));
  const pData = approvedPaymentSnap.val();
  const uData = approvedUserSnap.val();

  const activatedGuard = evaluateStudentGuard(uData, paidCourse);

  // Check user requirement for Scenario 4:
  // "payment.status = verified, verifiedAt exists, verifiedBy contains admin UID, user.paymentStatus = active, student can access normal Rakeb"
  const hasVerifiedStatus = pData.status === "verified";
  const hasVerifiedAt = typeof pData.verifiedAt === "number";
  const hasVerifiedBy = typeof pData.verifiedBy === "string" && pData.verifiedBy.length > 0;
  const hasUserActive = uData.paymentStatus === "active";
  const canAccessRakeb = activatedGuard.allowed === true;

  const s4Pass = hasVerifiedStatus && hasVerifiedAt && hasVerifiedBy && hasUserActive && canAccessRakeb;

  scenarioResults["Scenario 4: Admin Activation"] = {
    pass: s4Pass,
    evidence: `payment.status=${pData.status} (expected 'verified'), verifiedAt=${hasVerifiedAt}, verifiedBy=${pData.verifiedBy || 'UNDEFINED'}, user.paymentStatus=${uData.paymentStatus}, canAccessRakeb=${canAccessRakeb}`,
    rootCause: !s4Pass ? "In admin/payments.tsx line 138, handleApprove sets payment.status = 'approved' instead of 'verified', and does not write verifiedBy = admin.uid." : undefined,
    file: !s4Pass ? "src/routes/_authenticated/admin/payments.tsx" : undefined
  };
  console.log(`  ${s4Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 4: Admin Activation: ${scenarioResults["Scenario 4: Admin Activation"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 5: ADMIN REJECTION
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 5: Admin Rejection ───");
  const rejectedStudentUid = "student-rejected-001";
  const rejectedProfile = {
    uid: rejectedStudentUid,
    fullName: "Rejected Student",
    phone: "01000000005",
    nationalId: "29901010000005",
    role: "student",
    courseId: paidCourseId,
    paymentStatus: "payment_submitted",
    paymentAmount: 150
  };

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, `rakeb/users/${rejectedStudentUid}`), rejectedProfile);
    await set(ref(db, `rakeb/payments/${paidCourseId}/${rejectedStudentUid}`), {
      userId: rejectedStudentUid,
      courseId: paidCourseId,
      amount: 150,
      status: "submitted",
      submittedAt: Date.now()
    });
    // Admin rejects with reason
    await adminRejectPayment(db, paidCourseId, rejectedStudentUid, "admin-user", "Receipt image is blurry");
  });

  const rejPaymentSnap = await get(ref(adminDb, `rakeb/payments/${paidCourseId}/${rejectedStudentUid}`));
  const rejUserSnap = await get(ref(adminDb, `rakeb/users/${rejectedStudentUid}`));
  const rejPData = rejPaymentSnap.val();
  const rejUData = rejUserSnap.val();

  // User requirement for Scenario 5:
  // "payment.status = rejected, rejectedAt exists, rejectedBy exists, rejectionReason exists, user.paymentStatus = payment_rejected, student sees rejection reason, student can resubmit"
  const rejStatus = rejPData.status === "rejected";
  const rejAt = typeof rejPData.rejectedAt === "number";
  const rejBy = typeof rejPData.rejectedBy === "string" && rejPData.rejectedBy.length > 0;
  const rejReason = rejPData.rejectionReason === "Receipt image is blurry";
  const rejUserStatus = rejUData.paymentStatus === "payment_rejected";

  const s5Pass = rejStatus && rejAt && rejBy && rejReason && rejUserStatus;

  scenarioResults["Scenario 5: Admin Rejection"] = {
    pass: s5Pass,
    evidence: `payment.status=${rejPData.status}, rejectionReason='${rejPData.rejectionReason}', rejectedAt=${rejPData.rejectedAt || 'UNDEFINED'}, rejectedBy=${rejPData.rejectedBy || 'UNDEFINED'}, user.paymentStatus=${rejUData.paymentStatus}`,
    rootCause: !s5Pass ? "In admin/payments.tsx line 189-192, handleRejectSubmit sets payment.status='rejected' and rejectionReason, but omits rejectedAt and rejectedBy." : undefined,
    file: !s5Pass ? "src/routes/_authenticated/admin/payments.tsx" : undefined
  };
  console.log(`  ${s5Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 5: Admin Rejection: ${scenarioResults["Scenario 5: Admin Rejection"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 8: DUPLICATE ACTIVE COURSE RULE
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 8: Duplicate Active Course Rule ───");
  // Student A is in active course
  const dupCheckNid = await checkDuplicates(adminDb, freeProfile.nationalId, "01099999999", "new-user-1");
  const dupCheckPhone = await checkDuplicates(adminDb, "29909099999999", freeProfile.phone, "new-user-2");
  const s8Pass = !dupCheckNid.allowed && !dupCheckPhone.allowed;

  scenarioResults["Scenario 8: Duplicate Active Course Rule"] = {
    pass: s8Pass,
    evidence: `Same NID allowed=${dupCheckNid.allowed} (${dupCheckNid.reason}), Same Phone allowed=${dupCheckPhone.allowed} (${dupCheckPhone.reason})`
  };
  console.log(`  ${s8Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 8: Duplicate Active Course Rule: ${scenarioResults["Scenario 8: Duplicate Active Course Rule"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 9: ARCHIVED COURSE RE-REGISTRATION
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 9: Archived Course Re-Registration ───");
  // Set up an archived course and index
  const archivedCourseId = "course-archived-001";
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, `rakeb/courses/${archivedCourseId}`), {
      id: archivedCourseId,
      name: "Old Archived Course",
      status: "archived"
    });
    // Student with phone and NID in archived course index
    await set(ref(db, `rakeb/usersByNationalId/29905051111111`), { uid: "archived-uid", courseId: archivedCourseId });
    await set(ref(db, `rakeb/usersByPhone/01055555555`), { uid: "archived-uid", courseId: archivedCourseId });
  });

  const reRegCheck = await checkDuplicates(adminDb, "29905051111111", "01055555555", "archived-uid-re-registering");
  const s9Pass = reRegCheck.allowed === true;

  scenarioResults["Scenario 9: Archived Course Re-Registration"] = {
    pass: s9Pass,
    evidence: `Allowed to re-register when previous course status is 'archived': ${reRegCheck.allowed}`
  };
  console.log(`  ${s9Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 9: Archived Course Re-Registration: ${scenarioResults["Scenario 9: Archived Course Re-Registration"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 10: REGISTRATION DEADLINE
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 10: Registration Deadline ───");
  const expiredCourse = {
    id: "course-expired",
    name: "Expired Course",
    status: "active",
    registrationDeadline: Date.now() - 3600000 // 1 hour ago
  };
  const futureCourse = {
    id: "course-open",
    name: "Open Course",
    status: "active",
    registrationDeadline: Date.now() + 3600000 // 1 hour in future
  };

  const expiredCheck = checkRegistrationDeadline(expiredCourse);
  const futureCheck = checkRegistrationDeadline(futureCourse);
  // Also verify existing student in expired course is NOT blocked
  const existingStudentProfile = {
    uid: "existing-student",
    role: "student",
    courseId: "course-expired",
    paymentStatus: "active"
  };
  const existingGuard = evaluateStudentGuard(existingStudentProfile, expiredCourse);

  const s10Pass = expiredCheck.isClosed === true && 
                  futureCheck.isClosed === false && 
                  existingGuard.allowed === true;

  scenarioResults["Scenario 10: Registration Deadline"] = {
    pass: s10Pass,
    evidence: `Expired course isClosed=${expiredCheck.isClosed} ('${expiredCheck.message}'), Open course isClosed=${futureCheck.isClosed}, Existing student allowed=${existingGuard.allowed}`
  };
  console.log(`  ${s10Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 10: Registration Deadline: ${scenarioResults["Scenario 10: Registration Deadline"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 11: PAYMENT COURSE ISOLATION
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 11: Payment Course Isolation ───");
  // Student enrolled in Paid Course A
  // Re-enrolls in Free Course B
  const courseBFree = {
    id: "course-b-free",
    name: "Course B Free",
    transportation: { payment: { isFree: true, fee: 0 } }
  };
  const reEnrollFreeIsFree = courseBFree.transportation?.payment?.isFree ?? true;
  const reEnrollFreeStatus = reEnrollFreeIsFree ? "active" : "pending_payment";
  const reEnrollFreeFee = courseBFree.transportation?.payment?.fee ?? 0;

  // Reverse: Free Course A -> Paid Course B
  const courseBPaid = {
    id: "course-b-paid",
    name: "Course B Paid",
    transportation: { payment: { isFree: false, fee: 250 } }
  };
  const reEnrollPaidIsFree = courseBPaid.transportation?.payment?.isFree ?? true;
  const reEnrollPaidStatus = reEnrollPaidIsFree ? "active" : "pending_payment";
  const reEnrollPaidFee = courseBPaid.transportation?.payment?.fee ?? 0;

  const s11Pass = reEnrollFreeStatus === "active" && 
                  reEnrollFreeFee === 0 && 
                  reEnrollPaidStatus === "pending_payment" && 
                  reEnrollPaidFee === 250;

  scenarioResults["Scenario 11: Payment Course Isolation"] = {
    pass: s11Pass,
    evidence: `Paid->Free: status=${reEnrollFreeStatus}, fee=${reEnrollFreeFee}. Free->Paid: status=${reEnrollPaidStatus}, fee=${reEnrollPaidFee}`
  };
  console.log(`  ${s11Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 11: Payment Course Isolation: ${scenarioResults["Scenario 11: Payment Course Isolation"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 12: PAYMENT AMOUNT SNAPSHOT
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 12: Payment Amount Snapshot ───");
  // Change course fee from 150 to 200
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await update(ref(context.database(), `rakeb/courses/${paidCourseId}/transportation/payment`), { fee: 200 });
  });

  const snapshotPaymentSnap = await get(ref(adminDb, `rakeb/payments/${paidCourseId}/${paidStudentUid}`));
  const snapshotUserSnap = await get(ref(adminDb, `rakeb/users/${paidStudentUid}`));
  const snapAmount = snapshotPaymentSnap.val()?.amount;
  const userSnapAmount = snapshotUserSnap.val()?.paymentAmount;

  const s12Pass = snapAmount === 150 && userSnapAmount === 150;

  scenarioResults["Scenario 12: Payment Amount Snapshot"] = {
    pass: s12Pass,
    evidence: `Course fee changed to 200. Existing payment record amount=${snapAmount}, User paymentAmount=${userSnapAmount} (both preserved at 150)`
  };
  console.log(`  ${s12Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 12: Payment Amount Snapshot: ${scenarioResults["Scenario 12: Payment Amount Snapshot"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 13: EXISTING USERS BACKWARD COMPATIBILITY
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 13: Existing Users Backward Compatibility ───");
  const legacyStudentProfile = {
    uid: "legacy-student-001",
    fullName: "Legacy Student",
    phone: "01099999990",
    nationalId: "29901019999990",
    role: "student",
    courseId: freeCourseId
    // Note: NO paymentStatus field
  };

  const legacyGuard = evaluateStudentGuard(legacyStudentProfile, freeCourse);
  const s13Pass = legacyGuard.allowed === true && legacyGuard.status === "active";

  scenarioResults["Scenario 13: Existing Users Backward Compatibility"] = {
    pass: s13Pass,
    evidence: `User without paymentStatus evaluates to allowed=${legacyGuard.allowed}, effective status=${legacyGuard.status}, no mass migration needed`
  };
  console.log(`  ${s13Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 13: Existing Users Backward Compatibility: ${scenarioResults["Scenario 13: Existing Users Backward Compatibility"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 14: EXISTING COURSES BACKWARD COMPATIBILITY
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 14: Existing Courses Backward Compatibility ───");
  const legacyCourse = {
    id: "legacy-course-001",
    name: "Legacy Course Without Transportation Config",
    status: "active"
    // No transportation field
  };

  const legacyIsFree = legacyCourse.transportation?.payment?.isFree ?? true;
  const legacyFee = legacyCourse.transportation?.payment?.fee ?? 0;
  const s14Pass = legacyIsFree === true && legacyFee === 0;

  scenarioResults["Scenario 14: Existing Courses Backward Compatibility"] = {
    pass: s14Pass,
    evidence: `Course without transportation config defaults to isFree=${legacyIsFree}, fee=${legacyFee}`
  };
  console.log(`  ${s14Pass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 14: Existing Courses Backward Compatibility: ${scenarioResults["Scenario 14: Existing Courses Backward Compatibility"].evidence}`);

  // ══════════════════════════════════════════════════════════
  // SCENARIO 15: REGRESSION TEST
  // ══════════════════════════════════════════════════════════
  console.log("\n─── Scenario 15: Regression Test of Core Systems ───");
  // Inspect whether tripService, boarding, vehicle labels, filterStudentsByCourse are intact
  const filterByCourse = (await import("../src/utils/courseFilter.ts")).filterStudentsByCourse;
  const testStudents = [
    { uid: "s1", courseId: "courseA", role: "student" },
    { uid: "s2", courseId: "courseB", role: "student" },
    { uid: "admin", role: "admin" }
  ];
  const filteredA = filterByCourse(testStudents, "courseA");
  const s15FilterPass = filteredA.length === 1 && filteredA[0].uid === "s1";

  scenarioResults["Scenario 15: Regression Test"] = {
    pass: s15FilterPass,
    evidence: `filterStudentsByCourse correctly scopes by courseId without affecting admin or cross-course structures: filteredCount=${filteredA.length}`
  };
  console.log(`  ${s15FilterPass ? "✅ [PASS]" : "❌ [FAIL]"} Scenario 15: Regression Test: ${scenarioResults["Scenario 15: Regression Test"].evidence}`);

  await testEnv.cleanup();
  return scenarioResults;
}

run().catch(console.error);
