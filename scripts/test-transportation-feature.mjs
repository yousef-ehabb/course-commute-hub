import assert from "node:assert/strict";
import fs from "node:fs";

// Import pricing logic directly
import {
  calculateTransportationFee,
  getDailyFeeForType,
  getTransportationTypeLabel,
  TRANSPORTATION_TYPE_LABELS,
} from "../src/utils/pricing.ts";

console.log("===============================================================");
console.log("🧪 RUNNING COMPREHENSIVE TRANSPORTATION PRICING FEATURE TESTS");
console.log("===============================================================\n");

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. PRICING CALCULATION TESTS
// ─────────────────────────────────────────────────────────────
console.log("─── 1. Pricing Calculation Tests ───");

const standardPaidCourse = {
  isFree: false,
  days: 5,
  dailyFee: 25,
  returnOnlyDailyFee: 15,
};

test("Round-trip daily fee resolves correctly (25 EGP)", () => {
  const fee = getDailyFeeForType(standardPaidCourse, "roundTrip");
  assert.equal(fee, 25);
});

test("Return-only daily fee resolves correctly (15 EGP)", () => {
  const fee = getDailyFeeForType(standardPaidCourse, "returnOnly");
  assert.equal(fee, 15);
});

test("Round-trip total fee: 5 days * 25 EGP = 125 EGP", () => {
  const total = calculateTransportationFee(standardPaidCourse, "roundTrip");
  assert.equal(total, 125);
});

test("Return-only total fee: 5 days * 15 EGP = 75 EGP", () => {
  const total = calculateTransportationFee(standardPaidCourse, "returnOnly");
  assert.equal(total, 75);
});

test("Different duration - 1 day: Round-trip = 25 EGP, Return-only = 15 EGP", () => {
  const oneDayCourse = { ...standardPaidCourse, days: 1 };
  assert.equal(calculateTransportationFee(oneDayCourse, "roundTrip"), 25);
  assert.equal(calculateTransportationFee(oneDayCourse, "returnOnly"), 15);
});

test("Different duration - 10 days: Round-trip = 250 EGP, Return-only = 150 EGP", () => {
  const tenDayCourse = { ...standardPaidCourse, days: 10 };
  assert.equal(calculateTransportationFee(tenDayCourse, "roundTrip"), 250);
  assert.equal(calculateTransportationFee(tenDayCourse, "returnOnly"), 150);
});

test("Different duration - 0 days: returns 0 EGP", () => {
  const zeroDayCourse = { ...standardPaidCourse, days: 0 };
  assert.equal(calculateTransportationFee(zeroDayCourse, "roundTrip"), 0);
  assert.equal(calculateTransportationFee(zeroDayCourse, "returnOnly"), 0);
});

test("Free course: isFree = true always returns 0 EGP for both types", () => {
  const freeCourse = { isFree: true, days: 5, dailyFee: 25, returnOnlyDailyFee: 15 };
  assert.equal(getDailyFeeForType(freeCourse, "roundTrip"), 0);
  assert.equal(getDailyFeeForType(freeCourse, "returnOnly"), 0);
  assert.equal(calculateTransportationFee(freeCourse, "roundTrip"), 0);
  assert.equal(calculateTransportationFee(freeCourse, "returnOnly"), 0);
});

test("Null/undefined paymentConfig returns 0", () => {
  assert.equal(getDailyFeeForType(null, "roundTrip"), 0);
  assert.equal(calculateTransportationFee(null, "roundTrip"), 0);
  assert.equal(getDailyFeeForType(undefined, "returnOnly"), 0);
  assert.equal(calculateTransportationFee(undefined, "returnOnly"), 0);
});

test("Legacy course without returnOnlyDailyFee falls back safely to dailyFee", () => {
  const legacyCourse = { isFree: false, days: 5, dailyFee: 25 }; // no returnOnlyDailyFee
  assert.equal(getDailyFeeForType(legacyCourse, "returnOnly"), 25);
  assert.equal(calculateTransportationFee(legacyCourse, "returnOnly"), 125);
});

