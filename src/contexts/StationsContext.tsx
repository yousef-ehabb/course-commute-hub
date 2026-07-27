import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { getFirebaseDb } from "@/lib/firebase";
import { ref, onValue, set } from "firebase/database";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

export interface Station {
  id: string;
  name: string;
  detail: string;
  time: string;
  latitude: number;
  longitude: number;
}

interface StationsContextType {
  stations: Station[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  saveStations: (newStations: Station[]) => Promise<void>;
}

const StationsContext = createContext<StationsContextType | undefined>(undefined);

export function StationsProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  // Retry key: incrementing this forces a re-subscribe
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsub: (() => void) | undefined;

    if (authLoading) {
      return; // wait for auth to resolve
    }

    if (!user) {
      if (isMounted) {
        if (stations.length > 0) {
          console.log("[StationsContext] Stations state cleared (user is null)");
          console.trace("[StationsContext] Stack trace for clear");
        }
        setStations([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, onValue, set } = await import("firebase/database");

        if (!isMounted) return;

        const db = getFirebaseDb();
        const stationsRef = ref(db, "rakeb/stations");

        console.log("[StationsContext] Stations listener attached");
        unsub = onValue(
          stationsRef,
          async (snap) => {
            if (!isMounted) return;
            const val = snap.val();
            if (val) {
              const parsed: Station[] = Array.isArray(val) ? val : Object.values(val);
              console.log(
                `[StationsContext] Stations loaded from Firebase (count: ${parsed.length})`,
              );
              setStations(parsed);
              setLoading(false);
              setError(null);
            } else {
              console.log("[StationsContext] Stations loaded from Firebase (null/empty)");
              // Seed default Aswan stations if DB is completely empty
              const defaultAswanStations: Station[] = [
                {
                  id: "st1",
                  name: "محطة أسوان الرئيسية",
                  detail: "بجوار المحطة",
                  time: "08:00",
                  latitude: 24.0935,
                  longitude: 32.9,
                },
                {
                  id: "st2",
                  name: "ميدان المحطة",
                  detail: "أمام البريد",
                  time: "08:05",
                  latitude: 24.089,
                  longitude: 32.8995,
                },
                {
                  id: "st3",
                  name: "الكورنيش",
                  detail: "نادي التجديف",
                  time: "08:15",
                  latitude: 24.085,
                  longitude: 32.895,
                },
                {
                  id: "st4",
                  name: "الجامعة القديمة",
                  detail: "بوابة الجامعة",
                  time: "08:30",
                  latitude: 24.08,
                  longitude: 32.89,
                },
              ];
              try {
                await set(stationsRef, defaultAswanStations);
                console.log("Seeded default Aswan stations");
                if (isMounted) setLoading(false);
              } catch (e) {
                console.error("Failed to seed stations:", e);
                if (isMounted) {
                  if (stations.length > 0) {
                    console.log("[StationsContext] Stations state cleared (seed failed)");
                    console.trace("[StationsContext] Stack trace for clear");
                  }
                  setStations([]);
                  setLoading(false);
                  setError("فشل تحميل المحطات");
                }
              }
            }
          },
          (firebaseError) => {
            console.error("Failed to load stations:", firebaseError);
            if (!isMounted) return;
            toast.error("فشل تحميل المحطات");
            setLoading(false);
            setError(firebaseError.message || "فشل تحميل المحطات");
          },
        );
      } catch (err) {
        console.error("Failed to init stations DB:", err);
        if (isMounted) {
          setLoading(false);
          setError("فشل تهيئة قاعدة البيانات");
        }
      }
    })();

    return () => {
      isMounted = false;
      if (unsub) {
        console.log("[StationsContext] Stations listener detached");
        unsub();
      }
    };
  }, [retryKey, user, authLoading]);

  const saveStations = async (newStations: Station[]) => {
    try {
      const db = getFirebaseDb();
      await set(ref(db, "rakeb/stations"), newStations);
      toast.success("تم حفظ المحطات بنجاح");
    } catch (saveError) {
      console.error("Failed to save stations:", saveError);
      toast.error("فشل حفظ المحطات");
      throw saveError;
    }
  };

  const value = useMemo<StationsContextType>(
    () => ({
      stations,
      loading,
      error,
      retry,
      saveStations,
    }),
    [stations, loading, error, retry],
  );

  return <StationsContext.Provider value={value}>{children}</StationsContext.Provider>;
}

export function useStations() {
  const ctx = useContext(StationsContext);
  if (!ctx) {
    throw new Error("useStations must be used within a StationsProvider");
  }
  return ctx;
}
