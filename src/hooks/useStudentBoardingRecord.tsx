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
import type { BoardingRecord } from "@/types";

interface StudentBoardingRecordContextValue {
  record: BoardingRecord | null;
  loaded: boolean;
  error: Error | null;
  retry: () => void;
}

const StudentBoardingRecordContext = createContext<StudentBoardingRecordContextValue | null>(null);

export function StudentBoardingRecordProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeDateKey, loaded: activeDateLoaded } = useActiveDate();
  const [record, setRecord] = useState<BoardingRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user || !activeDateLoaded) {
      setRecord(null);
      setLoaded(true);
      return;
    }

    let unsub: (() => void) | undefined;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");

      const path = `rakeb/boardingRecords/${activeDateKey}/${user.uid}`;
      unsub = onValue(
        ref(getFirebaseDb(), path),
        (snap) => {
          const val = snap.val();
          setRecord(val ? { id: snap.key, ...val } : null);
          setLoaded(true);
          setError(null);
        },
        (err) => {
          console.error("[StudentBoardingRecord] Listener error:", err);
          setError(err);
          setLoaded(true);
        },
      );
    })().catch((err) => {
      console.error("[StudentBoardingRecord] Init failed:", err);
      setError(err);
      setLoaded(true);
    });

    return () => unsub?.();
  }, [user, activeDateKey, activeDateLoaded, retryCount]);

  const retry = useCallback(() => {
    setError(null);
    setLoaded(false);
    setRetryCount((c) => c + 1);
  }, []);

  const value = useMemo(
    () => ({
      record,
      loaded,
      error,
      retry,
    }),
    [record, loaded, error, retry],
  );

  return (
    <StudentBoardingRecordContext.Provider value={value}>
      {children}
    </StudentBoardingRecordContext.Provider>
  );
}

export function useStudentBoardingRecord() {
  const ctx = useContext(StudentBoardingRecordContext);
  if (!ctx) {
    throw new Error("useStudentBoardingRecord must be used within a StudentBoardingRecordProvider");
  }
  return ctx;
}
