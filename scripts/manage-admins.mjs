import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf8").split("\n");
  envConfig.forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  });
}

const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL;

if (!API_KEY || !DATABASE_URL) {
  console.error(
    "Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_DATABASE_URL in .env"
  );
  process.exit(1);
}

// ── Active admin team ─────────────────────────────────────────────
const EXISTING_ADMINS = [
  {
    email: "admin@rakeb.com",
    password: "Password123!",
    displayName: "يوسف ايهاب",
  },
  {
    email: "admin1@rakeb.com",
    password: "Sh101admin",
    displayName: "شيماء نشأت",
  },
  {
    email: "admin2@rakeb.com",
    password: "No102admin",
    displayName: "نورهان أشرف",
  },
  {
    email: "admin3@rakeb.com",
    password: "Ag103admin",
    displayName: "أجيا رومانى",
  },
  {
    email: "admin4@rakeb.com",
    password: "Mo104admin",
    displayName: "محمد عبدالرحمن",
  },
  {
    email: "admin5@rakeb.com",
    password: "Mo105admin",
    displayName: "محمد خالد",
  },
  {
    email: "admin6@rakeb.com",
    password: "Ha106admin",
    displayName: "حلا عماد",
  },
  {
    email: "admin7@rakeb.com",
    password: "Al107admin",
    displayName: "الزهراء محمد",
  },
  {
    email: "admin8@rakeb.com",
    password: "Yo108admin",
    displayName: "يسرا بهاء",
  },
  {
    email: "admin9@rakeb.com",
    password: "Ra109admin",
    displayName: "رحيق سيد",
  },
  {
    email: "admin10@rakeb.com",
    password: "Ya110admin",
    displayName: "ياسمين أحمد",
  },
  {
    email: "admin11@rakeb.com",
    password: "Password123!",
    displayName: "مكاريوس منير",
  },
  {
    email: "admin12@rakeb.com",
    password: "Pe111admin",
    displayName: "بيتر ميلاد",
  },
  {
    email: "admin13@rakeb.com",
    password: "Na112admin",
    displayName: "ندي عبدالهادي",
  },
];

// ── New admins (empty now, all provisioned) ───────────────────────
const NEW_ADMINS = [];

// Sign in and get idToken + uid
async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      `Sign-in failed for ${email}: ${data.error?.message || JSON.stringify(data)}`
    );
  return data;
}

// Sign up a new account
async function signUp(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      `Sign-up failed for ${email}: ${data.error?.message || JSON.stringify(data)}`
    );
  return data;
}

// Update display name via Identity Toolkit
async function updateDisplayName(idToken, displayName) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        displayName,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      `Update display name failed: ${data.error?.message || JSON.stringify(data)}`
    );
  return data;
}

// Write admin profile to Realtime Database
async function writeProfile(uid, fullName, idToken) {
  const profile = {
    uid,
    fullName,
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
    throw new Error(`Failed to write profile for ${fullName}: ${dbError}`);
  }
}

// Update fullName in existing DB profile (PATCH to avoid overwriting)
async function updateDbFullName(uid, fullName, idToken) {
  const dbRes = await fetch(
    `${DATABASE_URL}/rakeb/users/${uid}/fullName.json?auth=${idToken}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullName),
    }
  );

  if (!dbRes.ok) {
    const dbError = await dbRes.text();
    throw new Error(`Failed to update DB fullName for ${fullName}: ${dbError}`);
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Updating existing admin display names...");
  console.log("═══════════════════════════════════════════════\n");

  for (const admin of EXISTING_ADMINS) {
    try {
      const signInData = await signIn(admin.email, admin.password);
      await updateDisplayName(signInData.idToken, admin.displayName);
      await updateDbFullName(
        signInData.localId,
        admin.displayName,
        signInData.idToken
      );
      console.log(`✅ ${admin.email} → ${admin.displayName}`);
    } catch (err) {
      console.error(`❌ ${admin.email}: ${err.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Creating new admin accounts...");
  console.log("═══════════════════════════════════════════════\n");

  // Get an existing admin token to write new admin profiles
  let adminToken;
  try {
    const admin1SignIn = await signIn("admin1@rakeb.com", "Password123!");
    adminToken = admin1SignIn.idToken;
  } catch (e) {
    console.error("Could not sign in as admin1 to get admin token:", e);
  }

  for (const admin of NEW_ADMINS) {
    try {
      let signUpData;
      try {
        signUpData = await signUp(admin.email, admin.password);
        console.log(
          `  Created auth user ${admin.email} (UID: ${signUpData.localId})`
        );
      } catch (err) {
        if (err.message.includes("EMAIL_EXISTS")) {
          console.log(`  ${admin.email} already exists, signing in...`);
          signUpData = await signIn(admin.email, admin.password);
        } else {
          throw err;
        }
      }

      await updateDisplayName(signUpData.idToken, admin.displayName);
      await writeProfile(
        signUpData.localId,
        admin.displayName,
        adminToken || signUpData.idToken
      );
      console.log(`✅ ${admin.email} → ${admin.displayName}`);
    } catch (err) {
      console.error(`❌ ${admin.email}: ${err.message}`);
    }
  }

  console.log("\n✨ Done!");
}

main();
