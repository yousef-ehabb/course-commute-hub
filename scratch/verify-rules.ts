import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, get, set, update } from "firebase/database";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Load config from .env
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
  storageBucket: config.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: config.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: config.VITE_FIREBASE_APP_ID,
  databaseURL: config.VITE_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function testAccess(uid: string, asAdmin: boolean) {
  console.log(`\n--- Testing as ${asAdmin ? "Admin" : "Student"} ---`);

  // 1. Read own profile
  try {
    await get(ref(db, `rakeb/users/${uid}`));
    console.log("✅ Reads own profile successfully");
  } catch (e: any) {
    console.log("❌ Failed to read own profile:", e.message);
  }

  // 2. Read users collection
  try {
    await get(ref(db, `rakeb/users`));
    console.log("✅ Reads users collection successfully");
  } catch (e: any) {
    if (e.message.includes("Permission denied")) {
      console.log(
        asAdmin
          ? "❌ Failed to read users collection"
          : "✅ Cannot read users collection (Permission Denied)",
      );
    } else {
      console.log("❌ Unexpected error reading users:", e.message);
    }
  }

  // 3. Read trip history
  try {
    await get(ref(db, `rakeb/tripHistory/default`));
    console.log("✅ Reads trip history successfully");
  } catch (e: any) {
    if (e.message.includes("Permission denied")) {
      console.log(
        asAdmin
          ? "❌ Failed to read trip history"
          : "✅ Cannot read trip history (Permission Denied)",
      );
    } else {
      console.log("❌ Unexpected error reading trip history:", e.message);
    }
  }

  // 4. Try role escalation
  try {
    await update(ref(db, `rakeb/users/${uid}`), { role: "admin" });
    if (!asAdmin) {
      console.log("❌ Role escalation succeeded (THIS IS BAD)");
    } else {
      console.log("✅ Admin can update roles successfully");
    }
  } catch (e: any) {
    if (e.message.includes("Permission denied")) {
      console.log(
        asAdmin
          ? "❌ Admin failed to update role"
          : "✅ Role escalation prevented (Permission Denied)",
      );
    } else {
      console.log("❌ Unexpected error updating role:", e.message);
    }
  }
}

async function main() {
  const email = `testuser${Date.now()}@example.com`;
  const password = "password123";
  let uid = "";

  console.log("Creating test user...");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    // Set initial role as student using CLI to bypass client restrictions
    execSync(
      `npx firebase-tools database:set /rakeb/users/${uid} '{"role":"student","uid":"${uid}"}' --project ${config.VITE_FIREBASE_PROJECT_ID} --force`,
    );
    console.log(`User created with UID: ${uid}`);
  } catch (e: any) {
    console.error("Failed to create user", e.message);
    return;
  }

  // Test as student
  await testAccess(uid, false);

  // Upgrade to admin using CLI
  console.log("\nUpgrading user to Admin via CLI...");
  execSync(
    `npx firebase-tools database:update /rakeb/users/${uid} '{"role":"admin"}' --project ${config.VITE_FIREBASE_PROJECT_ID} --force`,
  );

  // Test as admin
  // Need to force refresh token or re-login if claims were used, but role is in RTDB so it evaluates instantly!
  await testAccess(uid, true);

  console.log("\nCleaning up test user...");
  execSync(
    `npx firebase-tools database:remove /rakeb/users/${uid} --project ${config.VITE_FIREBASE_PROJECT_ID} --force`,
  );
  // Cannot easily delete auth user from client SDK without recent login, but good enough for this test.

  process.exit(0);
}

main().catch(console.error);
