import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import fs from "fs";

async function seedAdmin() {
  const testEnv = await initializeTestEnvironment({
    projectId: "course-commute-hub-default-rtdb",
    database: {
      rules: fs.readFileSync("database.rules.json", "utf8"),
      host: "127.0.0.1",
      port: 9000,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.database();
    
    // Replace this with the actual UID of the admin user from Auth Emulator
    // Or just seed a few common test UIDs.
    // If you know your UID, put it here:
    const adminUid = process.argv[2] || "admin-test-001";
    
    await db.ref(`rakeb/users/${adminUid}`).set({ 
      role: "admin", 
      fullName: "Local Admin" 
    });
    
    console.log(`✅ Admin role seeded for UID: ${adminUid}`);
  });
  
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
