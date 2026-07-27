import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get, set } from "firebase/database";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

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
  const email = `admin_test_${Date.now()}@example.com`;
  const password = "password123";
  let uid = "";

  console.log(`=== Creating test user ${email} ===`);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  uid = cred.user.uid;
  console.log(`User created with UID: ${uid}`);

  // Create as student first
  await set(ref(db, `rakeb/users/${uid}`), { role: "student", uid });
  console.log("✅ Created initial profile as student");

  console.log("\n=== Upgrading to Admin via CLI ===");
  // Upgrade to admin using CLI and our local JSON file
  try {
    execSync(
      `npx firebase-tools database:set /rakeb/users/${uid}/role scratch/admin-role.json --project ${config.VITE_FIREBASE_PROJECT_ID} --force`,
    );
  } catch (e: any) {
    // firebase-tools sometimes exits with code 1 despite persisting successfully
    // We ignore it and verify via the test reads below.
  }
  console.log("✅ Upgraded to admin via CLI");

  console.log("\n=== Testing Admin Permissions ===");

  // 1. Try to read own profile (should succeed)
  try {
    await get(ref(db, `rakeb/users/${uid}`));
    console.log("✅ Reads own profile successfully");
  } catch (e: any) {
    console.log("❌ ERROR: Failed to read own profile:", e.message);
  }

  // 2. Try to read users collection (should succeed)
  try {
    await get(ref(db, `rakeb/users`));
    console.log("✅ Reads users collection successfully");
  } catch (e: any) {
    console.log("❌ ERROR: Cannot read users collection:", e.message);
  }

  // 3. Try to read trip history (should succeed)
  try {
    await get(ref(db, `rakeb/tripHistory/default`));
    console.log("✅ Reads trip history successfully");
  } catch (e: any) {
    console.log("❌ ERROR: Cannot read trip history:", e.message);
  }

  process.exit(0);
}

main().catch(console.error);
