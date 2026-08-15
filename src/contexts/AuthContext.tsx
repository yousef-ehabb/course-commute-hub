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

export type AccountStatus = "active" | "archived" | "deleted" | null;

export interface ArchivedProfile {
  profile: UserProfile;
  courseId: string;
}

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
  isEmailVerified: boolean;
  accountStatus: AccountStatus;
  archivedProfile: ArchivedProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    data: Omit<UserProfile, "uid" | "role" | "createdAt">,
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(null);
  const [archivedProfile, setArchivedProfile] = useState<ArchivedProfile | null>(null);

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
        const { onAuthStateChanged, signOut: firebaseSignOut } = await import("firebase/auth");
        const { ref, onValue, get, remove, set } = await import("firebase/database");

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
                async (snap) => {
                  if (!isMounted) return;
                  const val = snap.val() as UserProfile | null;

                  if (val) {
                    // Normal active user
                    setProfile({ ...val, uid: u.uid });
                    setAccountStatus("active");
                    setArchivedProfile(null);
                    resolved = true;
                    setLoading(false);
                    setError(null);
                    return;
                  }

                  // No profile found — check if deleted or archived
                  try {
                    // 1. Check if permanently deleted
                    try {
                      const deletedSnap = await get(ref(db, `rakeb/deletedUsers/${u.uid}`));
                      if (deletedSnap?.exists()) {
                        console.warn("[AuthContext] User was permanently deleted:", u.uid);
                        setProfile(null);
                        setAccountStatus("deleted");
                        setArchivedProfile(null);
                        resolved = true;
                        setLoading(false);
                        setError("تم حذف حسابك بواسطة المسؤول. تواصل مع الإدارة للمزيد.");
                        await firebaseSignOut(auth);
                        return;
                      }
                    } catch {
                      // Ignore permission error
                    }

                    // 2. Check if archived (course ended) via lightweight index
                    try {
                      const indexSnap = await get(ref(db, `rakeb/archivedUsersIndex/${u.uid}`));
                      if (indexSnap?.exists()) {
                        const { courseId: archivedCourseId } = indexSnap.val() as { courseId: string };
                        const archivedDataSnap = await get(
                          ref(db, `rakeb/archivedUsers/${archivedCourseId}/${u.uid}`)
                        );
                        if (archivedDataSnap?.exists()) {
                          const archivedData = archivedDataSnap.val() as UserProfile;
                          console.log("[AuthContext] Found archived user in course:", archivedCourseId);
                          setProfile(null);
                          setAccountStatus("archived");
                          setArchivedProfile({ profile: { ...archivedData, uid: u.uid }, courseId: archivedCourseId });
                          resolved = true;
                          setLoading(false);
                          setError(null);
                          return;
                        }
                      }
                    } catch {
                      // Ignore permission error
                    }

                    // Not found anywhere — truly new or incomplete profile
                    setProfile(null);
                    setAccountStatus(null);
                    setArchivedProfile(null);
                    resolved = true;
                    setLoading(false);
                    setError(null);
                  } catch (checkErr) {
                    console.error("[AuthContext] Error checking archived/deleted status:", checkErr);
                    setProfile(null);
                    setAccountStatus(null);
                    setArchivedProfile(null);
                    resolved = true;
                    setLoading(false);
                    setError(null);
                  }
                },
                (profileError) => {
                  if (!isMounted) return;
                  console.warn("[AuthContext] Profile read issue:", profileError);
                  if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(subscribeToProfile, 1000);
                  } else {
                    setProfile(null);
                    resolved = true;
                    setLoading(false);
                    setError(null);
                  }
                },
              );
            };

            subscribeToProfile();
          } else {
            setProfile(null);
            setAccountStatus(null);
            setArchivedProfile(null);
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

  const isEmailVerified = role === "admin" ? true : (user?.emailVerified ?? false);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");

    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (email, password, data) => {
    const { getFirebaseAuth, getFirebaseDb } = await import("@/lib/firebase");
    const { createUserWithEmailAndPassword, sendEmailVerification } = await import("firebase/auth");
    const { ref, set } = await import("firebase/database");
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    
    const actionCodeSettings = {
      url: typeof window !== "undefined" && window.location.origin
        ? `${window.location.origin}/student/home`
        : "https://rakeb.vercel.app/student/home",
      handleCodeInApp: true,
    };

    // Automatically send verification email upon successful registration
    await sendEmailVerification(cred.user, actionCodeSettings);

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      ...data,
      role: "student",
      createdAt: Date.now(),
    };
    await set(ref(getFirebaseDb(), `rakeb/users/${cred.user.uid}`), newProfile);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    const { getFirebaseAuth } = await import("@/lib/firebase");
    const { sendEmailVerification } = await import("firebase/auth");
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      const actionCodeSettings = {
        url: typeof window !== "undefined" && window.location.origin
          ? `${window.location.origin}/student/home`
          : "https://rakeb.vercel.app/student/home",
        handleCodeInApp: true,
      };
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
    }
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
      isEmailVerified,
      accountStatus,
      archivedProfile,
      signIn,
      signInWithGoogle,
      signUp,
      signOutUser,
      sendVerificationEmail,
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
      isEmailVerified,
      accountStatus,
      archivedProfile,
      signIn,
      signInWithGoogle,
      signUp,
      signOutUser,
      sendVerificationEmail,
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
