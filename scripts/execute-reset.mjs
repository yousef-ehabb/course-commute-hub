import fs from "fs";
import path from "path";

// 1. Read access token from configstore
const configPath = "C:\\Users\\ayhab\\.config\\configstore\\firebase-tools.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
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

const PROJECT_ID = "course-commute-hub";
const RTDB_URL = "https://course-commute-hub-default-rtdb.europe-west1.firebasedatabase.app";

async function executeReset() {
  console.log("==========================================");
  console.log("  STARTING FIREBASE RESET FOR RAKEB HUB   ");
  console.log("==========================================");

  token = await getFreshAccessToken();

  // Step 1: Backup current Realtime Database state
  console.log("\n📦 Step 1: Fetching current Realtime Database snapshot...");
  const dbRes = await fetch(`${RTDB_URL}/rakeb.json?access_token=${token}`);
  if (!dbRes.ok) {
    throw new Error(`Failed to fetch RTDB: ${dbRes.status} ${await dbRes.text()}`);
  }
  const fullRakebData = await dbRes.json();

  const scratchDir = path.resolve(process.cwd(), "scratch");
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const backupPath = path.join(scratchDir, "db_backup_before_reset.json");
  fs.writeFileSync(backupPath, JSON.stringify(fullRakebData, null, 2));
  console.log(`✅ Backup saved to: ${backupPath}`);

  // Step 2: Identify users to delete from RTDB and Auth
  const users = fullRakebData.users || {};
  const adminUids = new Set();
  const studentUids = new Set();

  for (const [uid, user] of Object.entries(users)) {
    if (user && user.role === "admin") {
      adminUids.add(uid);
    } else {
      studentUids.add(uid);
    }
  }

  // Fetch all Auth accounts to make sure no orphaned non-admin test account remains in Auth
  try {
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=1000`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (authRes.ok) {
      const authData = await authRes.json();
      const authUsers = authData.users || [];
      for (const u of authUsers) {
        if (!adminUids.has(u.localId)) {
          studentUids.add(u.localId);
        }
      }
    }
  } catch (e) {
    console.warn("Could not query full Auth list, proceeding with RTDB student list:", e);
  }

  const deleteUidsList = Array.from(studentUids);

  console.log(`\n👥 Admin UIDs to KEEP (${adminUids.size}):`, Array.from(adminUids));
  console.log(`❌ Student/Test UIDs to DELETE (${deleteUidsList.length}):`, deleteUidsList);

  // Step 3: Delete Student Auth Accounts via Identity Toolkit API
  if (deleteUidsList.length > 0) {
    console.log("\n🔐 Step 2: Deleting non-admin Firebase Auth accounts...");
    for (const uid of deleteUidsList) {
      console.log(`Deleting Auth account: ${uid}...`);
      const delRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchDelete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ localIds: [uid] }),
        }
      );

      if (delRes.ok) {
        console.log(`  ✅ Successfully deleted Auth user ${uid}`);
      } else {
        const errText = await delRes.text();
        console.warn(`  ⚠️ Warning deleting Auth user ${uid}: ${errText}`);
      }
    }
  }

  // Step 4: Clean up Realtime Database
  console.log("\n🗄️ Step 3: Cleaning Realtime Database...");

  // Keep only admin users in /rakeb/users
  const cleanedUsers = {};
  for (const uid of adminUids) {
    if (users[uid]) {
      cleanedUsers[uid] = users[uid];
    }
  }

  console.log("Updating /rakeb/users...");
  const putUsersRes = await fetch(`${RTDB_URL}/rakeb/users.json?access_token=${token}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanedUsers),
  });
  if (!putUsersRes.ok) {
    throw new Error(`Failed to update users: ${await putUsersRes.text()}`);
  }
  console.log("  ✅ /rakeb/users updated (only admins remain).");

  // Clear history nodes
  const nodesToClear = [
    "trips",
    "tripHistory",
    "dailyStatus",
    "auditLog",
    "vehicles",
    "boardingRecords",
  ];

  for (const node of nodesToClear) {
    console.log(`Clearing /rakeb/${node}...`);
    const delNodeRes = await fetch(`${RTDB_URL}/rakeb/${node}.json?access_token=${token}`, {
      method: "DELETE",
    });
    if (!delNodeRes.ok) {
      console.warn(`  ⚠️ Failed to clear /rakeb/${node}: ${await delNodeRes.text()}`);
    } else {
      console.log(`  ✅ /rakeb/${node} deleted.`);
    }
  }

  // Step 5: Verification
  console.log("\n🔍 Step 4: Verifying clean reset state...");
  const verifyRes = await fetch(`${RTDB_URL}/rakeb.json?access_token=${token}`);
  const verifyData = await verifyRes.json();

  console.log("\n--- RESET VERIFICATION ---");
  console.log("Root Keys Remaining in /rakeb:", Object.keys(verifyData));
  console.log("Users Remaining:", Object.keys(verifyData.users || {}));
  console.log("Stations Count:", Object.keys(verifyData.stations || {}).length);
  console.log("Settings Present:", !!verifyData.settings);
  console.log("Trips Present:", !!verifyData.trips);
  console.log("TripHistory Present:", !!verifyData.tripHistory);
  console.log("DailyStatus Present:", !!verifyData.dailyStatus);
  console.log("Vehicles Present:", !!verifyData.vehicles);
  console.log("BoardingRecords Present:", !!verifyData.boardingRecords);

  console.log("\n==========================================");
  console.log("  🎉 RESET COMPLETED SUCCESSFULLY!        ");
  console.log("==========================================");
}

let token;
executeReset().catch((err) => {
  console.error("❌ Error executing reset:", err);
  process.exit(1);
});
