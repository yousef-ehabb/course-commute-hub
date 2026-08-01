import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import fs from "fs";
import { set, get, ref } from "firebase/database";

let testEnv;
const DATE_KEY = "2026-08-01";

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

async function runTests() {
  await setup();
  console.log("\n🧪 Phase 2c Final Verification Tests\n");

  await testEnv.clearDatabase();
  console.log("🔧 Database cleared.\n");

  // --- Seed Admin Account ---
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await set(ref(db, `rakeb/users/admin-uid`), {
      role: "admin",
      fullName: "Test Admin"
    });
    
    // Seed some boarding records for student testing
    await set(ref(db, `rakeb/boardingRecords/${DATE_KEY}/studentA`), {
      studentId: "studentA",
      status: "boarded"
    });
    await set(ref(db, `rakeb/boardingRecords/${DATE_KEY}/studentB`), {
      studentId: "studentB",
      status: "boarded"
    });
  });
  console.log("✅ Admin account and test data seeded.\n");

  const adminDb = testEnv.authenticatedContext("admin-uid").database();
  const studentADb = testEnv.authenticatedContext("studentA").database();

  // --- Verify createVehicle() ---
  console.log("▶️ Test 1: Admin createVehicle()");
  try {
    await set(ref(adminDb, `rakeb/vehicles/default/${DATE_KEY}/test-vehicle`), {
      id: "test-vehicle",
      type: "bus",
      capacity: 50,
      occupiedSeats: 0,
      status: "planned",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log("✅ createVehicle() succeeded without PERMISSION_DENIED.");
  } catch (err) {
    console.error("❌ createVehicle() failed:", err.message);
    process.exit(1);
  }

  // --- Verify useBoardingRecords() for admin ---
  console.log("\n▶️ Test 2: Admin useBoardingRecords() (read entire day)");
  try {
    await get(ref(adminDb, `rakeb/boardingRecords/${DATE_KEY}`));
    console.log("✅ Admin read of boardingRecords succeeded.");
  } catch (err) {
    console.error("❌ Admin read of boardingRecords failed:", err.message);
    process.exit(1);
  }

  // --- Verify student boarding records scope ---
  console.log("\n▶️ Test 3: Student Boarding Records Read Scope");
  
  // Student A reads their own record
  try {
    await get(ref(studentADb, `rakeb/boardingRecords/${DATE_KEY}/studentA`));
    console.log("✅ Student A successfully read their own record.");
  } catch (err) {
    console.error("❌ Student A failed to read their own record:", err.message);
    process.exit(1);
  }

  // Student A attempts to read Student B's record
  try {
    await get(ref(studentADb, `rakeb/boardingRecords/${DATE_KEY}/studentB`));
    console.error("❌ Student A unexpectedly succeeded in reading Student B's record!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Student A was correctly denied reading Student B's record.");
  }

  // Student A attempts to read the entire day's records
  try {
    await get(ref(studentADb, `rakeb/boardingRecords/${DATE_KEY}`));
    console.error("❌ Student A unexpectedly succeeded in reading the entire day's records!");
    process.exit(1);
  } catch (err) {
    console.log("✅ Student A was correctly denied reading the entire day's records.");
  }

  console.log("\n🎉 All Verification tests passed!\n");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Verification tests failed:", err);
  process.exit(1);
});
