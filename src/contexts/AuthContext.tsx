import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    data: Omit<UserProfile, "uid" | "role" | "createdAt">,
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let profileUnsub: (() => void) | undefined;
    (async () => {
      const { isFirebaseConfigured, getFirebaseAuth, getFirebaseDb } = await import(
        "@/lib/firebase"
      );
      setConfigured(isFirebaseConfigured);
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }
      const { onAuthStateChanged } = await import("firebase/auth");
      const { ref, onValue } = await import("firebase/database");
      const auth = getFirebaseAuth();
      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        profileUnsub?.();
        profileUnsub = undefined;
        if (u) {
          const db = getFirebaseDb();
          const r = ref(db, `rakeb/users/${u.uid}`);
          profileUnsub = onValue(r, (snap) => {
            const val = snap.val() as UserProfile | null;
            setProfile(val ? { ...val, uid: u.uid } : null);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      });
    })();
    return () => {
      unsub?.();
      profileUnsub?.();
    };
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, data) => {
    const { getFirebaseAuth, getFirebaseDb } = await import("@/lib/firebase");
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { ref, set } = await import("firebase/database");
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    const profile: UserProfile = {
      uid: cred.user.uid,
      ...data,
      role: "student",
      createdAt: Date.now(),
    };
    await set(ref(getFirebaseDb(), `rakeb/users/${cred.user.uid}`), profile);
  };

  const signOutUser = async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { signOut } = await import("firebase/auth");
    await signOut(getFirebaseAuth());
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, configured, signIn, signUp, signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}