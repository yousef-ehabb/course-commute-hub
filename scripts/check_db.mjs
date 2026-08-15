import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get, set } from "firebase/database";

const config = {
  apiKey: "AIzaSyD05Coab-Dn-xU2GkvOJKnUH9gyBK9gos4",
  authDomain: "course-commute-hub.firebaseapp.com",
  databaseURL: "https://course-commute-hub-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "course-commute-hub",
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getDatabase(app);

const passwords = ["Password123!", "admin123", "admin@123", "123456", "admin1234"];

async function checkAdmin0() {
  for (const pwd of passwords) {
    try {
      const cred = await signInWithEmailAndPassword(auth, "admin@rakeb.com", pwd);
      const uid = cred.user.uid;
      console.log(`SUCCESS login admin@rakeb.com with pwd "${pwd}" -> UID: ${uid}`);
      const userSnap = await get(ref(db, `rakeb/users/${uid}`));
      console.log(`DB profile for ${uid}:`, userSnap.val());
      
      // Test course creation
      try {
        const testRef = ref(db, `rakeb/courses/test-${uid.slice(0, 5)}`);
        await set(testRef, { id: "test", name: "test", status: "test" });
        await set(testRef, null);
        console.log(`   -> Course creation test: SUCCESS`);
      } catch (err) {
        console.log(`   -> Course creation test: FAILED (${err.message})`);
      }
      break;
    } catch (e) {
      console.log(`Failed pwd "${pwd}": ${e.message}`);
    }
  }
  process.exit(0);
}

checkAdmin0();
