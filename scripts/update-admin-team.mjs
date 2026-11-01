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
  console.error("Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_DATABASE_URL in .env");
  process.exit(1);
}

// 12 Admin accounts configuration
// Passwords format: [First 2 letters in English] + [3 numbers] + [admin]
const TARGET_ADMINS = [
  {
    email: "admin1@rakeb.com",
    oldPassword: "Password123!",
    password: "Sh101admin",
    displayName: "شيماء نشأت",
    isExisting: true,
  },
  {
    email: "admin2@rakeb.com",
    oldPassword: "Password123!",
    password: "No102admin",
    displayName: "نورهان أشرف",
    isExisting: true,
  },
  {
    email: "admin3@rakeb.com",
    oldPassword: "Password123!",
    password: "Ag103admin",
    displayName: "أجيا رومانى",
    isExisting: true,
  },
  {
    email: "admin4@rakeb.com",
    oldPassword: "Password123!",
    password: "Mo104admin",
    displayName: "محمد عبدالرحمن",
    isExisting: true,
  },
  {
    email: "admin5@rakeb.com",
    oldPassword: "Password123!",
    password: "Mo105admin",
    displayName: "محمد خالد",
    isExisting: true,
  },
  {
    email: "admin6@rakeb.com",
    oldPassword: "Password123!",
    password: "Ha106admin",
    displayName: "حلا عماد",
    isExisting: true,
  },
  {
    email: "admin7@rakeb.com",
    oldPassword: "Password123!",
    password: "Al107admin",
    displayName: "الزهراء محمد",
    isExisting: true,
  },
  {
    email: "admin8@rakeb.com",
    oldPassword: "Password123!",
    password: "Yo108admin",
    displayName: "يسرا بهاء",
    isExisting: true,
  },
  {
    email: "admin9@rakeb.com",
    oldPassword: "Password123!",
    password: "Ra109admin",
    displayName: "رحيق سيد",
    isExisting: true,
  },
  {
    email: "admin10@rakeb.com",
    oldPassword: "Password123!",
    password: "Ya110admin",
    displayName: "ياسمين أحمد",
    isExisting: true,
  },
  {
    email: "admin12@rakeb.com",
    password: "Pe111admin",
    displayName: "بيتر ميلاد",
    isExisting: false,
  },
  {
    email: "admin13@rakeb.com",
    password: "Na112admin",
    displayName: "ندي عبدالهادي",
    isExisting: false,
  },
];

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
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data;
}

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
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data;
}

async function updateAccount(idToken, displayName, password) {
  const body = { idToken, returnSecureToken: true };
  if (displayName) body.displayName = displayName;
  if (password) body.password = password;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data;
}

async function writeAdminProfile(uid, fullName, idToken) {
  const profile = {
    uid,
    fullName,
    phone: "01000000000",
    nationalId: "00000000000000",
    defaultStation: "creativa",
    role: "admin",
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
    const errorText = await dbRes.text();
    throw new Error(`Failed to write RTDB profile: ${errorText}`);
  }
}

async function run() {
  console.log("═════════════════════════════════════════════════════════════════");
  console.log("🔄 Updating & Provisioning Admin Accounts in Firebase Auth & RTDB");
  console.log("═════════════════════════════════════════════════════════════════\n");

  const results = [];

  for (const admin of TARGET_ADMINS) {
    console.log(`Processing: ${admin.email} (${admin.displayName})...`);
    try {
      let uid;
      let activeToken;

      if (admin.isExisting) {
        // Try signing in with old password first, or new password if already changed
        let authData;
        try {
          authData = await signIn(admin.email, admin.oldPassword);
        } catch (e) {
          if (e.message.includes("INVALID_LOGIN_CREDENTIALS") || e.message.includes("INVALID_PASSWORD")) {
            // Might have already been updated
            authData = await signIn(admin.email, admin.password);
          } else {
            throw e;
          }
        }

        uid = authData.localId;
        // Update password and display name
        const updateData = await updateAccount(authData.idToken, admin.displayName, admin.password);
        activeToken = updateData.idToken;

        // Write/update admin profile in RTDB
        await writeAdminProfile(uid, admin.displayName, activeToken);

        console.log(`  ✅ Successfully updated ${admin.email} -> ${admin.displayName} (UID: ${uid})`);
        results.push({ email: admin.email, name: admin.displayName, password: admin.password, status: "UPDATED", uid });
      } else {
        // New account (admin12 or admin13)
        let authData;
        try {
          authData = await signUp(admin.email, admin.password);
        } catch (e) {
          if (e.message.includes("EMAIL_EXISTS")) {
            // Already exists, sign in and update
            try {
              authData = await signIn(admin.email, admin.password);
            } catch (err) {
              authData = await signIn(admin.email, "Password123!");
              const up = await updateAccount(authData.idToken, admin.displayName, admin.password);
              authData = up;
            }
          } else {
            throw e;
          }
        }

        uid = authData.localId;
        const updateData = await updateAccount(authData.idToken, admin.displayName, null);
        activeToken = updateData.idToken || authData.idToken;

        await writeAdminProfile(uid, admin.displayName, activeToken);

        console.log(`  ✅ Successfully created ${admin.email} -> ${admin.displayName} (UID: ${uid})`);
        results.push({ email: admin.email, name: admin.displayName, password: admin.password, status: "CREATED", uid });
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${admin.email}:`, err.message);
      results.push({ email: admin.email, name: admin.displayName, password: admin.password, status: `ERROR: ${err.message}` });
    }
  }

  console.log("\n═════════════════════════════════════════════════════════════════");
  console.log("🔍 VERIFYING LOGIN FOR ALL 12 ADMIN ACCOUNTS");
  console.log("═════════════════════════════════════════════════════════════════\n");

  let verifiedCount = 0;
  for (const admin of TARGET_ADMINS) {
    try {
      const verifyRes = await signIn(admin.email, admin.password);
      if (verifyRes.idToken) {
        console.log(`  ✅ [VERIFIED] ${admin.email} (${admin.displayName}) logged in successfully with ${admin.password}`);
        verifiedCount++;
      }
    } catch (err) {
      console.error(`  ❌ [FAILED] ${admin.email}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Verification Complete: ${verifiedCount} / ${TARGET_ADMINS.length} accounts verified.\n`);
}

run();

