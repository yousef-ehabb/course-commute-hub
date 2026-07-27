import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";

const config = {
  apiKey: "AIzaSyD05Coab-Dn-xU2GkvOJKnUH9gyBK9gos4",
  authDomain: "course-commute-hub.firebaseapp.com",
  databaseURL: "https://course-commute-hub-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "course-commute-hub",
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getDatabase(app);

async function test() {
  try {
    console.log("Signing in as student...");
    const cred = await signInWithEmailAndPassword(auth, "admin@rakeb.com", "admin123");
    console.log("Signed in as:", cred.user.uid);

    console.log("Fetching profile...");
    try {
      const profileSnap = await get(ref(db, `rakeb/users/${cred.user.uid}`));
      console.log("Profile data:", profileSnap.val());
    } catch (e) {
      console.error("Profile Error:", e.message);
    }

    console.log("Fetching stations...");
    try {
      const stationsSnap = await get(ref(db, `rakeb/stations`));
      console.log("Stations count:", stationsSnap.val() ? stationsSnap.val().length : 0);
    } catch (e) {
      console.error("Stations Error:", e.message);
    }

    process.exit(0);
  } catch (e) {
    console.error("Fatal Error:", e);
    process.exit(1);
  }
}

test();
