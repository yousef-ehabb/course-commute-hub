/**
 * NOTE: The Firebase RTDB emulator requires Java 21+. 
 * If you encounter issues on Windows where the emulator hangs, ensure 
 * you have a JDK 21+ in your PATH (we are currently using a portable JDK 21 in scratch/jdk21).
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import fs from "fs";

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

async function runTests() {
  await setup();
  console.log("\n🧪 Phase 2a Security Rules — SDK Tests\n");

  const DATE_KEY = "2025-08-01";
  
  // Set up unauthenticated context (for checking general access)
  const unauthedDb = testEnv.unauthenticatedContext().database();

  // Set up Admin context
  const adminDb = testEnv.authenticatedContext("admin-test-001").database();
  
  // Set up Student contexts
  const studentADb = testEnv.authenticatedContext("student-aaa").database();
  const studentBDb = testEnv.authenticatedContext("student-bbb").database();

  console.log("🔧 Seeding test data...\n");

  // We use withSecurityRulesDisabled to write the initial state
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    
    // Seed admin user
    await db.ref("rakeb/users/admin-test-001").set({ role: "admin", fullName: "Test Admin" });
    // Seed student users
    await db.ref("rakeb/users/student-aaa").set({ role: "student", fullName: "Student A" });
    await db.ref("rakeb/users/student-bbb").set({ role: "student", fullName: "Student B" });

    // Seed boarding records
    await db.ref(`rakeb/boardingRecords/${DATE_KEY}/student-aaa`).set({
        id: "student-aaa",
        studentId: "student-aaa",
        vehicleId: "vehicle-001",
        status: "boarded",
        boardedAt: Date.now(),
        boardedByCoordinatorId: "admin-test-001",
    });
    await db.ref(`rakeb/boardingRecords/${DATE_KEY}/student-bbb`).set({
        id: "student-bbb",
        studentId: "student-bbb",
        vehicleId: "vehicle-001",
        status: "boarded",
        boardedAt: Date.now(),
        boardedByCoordinatorId: "admin-test-001",
    });

    // Seed vehicles
    await db.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-planned`).set({
        id: "vehicle-planned",
        type: "bus",
        capacity: 50,
        occupiedSeats: 0,
        status: "planned",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    await db.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-running`).set({
        id: "vehicle-running",
        type: "microbus",
        capacity: 14,
        occupiedSeats: 5,
        status: "running",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    await db.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-full`).set({
        id: "vehicle-full",
        type: "bus",
        capacity: 50,
        occupiedSeats: 50,
        status: "full",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
  });

  let passed = 0;
  let failed = 0;

  async function test(name, promise, expectFail) {
    try {
      if (expectFail) {
        await assertFails(promise);
      } else {
        await assertSucceeds(promise);
      }
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}`);
      console.log(`     Error:`, e.message);
      failed++;
    }
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 1: boardingRecords scoping");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await test("Student A CAN read their own boarding record",
    studentADb.ref(`rakeb/boardingRecords/${DATE_KEY}/student-aaa`).once('value'), false);
    
  await test("Student A CANNOT read Student B's boarding record",
    studentADb.ref(`rakeb/boardingRecords/${DATE_KEY}/student-bbb`).once('value'), true);

  await test("Student B CAN read their own boarding record",
    studentBDb.ref(`rakeb/boardingRecords/${DATE_KEY}/student-bbb`).once('value'), false);

  await test("Student A CANNOT list-read all boarding records for the date",
    studentADb.ref(`rakeb/boardingRecords/${DATE_KEY}`).once('value'), true);

  await test("Admin CAN read any student's boarding record",
    adminDb.ref(`rakeb/boardingRecords/${DATE_KEY}/student-bbb`).once('value'), false);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 2: capacity .validate on non-planned vehicles");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await test("Admin CAN update capacity on a planned vehicle",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-planned`).update({ capacity: 45, updatedAt: Date.now() }), false);

  await test("Admin CANNOT update capacity on a running vehicle (validate rejects)",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-running`).update({ capacity: 20, updatedAt: Date.now() }), true);

  await test("Admin CANNOT update capacity on a full vehicle (validate rejects)",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-full`).update({ capacity: 60, updatedAt: Date.now() }), true);

  await test("Admin CAN update non-capacity fields on a running vehicle",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-running`).update({ updatedAt: Date.now(), assignedCoordinatorId: "admin-test-001" }), false);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 3: delete planned vehicle (validate + write interaction)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await test("Admin CAN delete a planned vehicle (validate does not interfere)",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-planned`).remove(), false);

  await test("Admin CANNOT delete a running vehicle (.write rule blocks)",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-running`).remove(), true);

  await test("Admin CANNOT delete a full vehicle (.write rule blocks)",
    adminDb.ref(`rakeb/vehicles/default/${DATE_KEY}/vehicle-full`).remove(), true);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await testEnv.cleanup();

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
