import fs from "fs";
import path from "path";

// 1. Read access token from configstore
const configPath = "C:\\Users\\ayhab\\.config\\configstore\\firebase-tools.json";
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {
  console.error("Could not read firebase-tools config:", e);
  process.exit(1);
}

let accessToken = config.tokens?.access_token;
const refreshToken = config.tokens?.refresh_token;

// Function to refresh token if needed
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
    if (data.access_token) {
      console.log("🔑 Refreshed Google Access Token successfully.");
      return data.access_token;
    }
  } catch (e) {
    console.error("Token refresh error:", e);
  }
  return accessToken;
}

// Ensure you run this inside a Firebase project dir so `.firebaserc` exists,
// OR manually set PROJECT_ID
let PROJECT_ID = "course-commute-hub";
try {
  const rc = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
  PROJECT_ID = rc.projects?.default || PROJECT_ID;
} catch (e) {}

const RTDB_URL = `https://${PROJECT_ID}-default-rtdb.europe-west1.firebasedatabase.app`;

async function main() {
  const token = await getFreshAccessToken();
  if (!token) {
    console.error("❌ Could not get valid access token. Please run `firebase login` first.");
    process.exit(1);
  }
  
  const targetDate = process.argv[2] || "2026-08-05";
  console.log(`\n🧹 Cleaning up data for date: ${targetDate}\n`);

  const nodesToClear = [
    `rakeb/trips/default/${targetDate}`,
    `rakeb/tripHistory/${targetDate}`,
    `rakeb/dailyStatus/default/${targetDate}`,
    `rakeb/vehicles/default/${targetDate}`,
    `rakeb/boardingRecords/${targetDate}`,
  ];

  for (const node of nodesToClear) {
    console.log(`Deleting /${node}...`);
    const delNodeRes = await fetch(`${RTDB_URL}/${node}.json?access_token=${token}`, {
      method: "DELETE",
    });
    if (delNodeRes.ok) {
      console.log(`  ✅ Successfully deleted /${node}`);
    } else {
      console.error(`  ❌ Failed to delete /${node}: ${await delNodeRes.text()}`);
    }
  }

  console.log("\n✨ Cleanup finished!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
});
