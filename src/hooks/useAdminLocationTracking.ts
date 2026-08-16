import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { useVehicles } from "@/hooks/useVehicles";
import { TripRepository } from "@/lib/TripRepository";
import { getFirebaseDb } from "@/lib/firebase";

export type PermissionState = "granted" | "prompt" | "denied" | "unknown";

export function useAdminLocationTracking() {
  const { user } = useAuth();
  const { activeDateKey } = useActiveDate();
  const { vehicles } = useVehicles();
  
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");
  
  const myVehicles = vehicles.filter((v) => v.assignedCoordinatorId === user?.uid);
  const isDriving = myVehicles.length > 0;
  
  const vehiclesRef = useRef(vehicles);
  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  const requestPermission = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setPermissionState("granted"),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
        }
      },
      { enableHighAccuracy: true }
    );
  };

  // 1. Permission Status Tracking
  useEffect(() => {
    if (!navigator.permissions) {
      setPermissionState("unknown");
      return;
    }

    let isMounted = true;
    let cleanupListeners: (() => void) | undefined;

    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      if (!isMounted) return;
      setPermissionState(status.state as PermissionState);
      
      const handleChange = () => {
        setPermissionState(status.state as PermissionState);
      };
      
      status.addEventListener("change", handleChange);
      
      const handleFocus = () => {
        navigator.permissions.query({ name: "geolocation" })
          .then(s => { if (isMounted) setPermissionState(s.state as PermissionState); })
          .catch(() => {});
      };
      window.addEventListener("focus", handleFocus);
      
      cleanupListeners = () => {
        status.removeEventListener("change", handleChange);
        window.removeEventListener("focus", handleFocus);
      };
    }).catch(() => {
      if (isMounted) setPermissionState("unknown");
    });
    
    return () => {
      isMounted = false;
      cleanupListeners?.();
    };
  }, []);

  // 2. Active Tracking Logic
  const lastUpdateRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isDriving || !user?.uid) return;
    if (!navigator.geolocation) return;

    let isMounted = true;
    const db = getFirebaseDb();

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        if (!isMounted) return;
        if (permissionState !== "granted") setPermissionState("granted");

        const now = Date.now();
        const currentMyVehicles = vehiclesRef.current.filter((v) => v.assignedCoordinatorId === user.uid);
        
        if (currentMyVehicles.length === 0) return;

        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updatedAt: now,
        };

        const updatePromises = currentMyVehicles.map((v) => {
          const lastUpdate = lastUpdateRef.current[v.id] || 0;
          // Throttle to once every 10 seconds per vehicle
          if (now - lastUpdate < 10000) return Promise.resolve();
          
          lastUpdateRef.current[v.id] = now;
          return TripRepository.updateLocation(db, activeDateKey, v.id, user.uid, location).catch(err => {
             console.warn(`[LocationTracking] Update failed for ${v.id}:`, err);
             // Revert throttle so we can try again on next tick
             lastUpdateRef.current[v.id] = lastUpdate;
          });
        });

        await Promise.all(updatePromises);
      },
      (err) => {
        if (!isMounted) return;
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
        } else {
          // Ignore transient errors like POSITION_UNAVAILABLE (2) or TIMEOUT (3)
          console.debug("[LocationTracking] Transient error ignored:", err.message);
        }
      },
      { enableHighAccuracy: true }
    );

    return () => {
      isMounted = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isDriving, user?.uid, activeDateKey, permissionState]);

  return {
    permissionState,
    isDriving,
    requestPermission
  };
}
