/**
 * Test boarding idempotency and concurrency rollback (Phase 2c).
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import fs from "fs";
import { runTransaction, serverTimestamp, increment, update, ref } from "firebase/database";

let testEnv;
const DATE_KEY = "2025-08-01";

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

// ── Replicated logic from TripRepository.ts for testing ────────────────────

async function boardStudentTest(db, studentId, vehicleId, adminUid) {
  const recordRef = ref(db, `rakeb/boardingRecords/${DATE_KEY}/${studentId}`);

  let originalData = null;
  const { committed } = await runTransaction(recordRef, (currentData) => {
    console.log(`[txn] currentData for ${studentId}:`, currentData);
    if (currentData && currentData.status === "boarded") {
      return; // Abort if already boarded
    }
    originalData = currentData;
    return {
      id: studentId,
      studentId,
      vehicleId,
      status: "boarded",
      boardedAt: serverTimestamp(),
      boardedByCoordinatorId: adminUid,
      undoneAt: null,
    };
  });

  if (!committed) {
    console.log(`[txn] aborted for ${studentId}`);
    return { success: false, error: "الطالب مسجل بالفعل" };
  }

  try {
    // Await this update, but if it's rejected by security rules (capacity exceeded),
    // it throws an error and we fall into the catch block.
    await update(ref(db), {
      [`rakeb/vehicles/default/${DATE_KEY}/${vehicleId}/occupiedSeats`]: increment(1)
    });
    return { success: true };
  } catch (err) {
    console.error("Boarding failed with error:", err.message);
    // Rollback
    await update(ref(db), {
      [`rakeb/boardingRecords/${DATE_KEY}/${studentId}`]: originalData || null
    });
    return { success: false, error: "المركبة ممتلئة" };
  }
}

async function runTests() {
  await setup();
  console.log("\n🧪 Phase 2c Boarding Tests\n");

  const adminContext = testEnv.authenticatedContext("admin-test-001");
  const adminDb = adminContext.database();

  console.log("🔧 Seeding test data...\n");

  await testEnv.clearDatabase();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await db.ref("rakeb/users/admin-test-001").set({ role: "admin", fullName: "Test Admin" });
    
    // Seed vehicle 1 (Capacity 1)
    await db.ref(`rakeb/vehicles/default/${DATE_KEY}/bus-1`).set({
      id: "bus-1",
      type: "bus",
      status: "running",
      capacity: 1,
      occupiedSeats: 0,
      assignedCoordinatorId: "admin-test-001",
      assignedAt: Date.now()
    });

    // Seed vehicle 2 (Capacity 2)
    await db.ref(`rakeb/vehicles/default/${DATE_KEY}/bus-2`).set({
      id: "bus-2",
      type: "bus",
      status: "running",
      capacity: 2,
      occupiedSeats: 0,
      assignedCoordinatorId: "admin-test-001",
      assignedAt: Date.now()
    });
  });

  console.log("▶️ Test 1: Double-tap idempotency");
  // Execute boardStudent twice concurrently for the same student
  const p1 = boardStudentTest(adminDb, "student-1", "bus-2", "admin-test-001");
  const p2 = boardStudentTest(adminDb, "student-1", "bus-2", "admin-test-001");

  const [res1, res2] = await Promise.all([p1, p2]);
  
  const successCount = [res1, res2].filter(r => r.success).length;
  if (successCount === 1) {
    console.log("✅ Passed: Only one boarding request succeeded.");
  } else {
    console.error(`❌ Failed: Expected 1 success, got ${successCount}`);
    process.exit(1);
  }

  // Verify occupiedSeats is 1
  const v2Snap = await adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/bus-2`).get();
  if (v2Snap.val().occupiedSeats === 1) {
    console.log("✅ Passed: Occupied seats is correctly 1.");
  } else {
    console.error(`❌ Failed: Occupied seats should be 1, got ${v2Snap.val().occupiedSeats}`);
    process.exit(1);
  }

  console.log("\n▶️ Test 2: Concurrency exceeding capacity");
  // bus-1 has capacity 1. We'll try to board two DIFFERENT students at the exact same time.
  // One should succeed, the other should fail with capacity error and rollback its boarding record.
  
  const p3 = boardStudentTest(adminDb, "student-2", "bus-1", "admin-test-001");
  const p4 = boardStudentTest(adminDb, "student-3", "bus-1", "admin-test-001");

  const [res3, res4] = await Promise.all([p3, p4]);

  const successCount2 = [res3, res4].filter(r => r.success).length;
  const errorCount2 = [res3, res4].filter(r => !r.success && r.error === "المركبة ممتلئة").length;
  
  if (successCount2 === 1 && errorCount2 === 1) {
    console.log("✅ Passed: One request succeeded, the other failed with capacity error.");
  } else {
    console.error(`❌ Failed: Expected 1 success and 1 capacity error. Got:`, {res3, res4});
    process.exit(1);
  }

  // Verify occupiedSeats is 1 (capacity)
  const v1Snap = await adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/bus-1`).get();
  if (v1Snap.val().occupiedSeats === 1) {
    console.log("✅ Passed: Occupied seats capped at 1.");
  } else {
    console.error(`❌ Failed: Occupied seats should be 1, got ${v1Snap.val().occupiedSeats}`);
    process.exit(1);
  }

  // Verify that the failed student's boarding record was rolled back
  const failedStudentId = res3.success ? "student-3" : "student-2";
  const failedRecordSnap = await adminDb.ref(`rakeb/boardingRecords/${DATE_KEY}/${failedStudentId}`).get();
  if (!failedRecordSnap.exists() || failedRecordSnap.val() === null) {
    console.log("✅ Passed: Failed student's boarding record was correctly rolled back.");
  } else {
    console.error(`❌ Failed: Boarding record was NOT rolled back for ${failedStudentId}. Data:`, failedRecordSnap.val());
    process.exit(1);
  }

  console.log("\n🎉 All 2c Boarding tests passed!\n");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
