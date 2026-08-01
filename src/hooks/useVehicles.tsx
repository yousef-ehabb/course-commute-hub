/**
 * useVehicles — real-time listener for the vehicles collection.
 * Provides a parsed array of Vehicle objects and computed fleet totals.
 *
 * Phase 2a: vehicle planning (add/remove). Later sub-phases add tracking & boarding.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import type { Vehicle } from "@/types";

interface VehiclesContextValue {
  /** All vehicles for today's date */
  vehicles: Vehicle[];
  /** Total capacity across all vehicles */
  totalCapacity: number;
  /** Total occupied seats across all vehicles */
  totalOccupied: number;
  /** Number of vehicles */
  vehicleCount: number;
  /** Whether the listener has fired at least once */
  loaded: boolean;
  /** Error if the listener failed */
  error: Error | null;
  /** Force retry the connection */
  retry: () => void;
}

const VehiclesContext = createContext<VehiclesContextValue | null>(null);

function parseVehicles(raw: Record<string, any> | null): Vehicle[] {
  if (!raw) return [];
  return Object.entries(raw).map(([id, v]) => ({
    id,
    type: v.type ?? "bus",
    capacity: v.capacity ?? 0,
    occupiedSeats: v.occupiedSeats ?? 0,
    status: v.status ?? "planned",
    assignedCoordinatorId: v.assignedCoordinatorId ?? null,
    assignedAt: v.assignedAt ?? null,
    lastHeartbeatAt: v.lastHeartbeatAt ?? null,
    trackingSessionId: v.trackingSessionId ?? null,
    currentLocation: v.currentLocation ?? null,
    currentStationId: v.currentStationId ?? null,
    nextStationId: v.nextStationId ?? null,
    lastStationId: v.lastStationId ?? null,
    licensePlate: v.licensePlate ?? null,
    createdAt: v.createdAt ?? 0,
    updatedAt: v.updatedAt ?? 0,
    createdBy: v.createdBy ?? "unknown",
  }));
}

export function VehiclesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeDateKey, loaded: activeDateLoaded } = useActiveDate();
  const [raw, setRaw] = useState<Record<string, any> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user || !activeDateLoaded) {
      setRaw(null);
      setLoaded(activeDateLoaded);
      return;
    }

    let unsub: (() => void) | undefined;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");

      const db = getFirebaseDb();
      const path = `rakeb/vehicles/default/${activeDateKey}`;

      unsub = onValue(
        ref(db, path),
        (snap) => {
          setRaw(snap.val());
          setLoaded(true);
          setError(null);
        },
        (err) => {
          console.error("[Vehicles] Listener error:", err);
          setError(err);
          setLoaded(true);
        },
      );
    })().catch((err) => {
      console.error("[Vehicles] Init failed:", err);
      setError(err);
      setLoaded(true);
    });

    return () => unsub?.();
  }, [user, activeDateKey, activeDateLoaded, retryCount]);

  const vehicles = useMemo(() => parseVehicles(raw), [raw]);

  const totalCapacity = useMemo(
    () => vehicles.reduce((sum, v) => sum + v.capacity, 0),
    [vehicles],
  );

  const totalOccupied = useMemo(
    () => vehicles.reduce((sum, v) => sum + v.occupiedSeats, 0),
    [vehicles],
  );

  const retry = () => {
    setError(null);
    setLoaded(false);
    setRetryCount((c) => c + 1);
  };

  const value = useMemo<VehiclesContextValue>(
    () => ({
      vehicles,
      totalCapacity,
      totalOccupied,
      vehicleCount: vehicles.length,
      loaded,
      error,
      retry,
    }),
    [vehicles, totalCapacity, totalOccupied, loaded, error, retryCount],
  );

  return <VehiclesContext.Provider value={value}>{children}</VehiclesContext.Provider>;
}

export function useVehicles(): VehiclesContextValue {
  const ctx = useContext(VehiclesContext);
  if (!ctx) throw new Error("useVehicles must be used within VehiclesProvider");
  return ctx;
}
