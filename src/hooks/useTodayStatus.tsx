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
  nationalId?: string;
  boarded?: boolean;
  isStaff?: boolean;
  courseId?: string;
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
  const { user, isAdmin } = useAuth();
  const { activeDateKey, loaded: activeDateLoaded } = useActiveDate();
  const { courseId, courses } = useCourse();
  const [raw, setRaw] = useState<Record<string, any> | null>(null);
  const [rawByCourse, setRawByCourse] = useState<Record<string, Record<string, any>>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Compute all courses to monitor for today's dailyStatus.
  // Admins see all courses for shared-bus boarding; students only see their own course.
  const courseIdsToListen = useMemo(() => {
    if (!isAdmin) {
      return [courseId || "default"];
    }
    const ids = new Set<string>(["default"]);
    if (courseId) ids.add(courseId);
    courses.forEach((c) => {
      if (c.id) ids.add(c.id);
    });
    return Array.from(ids);
  }, [isAdmin, courseId, courses]);

  useEffect(() => {
    if (!user || !activeDateLoaded) {
      setRaw(null);
      setRawByCourse({});
      setLoaded(true);
      return;
    }

    const unsubs: (() => void)[] = [];
    let isCancelled = false;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const db = getFirebaseDb();

      const courseDataMap: Record<string, Record<string, any>> = {};

      if (courseIdsToListen.length === 0) {
        setLoaded(true);
        return;
      }

      courseIdsToListen.forEach((cId) => {
        const path = `rakeb/dailyStatus/${cId}/${activeDateKey}`;
        const unsub = onValue(
          ref(db, path),
          (snap) => {
            if (isCancelled) return;
            const val = snap.val() || {};
            courseDataMap[cId] = val;

            // Merge all courses into one raw dictionary keyed by UID
            const merged: Record<string, any> = {};
            for (const [cKey, recordsObj] of Object.entries(courseDataMap)) {
              for (const [uid, rec] of Object.entries(recordsObj)) {
                merged[uid] = { ...rec, courseId: rec.courseId || cKey };
              }
            }

            setRawByCourse({ ...courseDataMap });
            setRaw(merged);
            setLoaded(true);
            setError(null);
          },
          (err) => {
            if (isCancelled) return;
            console.error(`[TodayStatus] Listener error for ${cId}:`, err);
            setError(err);
            setLoaded(true);
          },
        );
        unsubs.push(unsub);
      });
    })().catch((err) => {
      if (isCancelled) return;
      console.error("[TodayStatus] Init failed:", err);
      setError(err);
      setLoaded(true);
    });

    return () => {
      isCancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user, isAdmin, activeDateKey, activeDateLoaded, retryCount, courseIdsToListen]);

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
          const studentCourse = u.courseId || "default";
          // Lookup explicit daily record from the student's OWN course first
          const explicitRecord = rawByCourse[studentCourse]?.[u.uid] || raw?.[u.uid];
          const defaultStation = u.defaultStation || "unknown";
          const defaultStatus = "riding";

          return {
            id: u.uid,
            status: explicitRecord?.status ?? defaultStatus,
            station: explicitRecord?.station ?? defaultStation,
            fullName: explicitRecord?.fullName || u.fullName || "طالب",
            phone: explicitRecord?.phone || u.phone || "",
            nationalId: u.nationalId || (explicitRecord as any)?.nationalId || "",
            boarded: Boolean(explicitRecord?.boarded),
            isStaff: false,
            courseId: studentCourse,
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
            nationalId: adminUser?.nationalId || (r as any)?.nationalId || "",
            boarded: Boolean(r.boarded),
            isStaff: true,
            courseId: r.courseId,
            customLocation: r.customLocation || adminUser?.customLocation,
            updatedAt: r.updatedAt,
          };
        });

      return [...studentRecords, ...staffRecords];
    },
    [records, rawByCourse, raw],
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
