import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import type { UserProfile, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    data: Omit<UserProfile, "uid" | "role" | "createdAt">,
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Incrementing retryKey forces the effect to re-run
  const [retryKey, setRetryKey] = useState(0);

  const role = profile?.role ?? null;
  const isAuthenticated = !!user && !!profile;
  const isAdmin = isAuthenticated && role === "admin";
  const isStudent = isAuthenticated && role === "student";

  const retryAuth = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let profileUnsub: (() => void) | undefined;
    let resolved = false;

    // Safety timeout — if auth never resolves within 10 seconds, show error state
    // This prevents the app from being permanently stuck on a spinner
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        console.warn("[AuthContext] Safety timeout: auth did not resolve within 10s");
        resolved = true;
        setLoading(false);
        setError("تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.");
      }
    }, 10_000);

    let isMounted = true;

    (async () => {
      try {
        const { isFirebaseConfigured, getFirebaseAuth, getFirebaseDb } =
          await import("@/lib/firebase");
        if (!isMounted) return;

        setConfigured(isFirebaseConfigured);
        if (!isFirebaseConfigured) {
          resolved = true;
          setLoading(false);
          return;
        }
        const { onAuthStateChanged } = await import("firebase/auth");
        const { ref, onValue } = await import("firebase/database");

        if (!isMounted) return;

        const auth = getFirebaseAuth();
        unsub = onAuthStateChanged(auth, (u) => {
          if (!isMounted) return;
          setUser(u);
          profileUnsub?.();
          profileUnsub = undefined;
          if (u) {
            const db = getFirebaseDb();
            const r = ref(db, `rakeb/users/${u.uid}`);
            let attempts = 0;
            const maxAttempts = 5;

            const subscribeToProfile = () => {
              profileUnsub?.();
              profileUnsub = onValue(
                r,
                (snap) => {
                  if (!isMounted) return;
                  const val = snap.val() as UserProfile | null;
                  setProfile(val ? { ...val, uid: u.uid } : null);
                  resolved = true;
                  setLoading(false);
                  setError(null);
                },
                (profileError) => {
                  if (!isMounted) return;
                  console.error("[AuthContext] Failed to read user profile:", profileError);
                  if (attempts < maxAttempts) {
                    attempts++;
                    console.log(
                      `[AuthContext] Retrying profile read (attempt ${attempts}/${maxAttempts})...`,
                    );
                    setTimeout(subscribeToProfile, 1000);
                  } else {
                    setProfile(null);
                    resolved = true;
                    setLoading(false);
                    setError("فشل تحميل بيانات الحساب");
                  }
                },
              );
            };

            subscribeToProfile();
          } else {
            setProfile(null);
            resolved = true;
            setLoading(false);
            setError(null);
          }
        });
      } catch (err) {
        if (!isMounted) return;
        // Dynamic import or Firebase init failed — don't leave the app stuck
        console.error("[AuthContext] Initialization failed:", err);
        resolved = true;
        setLoading(false);
        setError("فشل تهيئة التطبيق");
      }
    })();
    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsub?.();
      profileUnsub?.();
    };
  }, [retryKey]);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (email, password, data) => {
    const { getFirebaseAuth, getFirebaseDb } = await import("@/lib/firebase");
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { ref, set } = await import("firebase/database");
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      ...data,
      role: "student",
      createdAt: Date.now(),
    };
    await set(ref(getFirebaseDb(), `rakeb/users/${cred.user.uid}`), newProfile);
  }, []);

  const signOutUser = useCallback(async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { signOut } = await import("firebase/auth");
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role,
      isAuthenticated,
      isAdmin,
      isStudent,
      loading,
      configured,
      error,
      signIn,
      signUp,
      signOutUser,
      retryAuth,
    }),
    [
      user,
      profile,
      role,
      isAuthenticated,
      isAdmin,
      isStudent,
      loading,
      configured,
      error,
      signIn,
      signUp,
      signOutUser,
      retryAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