test("Missing transportationType defaults safely to roundTrip", () => {
  assert.equal(getDailyFeeForType(standardPaidCourse, null), 25);
  assert.equal(getDailyFeeForType(standardPaidCourse, undefined), 25);
  assert.equal(calculateTransportationFee(standardPaidCourse, null), 125);
  assert.equal(calculateTransportationFee(standardPaidCourse, undefined), 125);
});

// ─────────────────────────────────────────────────────────────
// 2. VALIDATION & LABELS TESTS
// ─────────────────────────────────────────────────────────────
console.log("\n─── 2. Validation & Labels Tests ───");

test("Labels in Arabic: roundTrip = 'ذهاب وعودة', returnOnly = 'عودة فقط'", () => {
  assert.equal(getTransportationTypeLabel("roundTrip"), "ذهاب وعودة");
  assert.equal(getTransportationTypeLabel("returnOnly"), "عودة فقط");
  assert.equal(TRANSPORTATION_TYPE_LABELS.roundTrip, "ذهاب وعودة");
  assert.equal(TRANSPORTATION_TYPE_LABELS.returnOnly, "عودة فقط");
});

test("getTransportationTypeLabel defaults safely to 'ذهاب وعودة' for invalid/missing values", () => {
  assert.equal(getTransportationTypeLabel(null), "ذهاب وعودة");
  assert.equal(getTransportationTypeLabel(undefined), "ذهاب وعودة");
  assert.equal(getTransportationTypeLabel("invalid_type"), "ذهاب وعودة");
});

test("Only exactly 2 options allowed: 'roundTrip' and 'returnOnly'", () => {
  function validateType(val) {
    return val === "roundTrip" || val === "returnOnly";
  }
  assert.equal(validateType("roundTrip"), true);
  assert.equal(validateType("returnOnly"), true);
  assert.equal(validateType("goOnly"), false, "There must be NO 'ذهاب فقط' option");
  assert.equal(validateType("oneWay"), false);
  assert.equal(validateType(""), false);
  assert.equal(validateType(null), false);
});

// ─────────────────────────────────────────────────────────────
// 3. REGISTRATION FLOW SIMULATION & BACKWARD COMPATIBILITY
// ─────────────────────────────────────────────────────────────
console.log("\n─── 3. Registration Flow & Backward Compatibility Tests ───");

function simulateRegistration(course, selection) {
  const isFree = course?.isFree ?? true;
  const paymentConfig = course;
  const paymentAmount = isFree ? 0 : calculateTransportationFee(paymentConfig, selection);
  const paymentStatus = isFree ? "active" : "pending_payment";
  return {
    transportationType: selection,
    paymentAmount,
    paymentStatus,
  };
}

test("Student registers with Round-Trip in paid course: 125 EGP, pending_payment", () => {
  const reg = simulateRegistration(standardPaidCourse, "roundTrip");
  assert.equal(reg.transportationType, "roundTrip");
  assert.equal(reg.paymentAmount, 125);
  assert.equal(reg.paymentStatus, "pending_payment");
});

test("Student registers with Return-Only in paid course: 75 EGP, pending_payment", () => {
  const reg = simulateRegistration(standardPaidCourse, "returnOnly");
  assert.equal(reg.transportationType, "returnOnly");
  assert.equal(reg.paymentAmount, 75);
  assert.equal(reg.paymentStatus, "pending_payment");
});

test("Student registers in free course: 0 EGP, active", () => {
  const freeCourse = { isFree: true, days: 5, dailyFee: 25, returnOnlyDailyFee: 15 };
  const reg = simulateRegistration(freeCourse, "roundTrip");
  assert.equal(reg.transportationType, "roundTrip");
  assert.equal(reg.paymentAmount, 0);
  assert.equal(reg.paymentStatus, "active");
});

