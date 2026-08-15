import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourse } from "@/contexts/CourseContext";
import { DEFAULT_CUTOFF_TIME } from "@/lib/constants";

interface ActiveDateContextValue {
  activeDateKey: string;
  cutoffTime: string;
  cutoffEnabled: boolean;
  forceLock: boolean;
  loaded: boolean;
  /**
   * Firebase server time offset in milliseconds.
   * Add to Date.now() to get approximate server time.
   * Prevents users from bypassing deadlines by changing device clock.
   */
  serverTimeOffset: number;
  /** Get approximate server time (Date.now() + offset) */
  getServerTime: () => number;
}

const ActiveDateContext = createContext<ActiveDateContextValue | null>(null);

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ActiveDateProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { courseId } = useCourse();
  const [activeDateKey, setActiveDateKey] = useState<string>(getTodayKey());
  const [cutoffTime, setCutoffTime] = useState<string>(DEFAULT_CUTOFF_TIME);
  const [cutoffEnabled, setCutoffEnabled] = useState<boolean>(true);
  const [forceLock, setForceLock] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const getServerTime = useCallback(() => Date.now() + serverTimeOffset, [serverTimeOffset]);

  useEffect(() => {
    let isMounted = true;
    let unsub: (() => void) | undefined;
    let offsetUnsub: (() => void) | undefined;

    if (authLoading) return;

    if (!user) {
      if (isMounted) setLoaded(true);
      return;
    }

    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, onValue } = await import("firebase/database");

        if (!isMounted) return;

        const db = getFirebaseDb();

        // Subscribe to server time offset
        offsetUnsub = onValue(
          ref(db, ".info/serverTimeOffset"),
          (snap) => {
            if (!isMounted) return;
            setServerTimeOffset((snap.val() as number) ?? 0);
          },
          () => {
            // Silently ignore — offset defaults to 0
          },
        );

        // Subscribe to settings — now course-scoped
        const path = `rakeb/settings/${courseId}`;
        unsub = onValue(
          ref(db, path),
          (snap) => {
            if (!isMounted) return;
            const val = snap.val();
            if (val) {
              if (val.activeDateKey) setActiveDateKey(val.activeDateKey);
              if (val.cutoffTime !== undefined) setCutoffTime(val.cutoffTime);
              if (val.cutoffEnabled !== undefined) setCutoffEnabled(val.cutoffEnabled);
              if (val.forceLock !== undefined) setForceLock(val.forceLock);
            }
            setLoaded(true);
          },
          (error) => {
            console.error("[ActiveDate] Listener error:", error);
            if (isMounted) setLoaded(true);
          },
        );
      } catch (err) {
        console.error("[ActiveDate] Init failed:", err);
        if (isMounted) setLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
      unsub?.();
      offsetUnsub?.();
    };
  }, [user, authLoading, courseId]);

  return (
    <ActiveDateContext.Provider
      value={{ activeDateKey, cutoffTime, cutoffEnabled, forceLock, loaded, serverTimeOffset, getServerTime }}
    >
      {children}
    </ActiveDateContext.Provider>
  );
}

export function useActiveDate(): ActiveDateContextValue {
  const ctx = useContext(ActiveDateContext);
  if (!ctx) throw new Error("useActiveDate must be used within ActiveDateProvider");
  return ctx;
}
