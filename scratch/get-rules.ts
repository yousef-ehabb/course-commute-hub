import admin from "firebase-admin";

async function main() {
  admin.initializeApp();
  const db = admin.database();
  const rules = await db.getRules();
  console.log("RULES:", rules);
}

main().catch(console.error);