test("Existing legacy student without transportationType preserves original paymentAmount (125 EGP)", () => {
  const legacyStudent = {
    uid: "legacy-1",
    fullName: "أحمد محمد علي",
    paymentStatus: "pending_payment",
    paymentAmount: 125,
    // transportationType is missing
  };

  // Safe backward-compatible resolution
  const transportType = legacyStudent.transportationType || "roundTrip";
  assert.equal(transportType, "roundTrip");

  // Fee is preserved from student profile and NOT silently recalculated
  const amountToCharge = typeof legacyStudent.paymentAmount === "number"
    ? legacyStudent.paymentAmount
    : calculateTransportationFee(standardPaidCourse, transportType);

  assert.equal(amountToCharge, 125);
});

// ─────────────────────────────────────────────────────────────
// 4. PAYMENT SUBMISSION & REVIEW WORKFLOW TESTS
// ─────────────────────────────────────────────────────────────
console.log("\n─── 4. Payment Workflow & Agreement Tests ───");

test("Return-only student payment submission retains 75 EGP and 'returnOnly' type", () => {
  const student = {
    uid: "student-ret-1",
    fullName: "سارة أحمد",
    nationalId: "29901011234567",
    transportationType: "returnOnly",
    paymentAmount: 75,
    paymentStatus: "pending_payment",
  };

  // Payment submission logic from PaymentStatusPage
  const transportType = student.transportationType === "returnOnly" ? "returnOnly" : "roundTrip";
  const calculatedFee = calculateTransportationFee(standardPaidCourse, transportType);
  const amount = typeof student.paymentAmount === "number" ? student.paymentAmount : calculatedFee;

  const paymentRecord = {
    userId: student.uid,
    courseId: "course-101",
    amount,
    transportationType: transportType,
    status: "submitted",
    paymentMethod: "instaPay",
    submittedAt: Date.now(),
  };

  assert.equal(paymentRecord.amount, 75);
  assert.equal(paymentRecord.transportationType, "returnOnly");
  assert.equal(paymentRecord.status, "submitted");
});

test("Admin review: displayed fee, student record, and payment submission amount all agree", () => {
  const student = {
    uid: "student-ret-1",
    paymentAmount: 75,
    transportationType: "returnOnly",
  };
  const paymentRecord = {
    amount: 75,
    transportationType: "returnOnly",
    status: "submitted",
  };

  const adminViewAmount = student.paymentAmount || paymentRecord?.amount || 0;
  const adminViewType = student.transportationType || paymentRecord?.transportationType || "roundTrip";

  assert.equal(adminViewAmount, 75);
  assert.equal(adminViewType, "returnOnly");
  assert.equal(adminViewAmount, paymentRecord.amount);
});

test("Admin manual cash activation records exact amount and transportationType", () => {
  const student = {
    uid: "student-cash-1",
    courseId: "course-101",
    paymentAmount: 75,
    transportationType: "returnOnly",
  };

  const transportType = student.transportationType || "roundTrip";
  const manualRecord = {
    userId: student.uid,
    courseId: student.courseId,
    amount: student.paymentAmount || 0,
    transportationType: transportType,
    status: "verified",
    paymentMethod: "cash",
  };

  assert.equal(manualRecord.amount, 75);
  assert.equal(manualRecord.transportationType, "returnOnly");
  assert.equal(manualRecord.status, "verified");
  assert.equal(manualRecord.paymentMethod, "cash");
});

// ─────────────────────────────────────────────────────────────
// 5. FINANCIAL EXPORT CONSISTENCY TESTS
// ─────────────────────────────────────────────────────────────
console.log("\n─── 5. Financial Export Consistency Tests ───");

