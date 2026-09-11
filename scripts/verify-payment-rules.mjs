import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import fs from "fs";
import { ref, set, update, get } from "firebase/database";

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

async function run() {
  await setup();
  console.log("\n🧪 Running Firebase Security Rules Tests for Payment & Identity Indexes...\n");

  const adminUid = "admin-verifier";
  const studentAUid = "student-auth-A";
  const studentBUid = "student-auth-B";
  const coursePaid = "course-paid-101";
  const courseFree = "course-free-101";

  const adminDb = testEnv.authenticatedContext(adminUid).database();
  const studentADb = testEnv.authenticatedContext(studentAUid).database();
  const studentBDb = testEnv.authenticatedContext(studentBUid).database();
  const unauthedDb = testEnv.unauthenticatedContext().database();

  // Seed baseline data
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, `rakeb/users/${adminUid}`), { role: "admin", fullName: "Admin Verifier" });
    
    // Seed courses
    await set(ref(db, `rakeb/courses/${coursePaid}`), {
      id: coursePaid,
      name: "Paid Course",
      status: "active",
      transportation: { payment: { isFree: false, fee: 150 } }
    });
    await set(ref(db, `rakeb/courses/${courseFree}`), {
      id: courseFree,
      name: "Free Course",
      status: "active",
      transportation: { payment: { isFree: true, fee: 0 } }
    });

    // Seed student A (paid course, pending_payment)
    await set(ref(db, `rakeb/users/${studentAUid}`), {
      uid: studentAUid,
      fullName: "Student Alpha",
      phone: "01011111111",
      nationalId: "29901011234567",
      role: "student",
      courseId: coursePaid,
      paymentStatus: "pending_payment",
      paymentAmount: 150
    });

    // Seed student A identity index
    await set(ref(db, `rakeb/usersByNationalId/29901011234567`), { uid: studentAUid, courseId: coursePaid });
    await set(ref(db, `rakeb/usersByPhone/01011111111`), { uid: studentAUid, courseId: coursePaid });
  });

  let results = [];

  async function check(name, promise, shouldFail, details = "") {
    try {
      if (shouldFail) {
        await assertFails(promise);
      } else {
        await assertSucceeds(promise);
      }
      console.log(`  ✅ [PASS] ${name}`);
      results.push({ name, passed: true, details });
    } catch (err) {
      console.log(`  ❌ [FAIL] ${name}`);
      console.log(`     Error: ${err.message}`);
      results.push({ name, passed: false, error: err.message, details });
    }
  }

  console.log("─── Scenario 6: Security Tests — Payment Status & Record Tampering ───");

  // 6.1 Student A attempts to directly modify rakeb/users/{studentUid}/paymentStatus = "active"
  await check(
    "Student A CANNOT set own paymentStatus = 'active' directly",
    update(ref(studentADb, `rakeb/users/${studentAUid}`), { paymentStatus: "active" }),
    true,
    "Rule validation on users/$uid/paymentStatus"
  );

  // 6.2 Student A can submit payment: paymentStatus = 'payment_submitted'
  await check(
    "Student A CAN set own paymentStatus = 'payment_submitted' from 'pending_payment'",
    update(ref(studentADb, `rakeb/users/${studentAUid}`), { paymentStatus: "payment_submitted" }),
    false,
    "Student transition to payment_submitted"
  );

  // 6.3 Student A attempts to set payment.status = 'verified'
  await check(
    "Student A CANNOT set payment record status = 'verified'",
    set(ref(studentADb, `rakeb/payments/${coursePaid}/${studentAUid}`), {
      status: "verified",
      amount: 150,
      submittedAt: Date.now()
    }),
    true,
    "Rule on payments/$courseId/$uid only allows status === 'submitted' for students"
  );

  // 6.4 Student A attempts to set payment.verifiedBy = studentAUid
  await check(
    "Student A CANNOT write verifiedBy in payment record",
    set(ref(studentADb, `rakeb/payments/${coursePaid}/${studentAUid}`), {
      status: "submitted",
      verifiedBy: studentAUid,
      amount: 150,
      submittedAt: Date.now()
    }),
    true,
    "VerifiedBy should be rejected or protected"
  );

  // 6.5 Student A attempts to set payment.verifiedAt
  await check(
    "Student A CANNOT write verifiedAt in payment record",
    set(ref(studentADb, `rakeb/payments/${coursePaid}/${studentAUid}`), {
      status: "submitted",
      verifiedAt: Date.now(),
      amount: 150,
      submittedAt: Date.now()
    }),
    true,
    "VerifiedAt should be rejected or protected"
  );

  // 6.6 Student B attempts to modify Student A's payment record
  await check(
    "Student B CANNOT write/modify Student A's payment record",
    set(ref(studentBDb, `rakeb/payments/${coursePaid}/${studentAUid}`), {
      status: "submitted",
      amount: 150
    }),
    true,
    "Cross-user payment write blocked"
  );

  // 6.7 Student B attempts to read Student A's payment record
  await check(
    "Student B CANNOT read Student A's payment record",
    get(ref(studentBDb, `rakeb/payments/${coursePaid}/${studentAUid}`)),
    true,
    "Cross-user payment read blocked"
  );

  console.log("\n─── Scenario 7: Identity Index Security ───");

  // 7.1 Student B attempts to overwrite Student A's national ID index
  await check(
    "Student B CANNOT overwrite Student A's national ID index (point to B)",
    set(ref(studentBDb, `rakeb/usersByNationalId/29901011234567`), {
      uid: studentBUid,
      courseId: coursePaid
    }),
    true,
    "Student B attempting to hijack Student A's nationalId index"
  );

  // 7.2 Student B attempts to overwrite Student A's phone index
  await check(
    "Student B CANNOT overwrite Student A's phone index (point to B)",
    set(ref(studentBDb, `rakeb/usersByPhone/01011111111`), {
      uid: studentBUid,
      courseId: coursePaid
    }),
    true,
    "Student B attempting to hijack Student A's phone index"
  );

  // 7.3 Student B attempts to delete Student A's national ID index
  await check(
    "Student B CANNOT delete Student A's national ID index",
    set(ref(studentBDb, `rakeb/usersByNationalId/29901011234567`), null),
    true,
    "Delete identity index blocked"
  );

  // 7.4 Student B creates NEW unused national ID index for own UID
  await check(
    "Student B CAN create index for their OWN unused National ID",
    set(ref(studentBDb, `rakeb/usersByNationalId/29902029999999`), {
      uid: studentBUid,
      courseId: coursePaid
    }),
    false,
    "New registration creates own index"
  );

  // 7.5 Unauthenticated user cannot write identity index
  await check(
    "Unauthenticated user CANNOT write identity index",
    set(ref(unauthedDb, `rakeb/usersByNationalId/29903038888888`), {
      uid: "fake-uid",
      courseId: coursePaid
    }),
    true,
    "Unauthenticated index write blocked"
  );

  // Admin capabilities
  console.log("\n─── Admin Verification Capabilities ───");
  await check(
    "Admin CAN verify payment and set status = 'verified', verifiedBy, verifiedAt",
    update(ref(adminDb, `rakeb/payments/${coursePaid}/${studentAUid}`), {
      status: "verified",
      verifiedBy: adminUid,
      verifiedAt: Date.now()
    }),
    false,
    "Admin write to payment record"
  );

  await check(
    "Admin CAN update user paymentStatus to 'active'",
    update(ref(adminDb, `rakeb/users/${studentAUid}`), {
      paymentStatus: "active"
    }),
    false,
    "Admin update user paymentStatus"
  );

  await testEnv.cleanup();
  console.log("\nSummary of Rule Checks:");
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Passed: ${passedCount}, Failed: ${failedCount}`);
}

run().catch(console.error);
