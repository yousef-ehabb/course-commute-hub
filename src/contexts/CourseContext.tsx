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
import type { CourseInfo } from "@/types";
import { DEFAULT_CUTOFF_TIME } from "@/lib/constants";
import { toast } from "sonner";

interface CourseContextValue {
  /** The active courseId for the current user/admin */
  courseId: string;
  /** Set the active courseId (admin switcher) */
  setCourseId: (id: string) => void;
  /** Course metadata for the currently active courseId */
  course: CourseInfo | null;
  /** List of all courses available in the system */
  courses: CourseInfo[];
  /** Whether the courses have been loaded */
  loaded: boolean;
  /** Error if course loading failed */
  error: Error | null;
  /** Archive a course and move its active students to archivedUsers */
  archiveCourse: (id: string) => Promise<void>;
  /** Delete a course and all its related nodes permanently */
  deleteCourse: (id: string) => Promise<void>;
  /** Create a new course */
  createCourse: (id: string, name: string) => Promise<void>;
}

const CourseContext = createContext<CourseContextValue | null>(null);

const STORAGE_KEY = "rakeb_admin_active_course";

export function CourseProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin, loading: authLoading, user } = useAuth();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    }
    return profile?.courseId || "default";
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // For students, courseId is bound strictly to profile.courseId
  const effectiveCourseId = isAdmin ? activeCourseId : (profile?.courseId || "default");

  // Keep admin selection in localStorage
  const handleSetCourseId = useCallback((newId: string) => {
    setActiveCourseId(newId);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newId);
    }
  }, []);

  // Synchronize when profile loads if no prior selection
  useEffect(() => {
    if (!authLoading && profile?.courseId && !localStorage.getItem(STORAGE_KEY)) {
      setActiveCourseId(profile.courseId);
    }
  }, [profile?.courseId, authLoading]);

  // Listen to all courses in RTDB
  useEffect(() => {
    if (authLoading) return;

    let unsub: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, onValue } = await import("firebase/database");

        const db = getFirebaseDb();
        unsub = onValue(
          ref(db, "rakeb/courses"),
          (snap) => {
            if (!isMounted) return;
            const val = snap.val();
            if (val) {
              const list: CourseInfo[] = Object.entries(val).map(([id, item]: [string, any]) => ({
                id,
                name: item.name || id,
                adminUid: item.adminUid || "unknown",
                status: item.status || "active",
                createdAt: item.createdAt || Date.now(),
                startDate: item.startDate || Date.now(),
                endDate: item.endDate,
              }));
              setCourses(list);
            } else {
              setCourses([]);
            }
            setLoaded(true);
            setError(null);
          },
          (err) => {
            if (!isMounted) return;
            console.error("[CourseContext] Failed to load courses:", err);
            setError(err);
            setLoaded(true);
          }
        );
      } catch (err) {
        if (!isMounted) return;
        console.error("[CourseContext] Init failed:", err);
        setError(err as Error);
        setLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
      unsub?.();
    };
  }, [authLoading]);

  // Derived current course metadata
  const currentCourse = useMemo<CourseInfo | null>(() => {
    if (effectiveCourseId === "default") {
      const found = courses.find((c) => c.id === "default");
      return found || {
        id: "default",
        name: "الكورس الأساسي",
        adminUid: "system",
        status: "active",
        createdAt: 0,
        startDate: 0,
      };
    }
    return courses.find((c) => c.id === effectiveCourseId) || null;
  }, [effectiveCourseId, courses]);

  // Create course helper
  const createCourse = useCallback(
    async (id: string, name: string) => {
      const normalizedId = id.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!normalizedId || !name.trim()) {
        throw new Error("يرجى إدخال اسم ومعرف صالح للكورس");
      }

      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, set, get } = await import("firebase/database");
      const db = getFirebaseDb();

      const existingSnap = await get(ref(db, `rakeb/courses/${normalizedId}`));
      if (existingSnap.exists()) {
        throw new Error(`الكورس "${normalizedId}" موجود بالفعل.`);
      }

      await set(ref(db, `rakeb/courses/${normalizedId}`), {
        id: normalizedId,
        name: name.trim(),
        adminUid: user?.uid || "unknown",
        createdAt: Date.now(),
        createdBy: user?.uid || "unknown",
        status: "active",
      });

      // Initialize default settings for the course
      await set(ref(db, `rakeb/settings/${normalizedId}`), {
        cutoffTime: DEFAULT_CUTOFF_TIME,
        cutoffEnabled: true,
        forceLock: false,
        vehicleLimits: { micro: 14, bus: 50 },
      });

      handleSetCourseId(normalizedId);
    },
    [user?.uid, handleSetCourseId]
  );

  // Archive course helper
  const archiveCourse = useCallback(
    async (targetCourseId: string) => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, get, update } = await import("firebase/database");
      const db = getFirebaseDb();

      // 1. Update course status
      await update(ref(db, `rakeb/courses/${targetCourseId}`), {
        status: "archived",
        archivedAt: Date.now(),
      });

      // 2. Move users of this course to archivedUsers
      const usersSnap = await get(ref(db, "rakeb/users"));
      if (usersSnap.exists()) {
        const allUsers = usersSnap.val();
        const updates: Record<string, any> = {};

        for (const [uid, u] of Object.entries(allUsers) as [string, any][]) {
          if (
            u.role !== "admin" &&
            (u.courseId === targetCourseId || (!u.courseId && targetCourseId === "default"))
          ) {
            updates[`rakeb/archivedUsers/${targetCourseId}/${uid}`] = {
              ...u,
              archivedAt: Date.now(),
              archivedFromCourse: targetCourseId,
            };
            updates[`rakeb/archivedUsersIndex/${uid}`] = { courseId: targetCourseId };
            updates[`rakeb/users/${uid}`] = null;
          }
        }

        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }
    },
    []
  );

  // Delete course helper
  const deleteCourse = useCallback(
    async (targetCourseId: string) => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, remove } = await import("firebase/database");
      const db = getFirebaseDb();

      await Promise.all([
        remove(ref(db, `rakeb/courses/${targetCourseId}`)),
        remove(ref(db, `rakeb/settings/${targetCourseId}`)),
        remove(ref(db, `rakeb/trips/${targetCourseId}`)),
        remove(ref(db, `rakeb/tripHistory/${targetCourseId}`)),
        remove(ref(db, `rakeb/dailyStatus/${targetCourseId}`)),
        remove(ref(db, `rakeb/auditLog/${targetCourseId}`)),
      ]);

      // If active course was deleted, fallback to default or first remaining course
      if (effectiveCourseId === targetCourseId) {
        handleSetCourseId("default");
      }
    },
    [effectiveCourseId, handleSetCourseId]
  );

  const value = useMemo<CourseContextValue>(
    () => ({
      courseId: effectiveCourseId,
      setCourseId: handleSetCourseId,
      course: currentCourse,
      courses,
      loaded,
      error,
      archiveCourse,
      deleteCourse,
      createCourse,
    }),
    [
      effectiveCourseId,
      handleSetCourseId,
      currentCourse,
      courses,
      loaded,
      error,
      archiveCourse,
      deleteCourse,
      createCourse,
    ]
  );

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourse(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourse must be used within CourseProvider");
  return ctx;
}