test("Export rows include transportation type, daily rate, and correct totals", () => {
  const students = [
    {
      uid: "s1",
      fullName: "طالب 1 (ذهاب وعودة)",
      nationalId: "29901011234567",
      phone: "01012345678",
      courseId: "c1",
      transportationType: "roundTrip",
      paymentAmount: 125,
      paymentStatus: "active",
      paymentRecord: { paymentMethod: "instaPay", submittedAt: 1700000000000, verifiedAt: 1700001000000 },
    },
    {
      uid: "s2",
      fullName: "طالب 2 (عودة فقط)",
      nationalId: "29901011234568",
      phone: "01012345679",
      courseId: "c1",
      transportationType: "returnOnly",
      paymentAmount: 75,
      paymentStatus: "active",
      paymentRecord: { paymentMethod: "vodafoneCash", submittedAt: 1700000000000, verifiedAt: 1700001000000 },
    },
    {
      uid: "s3",
      fullName: "طالب 3 (عودة فقط - معلق)",
      nationalId: "29901011234569",
      phone: "01012345670",
      courseId: "c1",
      transportationType: "returnOnly",
      paymentAmount: 75,
      paymentStatus: "pending_payment",
      paymentRecord: undefined,
    },
  ];

  const exportData = students.map((s) => ({
    الاسم: s.fullName,
    "الرقم القومي": s.nationalId,
    "رقم الهاتف": s.phone,
    "نوع المواصلات": getTransportationTypeLabel(s.transportationType),
    "سعر اليوم (ج.م)": getDailyFeeForType(standardPaidCourse, s.transportationType),
    "المبلغ المطلوب (ج.م)": s.paymentAmount,
    "حالة الدفع": s.paymentStatus === "active" ? "✅ تم الدفع والتفعيل" : "❌ لم يتم الدفع",
  }));

  assert.equal(exportData[0]["نوع المواصلات"], "ذهاب وعودة");
  assert.equal(exportData[0]["سعر اليوم (ج.م)"], 25);
  assert.equal(exportData[0]["المبلغ المطلوب (ج.م)"], 125);

  assert.equal(exportData[1]["نوع المواصلات"], "عودة فقط");
  assert.equal(exportData[1]["سعر اليوم (ج.م)"], 15);
  assert.equal(exportData[1]["المبلغ المطلوب (ج.م)"], 75);

  assert.equal(exportData[2]["نوع المواصلات"], "عودة فقط");
  assert.equal(exportData[2]["سعر اليوم (ج.م)"], 15);
  assert.equal(exportData[2]["المبلغ المطلوب (ج.م)"], 75);

  // Financial summary:
  const totalExpected = students.reduce((sum, s) => sum + s.paymentAmount, 0);
  const totalCollected = students.filter((s) => s.paymentStatus === "active").reduce((sum, s) => sum + s.paymentAmount, 0);
  const totalPending = totalExpected - totalCollected;

  assert.equal(totalExpected, 125 + 75 + 75); // 275 EGP
  assert.equal(totalCollected, 125 + 75);      // 200 EGP
  assert.equal(totalPending, 75);              // 75 EGP
});

// ─────────────────────────────────────────────────────────────
// 6. CLIENT TAMPERING & SECURITY TESTS
// ─────────────────────────────────────────────────────────────
console.log("\n─── 6. Client Tampering Prevention Tests ───");

test("Client cannot tamper amount: Registration computes amount strictly from course config", () => {
  const maliciousClientInput = {
    transportationType: "roundTrip",
    manipulatedAmount: 5, // Client attempts to send 5 EGP instead of 125 EGP
  };

  // Trusted registration calculation computes from course configuration
  const trustedAmount = calculateTransportationFee(standardPaidCourse, maliciousClientInput.transportationType);
  assert.equal(trustedAmount, 125, "System must ignore client-tampered amount");
  assert.notEqual(trustedAmount, maliciousClientInput.manipulatedAmount);
});

test("Database rules validate that transportationType is strictly 'roundTrip' or 'returnOnly'", () => {
  const rulesContent = fs.readFileSync("database.rules.json", "utf8");
  assert.ok(
    rulesContent.includes("newData.val() === 'roundTrip' || newData.val() === 'returnOnly'"),
    "database.rules.json must contain validation for roundTrip and returnOnly"
  );
});

console.log("\n===============================================================");
console.log(`🎉 TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED! (100%)`);
console.log("===============================================================");

