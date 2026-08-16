import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { useCourse } from "@/contexts/CourseContext";

export type TripStatusType = "pending" | "waiting_at_station" | "moving" | "completed";

interface TripLocation {
  lat: number;
  lng: number;
  updatedAt?: number;
}

interface TripStatusContextValue {
  status: TripStatusType;
  currentStationId: string | null;
  nextStationId: string | null;
  lastStationId: string | null;
  location: TripLocation | null;
  licensePlate: string | null;
  /** Today's date key (YYYY-MM-DD) */
  todayKey: string;
  /** Whether the listener has fired at least once */
  loaded: boolean;
  /** Error if the listener failed */
  error: Error | null;
  /** Raw snapshot for direct access (e.g. startedAt, endedAt) */
  raw: Record<string, any> | null;
  /** Force retry the connection */
  retry: () => void;
}

const TripStatusContext = createContext<TripStatusContextValue | null>(null);

export function TripStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeDateKey, loaded: activeDateLoaded } = useActiveDate();
  const { courseId } = useCourse();
  const [status, setStatus] = useState<TripStatusType>("pending");
  const [currentStationId, setCurrentStationId] = useState<string | null>(null);
  const [nextStationId, setNextStationId] = useState<string | null>(null);
  const [lastStationId, setLastStationId] = useState<string | null>(null);
  const [location, setLocation] = useState<TripLocation | null>(null);
  const [licensePlate, setLicensePlate] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [raw, setRaw] = useState<Record<string, any> | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user || !activeDateLoaded) {
      setStatus("pending");
      setCurrentStationId(null);
      setNextStationId(null);
      setLastStationId(null);
      setLocation(null);
      setLicensePlate(null);
      setRaw(null);
      setLoaded(activeDateLoaded);
      return;
    }

    let unsub: (() => void) | undefined;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");

      const db = getFirebaseDb();
      const path = `rakeb/trips/${courseId}/${activeDateKey}`;

      unsub = onValue(
        ref(db, path),
        (snap) => {
          const val = snap.val();
          setRaw(val);
          if (val) {
            setStatus(val.status || "pending");
            setCurrentStationId(val.currentStationId || null);
            setNextStationId(val.nextStationId || null);
            setLastStationId(val.lastStationId || null);
            setLocation(val.location || null);
            setLicensePlate(val.licensePlate || null);
          } else {
            setStatus("pending");
            setCurrentStationId(null);
            setNextStationId(null);
            setLastStationId(null);
            setLocation(null);
            setLicensePlate(null);
          }
          setLoaded(true);
          setError(null);
        },
        (err) => {
          console.error("[TripStatus] Listener error:", err);
          setError(err);
          setLoaded(true);
        },
      );
    })().catch((err) => {
      console.error("[TripStatus] Init failed:", err);
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

  const value = useMemo<TripStatusContextValue>(
    () => ({
      status,
      currentStationId,
      nextStationId,
      lastStationId,
      location,
      licensePlate,
      todayKey: activeDateKey,
      loaded,
      error,
      raw,
      retry,
    }),
    [
      status,
      currentStationId,
      nextStationId,
      lastStationId,
      location,
      licensePlate,
      activeDateKey,
      loaded,
      error,
      raw,
      retry,
    ],
  );

  return <TripStatusContext.Provider value={value}>{children}</TripStatusContext.Provider>;
}

export function useTripStatus(): TripStatusContextValue {
  const ctx = useContext(TripStatusContext);
  if (!ctx) throw new Error("useTripStatus must be used within TripStatusProvider");
  return ctx;
}
