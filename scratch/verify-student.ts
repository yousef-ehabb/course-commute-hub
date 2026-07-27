import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get, set, update } from "firebase/database";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const config: Record<string, string> = {};
envContent.split("\n").forEach((line) => {
  const [key, value] = line.split("=");
  if (key && value) {
    config[key.trim()] = value.trim().replace(/"/g, "");
  }
});

const firebaseConfig = {
  apiKey: config.VITE_FIREBASE_API_KEY,
  authDomain: config.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: config.VITE_FIREBASE_PROJECT_ID,
  databaseURL: config.VITE_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function main() {
  const email = `testuser${Date.now()}@example.com`;
  const password = "password123";
  let uid = "";

  console.log("=== Creating test user ===");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  uid = cred.user.uid;
  console.log(`User created with UID: ${uid}`);

  console.log("\n=== Testing Student Permissions ===");

  // 1. Try to create profile as admin (should fail)
  try {
    await set(ref(db, `rakeb/users/${uid}`), { role: "admin", uid });
    console.log("❌ ERROR: Was able to create profile as admin! (Role escalation vulnerability)");
  } catch (e: any) {
    console.log("✅ Prevented creating profile as admin (Permission denied)");
  }

  // 2. Try to create profile as student (should succeed)
  try {
    await set(ref(db, `rakeb/users/${uid}`), { role: "student", uid });
    console.log("✅ Created profile as student successfully");
  } catch (e: any) {
    console.log("❌ ERROR: Failed to create profile as student:", e.message);
  }

  // 3. Try to read own profile (should succeed)
  try {
    await get(ref(db, `rakeb/users/${uid}`));
    console.log("✅ Reads own profile successfully");
  } catch (e: any) {
    console.log("❌ ERROR: Failed to read own profile:", e.message);
  }

  // 4. Try to read users collection (should fail)
  try {
    await get(ref(db, `rakeb/users`));
    console.log("❌ ERROR: Was able to read users collection!");
  } catch (e: any) {
    console.log("✅ Cannot read users collection (Permission denied)");
  }

  // 5. Try to read trip history (should fail)
  try {
    await get(ref(db, `rakeb/tripHistory/default`));
    console.log("❌ ERROR: Was able to read trip history!");
  } catch (e: any) {
    console.log("✅ Cannot read trip history (Permission denied)");
  }

  // 6. Try to escalate role to admin (should fail)
  try {
    await update(ref(db, `rakeb/users/${uid}`), { role: "admin" });
    console.log("❌ ERROR: Was able to update role to admin! (Role escalation vulnerability)");
  } catch (e: any) {
    console.log("✅ Prevented updating role to admin (Permission denied)");
  }

  console.log(`\nUID_FOR_ADMIN_TEST=${uid}`);
  process.exit(0);
}

main().catch(console.error);
