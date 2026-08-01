/**
 * Test clock skew staleness recovery.
 */
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import fs from "fs";
import { runTransaction, ref } from "firebase/database";

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

// ── Replicated logic from TripRepository.takeControl for testing ─────────

async function takeControlTest(db, vehicleId, adminUid, mockServerTimeOffset, mockLocalTimeNow) {
  const path = `rakeb/vehicles/default/${DATE_KEY}/${vehicleId}`;
  
  // We mock the local Date.now() and the offset to simulate skew.
  const estimatedServerTime = mockLocalTimeNow + mockServerTimeOffset;
  
  const { get, onValue } = await import("firebase/database");
  
  // Attach a temporary listener to prime the SDK cache for the transaction
  const unsub = onValue(ref(db, path), () => {});
  
  try {
    const result = await runTransaction(ref(db, path), (vehicle) => {
      console.log("[txn] vehicle:", vehicle);
      if (vehicle === null) {
        // Return a dummy object so SDK tries to write, server rejects due to hash,
        // and SDK fetches real data and re-runs this function.
        return { assignedCoordinatorId: adminUid, assignedAt: estimatedServerTime, lastHeartbeatAt: estimatedServerTime };
      }
      
      const STALE_TIMEOUT_MS = 60 * 1000;
      
      if (vehicle.assignedCoordinatorId) {
        if (vehicle.assignedCoordinatorId !== adminUid) {
          const lastActive = vehicle.lastHeartbeatAt || vehicle.assignedAt || 0;
          if (estimatedServerTime - lastActive < STALE_TIMEOUT_MS) {
            return undefined; // Still active, abort
          }
        }
      }
      
      vehicle.assignedCoordinatorId = adminUid;
      vehicle.assignedAt = estimatedServerTime;
      vehicle.lastHeartbeatAt = estimatedServerTime;
      
      return vehicle;
    });
    
    if (!result.committed) {
      return { success: false, error: "Cannot take control" };
    }
    return { success: true };
  } catch (err) {
    console.error("takeControl failed with err:", err.message);
    return { success: false, error: err.message };
  } finally {
    unsub();
  }
}

async function runTests() {
  await setup();
  console.log("\n🧪 Phase 2c Clock Skew Tests\n");

  const admin1Db = testEnv.authenticatedContext("admin-1").database();
  const admin2Db = testEnv.authenticatedContext("admin-2").database();

  console.log("🔧 Seeding test data...\n");

  await testEnv.clearDatabase();
  
  const SERVER_NOW = 1000000000000; // Fixed "true" server time

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    await db.ref("rakeb/users/admin-1").set({ role: "admin", fullName: "Admin 1" });
    await db.ref("rakeb/users/admin-2").set({ role: "admin", fullName: "Admin 2" });
    
    // Seed vehicle 
    await db.ref(`rakeb/vehicles/default/${DATE_KEY}/bus-skew`).set({
      id: "bus-skew",
      type: "bus",
      status: "running",
      capacity: 50,
      occupiedSeats: 0,
    });
  });

  // Admin 1 has a fast clock (local time is 5 minutes ahead of server)
  // Admin 2 has a slow clock (local time is 5 minutes behind server)

  const admin1Offset = SERVER_NOW - (SERVER_NOW + 5 * 60000); // -300000
  const admin1LocalTime = SERVER_NOW + 5 * 60000; // Fast

  const admin2Offset = SERVER_NOW - (SERVER_NOW - 5 * 60000); // +300000
  const admin2LocalTime = SERVER_NOW - 5 * 60000; // Slow

  console.log("▶️ Test 1: Admin 1 takes control");
  // Admin 1 takes control at T=0
  const r1 = await takeControlTest(admin1Db, "bus-skew", "admin-1", admin1Offset, admin1LocalTime);
  if (r1.success) {
    console.log("✅ Admin 1 successfully took control.");
  } else {
    console.error("❌ Admin 1 failed to take control.");
    process.exit(1);
  }

  // 10 seconds later (in true server time), Admin 2 tries to steal it.
  // Since only 10s passed, it should NOT be stale, even though Admin 2's clock is way behind
  // Admin 1's local time. If offset isn't applied correctly, Admin 2 might think it's stale
  // or too new.
  console.log("\n▶️ Test 2: Admin 2 tries to steal before timeout (with skew)");
  
  const r2 = await takeControlTest(admin2Db, "bus-skew", "admin-2", admin2Offset, admin2LocalTime + 10000);
  if (!r2.success) {
    console.log("✅ Admin 2 correctly blocked from stealing (vehicle not stale yet).");
  } else {
    console.error("❌ Admin 2 stole the vehicle too early!");
    process.exit(1);
  }

  // 65 seconds later (in true server time), Admin 2 tries to steal it.
  // It SHOULD be stale now.
  console.log("\n▶️ Test 3: Admin 2 tries to steal after timeout (with skew)");
  const r3 = await takeControlTest(admin2Db, "bus-skew", "admin-2", admin2Offset, admin2LocalTime + 65000);
  if (r3.success) {
    console.log("✅ Admin 2 successfully stole the stale vehicle.");
  } else {
    console.error("❌ Admin 2 failed to steal the vehicle, but it should be stale!");
    process.exit(1);
  }

  console.log("\n🎉 All Clock Skew tests passed!\n");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
