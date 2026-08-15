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

interface BoardingRecordsContextValue {
  /** Map of studentId to their BoardingRecord */
  recordsByStudent: Record<string, BoardingRecord>;
  /** Array of all boarding records */
  records: BoardingRecord[];
  /** Whether the listener has fired at least once */
  loaded: boolean;
  /** Error if the listener failed */
  error: Error | null;
  /** Force retry the connection */
  retry: () => void;
}

const BoardingRecordsContext = createContext<BoardingRecordsContextValue | null>(null);

export function BoardingRecordsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeDateKey, loaded: activeDateLoaded } = useActiveDate();
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

      const path = `rakeb/boardingRecords/${activeDateKey}`;
      unsub = onValue(
        ref(getFirebaseDb(), path),
        (snap) => {
          setRaw(snap.val() || {});
          setLoaded(true);
          setError(null);
        },
        (err) => {
          console.error("[BoardingRecords] Listener error:", err);
          setError(err);
          setLoaded(true);
        },
      );
    })().catch((err) => {
      console.error("[BoardingRecords] Init failed:", err);
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

  const { records, recordsByStudent } = useMemo(() => {
    if (!raw) return { records: [], recordsByStudent: {} };
    
    const recs: BoardingRecord[] = [];
    const byStudent: Record<string, BoardingRecord> = {};
    
    for (const [key, value] of Object.entries(raw)) {
      const record = { id: key, ...value } as BoardingRecord;
      recs.push(record);
      if (record.studentId) {
        byStudent[record.studentId] = record;
      }
    }
    
    return { records: recs, recordsByStudent: byStudent };
  }, [raw]);

  const value = useMemo(
    () => ({
      records,
      recordsByStudent,
      loaded,
      error,
      retry,
    }),
    [records, recordsByStudent, loaded, error, retry],
  );

  return (
    <BoardingRecordsContext.Provider value={value}>
      {children}
    </BoardingRecordsContext.Provider>
  );
}

export function useBoardingRecords() {
  const ctx = useContext(BoardingRecordsContext);
  if (!ctx) {
    throw new Error("useBoardingRecords must be used within a BoardingRecordsProvider");
  }
  return ctx;
}
