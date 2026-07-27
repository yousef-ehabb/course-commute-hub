import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, ref, push, type Database } from "firebase/database";

const config = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ??
    "AIzaSyDtMDGt0gg7hxRWpDpxh9LwMwnM_omAzVw",
  authDomain: "pulse-live-ayhab.firebaseapp.com",
  databaseURL: "https://pulse-live-ayhab-default-rtdb.firebaseio.com",
  projectId: "pulse-live-ayhab",
  storageBucket: "pulse-live-ayhab.firebasestorage.app",
  messagingSenderId: "898945341763",
  appId: "1:898945341763:web:5ce81c592757c98f8677f6",
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(config) : getApp();
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getFirebaseDb() {
  if (!_db) {
    if (import.meta.env.DEV) {
      console.warn("[Firebase] Initializing Realtime Database instance...");
    }
    _db = getDatabase(getFirebaseApp());
    // @ts-ignore
    if (typeof window !== "undefined") {
      // @ts-ignore
      window.db = _db;
      // @ts-ignore
      window.push = push;
      // @ts-ignore
      window.ref = ref;
    }
  }
  return _db;
}
