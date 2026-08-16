import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { useCourse } from "@/contexts/CourseContext";
import type { UserProfile } from "@/types";

export interface DailyRecord {
  id: string;
  status: string;
  station: string;
  fullName: string;
  phone: string;
  boarded?: boolean;
  isStaff?: boolean;
  customLocation?: { lat: number; lng: number; name?: string };
  updatedAt?: number;
  [key: string]: any;
}

interface TodayStatusContextValue {
  /** Raw snapshot value (object keyed by uid) */
  raw: Record<string, any> | null;
  /** Parsed records array — includes explicit records only */
  records: DailyRecord[];
  /** Today's date key (YYYY-MM-DD) */
  todayKey: string;
  /** Whether the listener has fired at least once */
  loaded: boolean;
  /** Error if the listener failed */
  error: Error | null;
  /** Force retry the connection */
  retry: () => void;
  /** Helper to get combined explicit and implicit records for all passengers (students + staff) */
  getAllStudentsStatus: (users: UserProfile[]) => DailyRecord[];
}

const TodayStatusContext = createContext<TodayStatusContextValue | null>(null);

export function TodayStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeDateKey, loaded: activeDateLoaded } = useActiveDate();
  const { courseId } = useCourse();
  const [raw, setRaw] = useState<Record<string, any> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user || !activeDateLoaded) {
      setRaw(null);
      setLoaded(true);
      return;
    }

    let unsub: (() => void) | undefined;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");

      const path = `rakeb/dailyStatus/${courseId}/${activeDateKey}`;
      unsub = onValue(
        ref(getFirebaseDb(), path),
        (snap) => {
          setRaw(snap.val());
          setLoaded(true);
          setError(null);
        },
        (err) => {
          console.error("[TodayStatus] Listener error:", err);
          setError(err);
          setLoaded(true);
        },
      );
    })().catch((err) => {
      console.error("[TodayStatus] Init failed:", err);
      setError(err);
      setLoaded(true);
    });

    return () => unsub?.();
  }, [user, activeDateKey, activeDateLoaded, retryCount, courseId]);

  const retry = useCallback(() => {
    setError(null);
    setLoaded(false);
    setRetryCount((c) => c + 1);
  }, []);

  const records = useMemo<DailyRecord[]>(() => {
    if (!raw) return [];
    return Object.keys(raw).map((uid) => ({
      id: uid,
      ...raw[uid],
    }));
  }, [raw]);

  const getAllStudentsStatus = useCallback(
    (users: UserProfile[]) => {
      // 1. Process course students (defaults to riding unless explicit record)
      const studentRecords = users
        .filter((u) => u.role === "student")
        .map((u) => {
          const explicitRecord = records.find((r) => r.id === u.uid);
          const defaultStation = u.defaultStation || "unknown";
          const defaultStatus = "riding";

          return {
            id: u.uid,
            status: explicitRecord?.status ?? defaultStatus,
            station: explicitRecord?.station ?? defaultStation,
            fullName: explicitRecord?.fullName || u.fullName || "طالب",
            phone: explicitRecord?.phone || u.phone || "",
            boarded: Boolean(explicitRecord?.boarded),
            isStaff: false,
            customLocation: explicitRecord?.customLocation || u.customLocation,
            updatedAt: explicitRecord?.updatedAt,
          };
        });

      const studentIds = new Set(studentRecords.map((s) => s.id));

      // 2. Process staff / admin daily records (opt-in transportation status)
      const staffRecords: DailyRecord[] = records
        .filter(
          (r) =>
            !studentIds.has(r.id) &&
            (r.isStaff === true || r.status === "riding" || r.status === "cancelled"),
        )
        .map((r) => {
          const adminUser = users.find((u) => u.uid === r.id);
          return {
            id: r.id,
            status: r.status,
            station: r.station || adminUser?.defaultStation || "",
            fullName: r.fullName || adminUser?.fullName || "موظف",
            phone: r.phone || adminUser?.phone || "",
            boarded: Boolean(r.boarded),
            isStaff: true,
            customLocation: r.customLocation || adminUser?.customLocation,
            updatedAt: r.updatedAt,
          };
        });

      return [...studentRecords, ...staffRecords];
    },
    [records],
  );

  const value = useMemo<TodayStatusContextValue>(
    () => ({ raw, records, todayKey: activeDateKey, loaded, error, retry, getAllStudentsStatus }),
    [raw, records, activeDateKey, loaded, error, retry, getAllStudentsStatus],
  );

  return <TodayStatusContext.Provider value={value}>{children}</TodayStatusContext.Provider>;
}

export function useTodayStatus(): TodayStatusContextValue {
  const ctx = useContext(TodayStatusContext);
  if (!ctx) throw new Error("useTodayStatus must be used within TodayStatusProvider");
  return ctx;
}
