import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const API_KEY = "AIzaSyD05Coab-Dn-xU2GkvOJKnUH9gyBK9gos4";
const DATABASE_URL = "https://course-commute-hub-default-rtdb.europe-west1.firebasedatabase.app";

async function fixAdmin() {
  const email = "admin@rakeb.com";
  const password = "Password123!";

  console.log(`Setting up ${email} with password "${password}"...`);

  // Try signing up or resetting password
  let idToken, uid;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (res.ok) {
      idToken = data.idToken;
      uid = data.localId;
      console.log(`Created auth account for ${email}, UID: ${uid}`);
    } else if (data.error?.message === "EMAIL_EXISTS") {
      console.log(`${email} already exists in Auth. Updating password...`);
      // Sign in or change password using reset/update
      // Since we don't know old password, let's use sendOobCode or reset if possible, or try signing in
      const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const signInData = await signInRes.json();
      if (signInRes.ok) {
        idToken = signInData.idToken;
        uid = signInData.localId;
        console.log(`Successfully logged into ${email}, UID: ${uid}`);
      } else {
        console.log(`Could not log into ${email}:`, signInData.error?.message);
      }
    }
  } catch (e) {
    console.error("Error:", e);
  }

  if (uid && idToken) {
    // Ensure RTDB profile is role: "admin"
    const profile = {
      uid,
      fullName: "يوسف ايهاب (Admin)",
      phone: "01000000000",
      nationalId: "00000000000000",
      defaultStation: "creativa",
      role: "admin",
      createdAt: Date.now(),
    };

    const dbRes = await fetch(`${DATABASE_URL}/rakeb/users/${uid}.json?auth=${idToken}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (dbRes.ok) {
      console.log(`✅ Admin profile written to rakeb/users/${uid}`);
    } else {
      console.error(`Failed to write RTDB profile:`, await dbRes.text());
    }
  }

  process.exit(0);
}

fixAdmin();
