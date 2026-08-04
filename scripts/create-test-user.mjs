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

// ── Auth helpers ──────────────────────────────────────────────────────────
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
    throw new Error(`Sign-up failed for ${email}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

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
    throw new Error(`Update display name failed: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

// 1. Read access token from configstore
const configPath = "C:\\Users\\ayhab\\.config\\configstore\\firebase-tools.json";
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {}

let accessToken = config?.tokens?.access_token;
const refreshToken = config?.tokens?.refresh_token;

async function getFreshAccessToken() {
  if (!refreshToken) return accessToken;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const data = await res.json();
    if (data.access_token) return data.access_token;
  } catch (e) {}
  return accessToken;
}

async function writeProfile(uid, fullName, idToken) {
  const profile = {
    uid,
    fullName,
    phone: "01000000000",
    nationalId: "12345678901234",
    defaultStation: "station_1",
    role: "test_student",
    isTestAccount: true,
    createdAt: Date.now(),
  };

  const adminToken = await getFreshAccessToken();
  const dbRes = await fetch(
    `${DATABASE_URL}/rakeb/users/${uid}.json?access_token=${adminToken}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }
  );

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    throw new Error(`Failed to write profile for ${uid}: ${errText}`);
  }
}

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
    throw new Error(`Sign-in failed for ${email}: ${data.error?.message || JSON.stringify(data)}`);
  return data;
}

// ── Main Script ──────────────────────────────────────────────────────────
async function main() {
  const testUser = {
    email: "test_student@rakeb.com",
    password: "Password123!",
    displayName: "حساب تجريبي (طالب)",
  };

  console.log(`\n👨‍🎓 Creating test student user: ${testUser.email}...`);

  let authData;
  try {
    authData = await signUp(testUser.email, testUser.password);
    console.log(`✅ User created! UID: ${authData.localId}`);
  } catch (err) {
    if (err.message.includes("EMAIL_EXISTS")) {
      console.log(`⚠️ User ${testUser.email} already exists. Logging in to get token...`);
      authData = await signIn(testUser.email, testUser.password);
      console.log(`✅ Logged in successfully! UID: ${authData.localId}`);
    } else {
      throw err;
    }
  }

  const { idToken, localId } = authData;

  console.log(`📝 Updating display name to: ${testUser.displayName}`);
  await updateDisplayName(idToken, testUser.displayName);

  console.log(`📝 Writing profile to RTDB with role 'test_student'...`);
  await writeProfile(localId, testUser.displayName, idToken);

  console.log(`\n🎉 Test Student Account Ready!`);
  console.log(`Email: ${testUser.email}`);
  console.log(`Password: ${testUser.password}`);
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
