import fs from "fs";
import path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8').split('\n');
  envConfig.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL;

if (!API_KEY || !DATABASE_URL) {
  console.error("Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_DATABASE_URL in .env");
  process.exit(1);
}

const ADMINS = [
  { email: "admin1@rakeb.com", fullName: "Admin 1", password: "Password123!" },
  { email: "admin2@rakeb.com", fullName: "Admin 2", password: "Password123!" },
  { email: "admin3@rakeb.com", fullName: "Admin 3", password: "Password123!" },
];

async function initAdmins() {
  console.log("Initializing Admin Accounts...");

  for (const admin of ADMINS) {
    try {
      // 1. Create User via Identity Toolkit
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: admin.email,
            password: admin.password,
            returnSecureToken: true,
          }),
        }
      );

      const signUpData = await signUpRes.json();

      let uid = signUpData.localId;
      let idToken = signUpData.idToken;

      if (!signUpRes.ok) {
        if (signUpData.error?.message === "EMAIL_EXISTS") {
          console.log(`User ${admin.email} already exists. Logging in to get token...`);
          const signInRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: admin.email,
                password: admin.password,
                returnSecureToken: true,
              }),
            }
          );
          const signInData = await signInRes.json();
          if (!signInRes.ok) {
             throw new Error(`Failed to login user ${admin.email}: ${signInData.error?.message || JSON.stringify(signInData)}`);
          }
          uid = signInData.localId;
          idToken = signInData.idToken;
        } else {
          throw new Error(`Failed to create user ${admin.email}: ${signUpData.error?.message || JSON.stringify(signUpData)}`);
        }
      }

      console.log(`Created user ${admin.email} with UID: ${uid}`);

      // 2. Set Profile in Realtime Database
      const profile = {
        uid: uid,
        fullName: admin.fullName,
        phone: "01000000000",
        nationalId: "00000000000000",
        defaultStation: "creativa",
        role: "admin",
        createdAt: Date.now(),
      };

      const dbRes = await fetch(
        `${DATABASE_URL}/rakeb/users/${uid}.json?auth=${idToken}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        }
      );

      if (!dbRes.ok) {
        const dbError = await dbRes.text();
        throw new Error(`Failed to write profile for ${admin.email}: ${dbError}`);
      }

      console.log(`Successfully configured profile for ${admin.fullName}`);
    } catch (error) {
      console.error(`Error processing ${admin.email}:`, error);
    }
  }

  console.log("Admin initialization complete.");
}

initAdmins();
