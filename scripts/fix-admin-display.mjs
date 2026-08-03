import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
const envConfig = fs.readFileSync(envPath, "utf8").split("\n");
const env = {};
envConfig.forEach((line) => {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join("=").trim();
  }
});

const API_KEY = env.VITE_FIREBASE_API_KEY;

// Sign in
const signInRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@rakeb.com",
      password: "AdminPassword123!",
      returnSecureToken: true,
    }),
  }
);
const signInData = await signInRes.json();
if (signInData.error) {
  console.error("Sign-in failed:", signInData.error.message);
  process.exit(1);
}

// Update display name
const updateRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: signInData.idToken,
      displayName: "يوسف ايهاب",
      returnSecureToken: true,
    }),
  }
);
const updateData = await updateRes.json();
if (updateData.error) {
  console.error("Update failed:", updateData.error.message);
} else {
  console.log("✅ Display name set to:", updateData.displayName);
}
