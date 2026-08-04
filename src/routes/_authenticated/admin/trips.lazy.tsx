import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { VehicleControls } from "@/components/admin/VehicleControls";
import { StationTimeline } from "@/components/admin/StationTimeline";
import { BoardingList } from "@/components/admin/BoardingList";
import { TripSummary } from "@/components/admin/TripSummary";
import { VehiclePlanning } from "@/components/admin/VehiclePlanning";
import { ActiveVehicles } from "@/components/admin/ActiveVehicles";
import { useStations } from "@/contexts/StationsContext";
import { useTripStatus } from "@/hooks/useTripStatus";
import { useTodayStatus, type DailyRecord } from "@/hooks/useTodayStatus";
import { useVehicles } from "@/hooks/useVehicles";
import { useBoardingRecords } from "@/hooks/useBoardingRecords";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { getVehicleLabel } from "@/utils/vehicleResolver";
import { isStationSelected } from "@/utils/stationResolver";
import { toast } from "sonner";
import { Flag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/LongPressButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  startTrip,
  completeTrip,
  departStation,
  arriveAtStation,
  startDay,
  FirebaseTripError,
  getNextDateKey,
} from "@/lib/tripService";
import { TripRepository } from "@/lib/TripRepository";
import { useAuth } from "@/contexts/AuthContext";
import type { VehicleType } from "@/types";
import AdminStationsMap from "@/components/admin/AdminStationsMap";

export const Route = createLazyFileRoute("/_authenticated/admin/trips")({
  component: TripsPage,
});

// ---------------------------------------------------------------------------
// Structured error handler — surfaces real error info
// ---------------------------------------------------------------------------

function handleTripError(err: unknown, fallbackMessage: string) {
  if (err instanceof FirebaseTripError) {
    console.error(
      `[TripError] operation=${err.operation} code=${err.code} path=${err.path}`,
      err.cause,
    );

    // Show detailed message in development, friendly message in production
    const isDev = import.meta.env.DEV;
    if (isDev) {
      toast.error(`${fallbackMessage}\n[${err.code}] ${err.operation} @ ${err.path}`, {
        duration: 8000,
      });
    } else {
      toast.error(fallbackMessage);
    }
  } else {
    console.error("[TripError] Unexpected error:", err);
    toast.error(fallbackMessage);
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function TripsPage() {
  const { stations, loading: stationsLoading } = useStations();
  const {
    status: tripStatus,
    currentStationId,
    nextStationId,
    lastStationId,
    raw,
  } = useTripStatus();
  const { getAllStudentsStatus } = useTodayStatus();
  const { vehicles, totalCapacity, loaded: vehiclesLoaded } = useVehicles();
  const { recordsByStudent } = useBoardingRecords();
  const { activeDateKey, serverTimeOffset } = useActiveDate();
  const { user, profile } = useAuth();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const myVehicles = vehicles.filter((v) => v.assignedCoordinatorId === user?.uid);
  const myVehicle = myVehicles[0];

  const displayedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : (myVehicle || vehicles[0] || null);

  const isControllingDisplayed = displayedVehicle?.assignedCoordinatorId === user?.uid;

  const [dbRefs, setDbRefs] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"trip" | "passengers">("trip");
  const [mounted, setMounted] = useState(false);
  const [showEndTripDialog, setShowEndTripDialog] = useState(false);

  useEffect(() => {
    setMounted(true);
    let unsubUsers: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const db = getFirebaseDb();
      setDbRefs({
        db,
        tripPath: `rakeb/trips/default/${activeDateKey}`,
        dailyPath: `rakeb/dailyStatus/default/${activeDateKey}`,
      });

      unsubUsers = onValue(ref(db, "rakeb/users"), (snap) => {
        const val = snap.val();
        if (val) {
          setUsers(
            Object.entries(val)
              .map(([uid, u]: [string, any]) => ({ uid, ...u }))
              .filter((u: any) => u.role === "student"),
          );
        } else {
          setUsers([]);
        }
      });
    })().catch((err) => {
      console.error("[Trips] Initialization failed:", err);
    });

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (unsubUsers) unsubUsers();
    };
  }, [activeDateKey]);

  const passengers = useMemo<DailyRecord[]>(() => {
    return getAllStudentsStatus(users);
  }, [getAllStudentsStatus, users]);

  const confirmedStudents = useMemo(
    () => passengers.filter((p) => p.status === "riding" && isStationSelected(p.station)).length,
    [passengers],
  );

  // ── Independent Vehicle GPS Tracking (Phase 2b) ───────────────────────

  const vehiclesRef = useRef(vehicles);
  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  const lastLocationUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (tripStatus === "pending" || !dbRefs) return;

    if (!("geolocation" in navigator)) return;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        setIsLocationEnabled(true);
        const now = Date.now();
        // Throttle updates to once every 10 seconds
        if (now - lastLocationUpdateRef.current < 10000) return;

        const myVehicles = vehiclesRef.current.filter((v) => v.assignedCoordinatorId === user?.uid);
        if (myVehicles.length === 0) return;

        lastLocationUpdateRef.current = now;

        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          updatedAt: now,
        };

        try {
          await Promise.all(
            myVehicles.map((v) =>
              TripRepository.updateLocation(dbRefs.db, activeDateKey, v.id, user!.uid, location)
            )
          );
        } catch (locErr) {
          console.warn("[Trips] Location update failed:", locErr);
        }
      },
      () => {
        setIsLocationEnabled(false);
        const myVehicles = vehiclesRef.current.filter((v) => v.assignedCoordinatorId === user?.uid);
        if (myVehicles.length > 0) {
          toast.error("فشل تتبع الموقع. يرجى تفعيل إذن الـ GPS في متصفحك.");
        }
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [displayedVehicle?.status, dbRefs, activeDateKey, user?.uid]);

  // ── Vehicle Planning Handlers ───────────────────────────────────────────

  const handleAddVehicle = async (type: VehicleType, capacity: number) => {
    if (!dbRefs) return;
    try {
      await TripRepository.createVehicle(dbRefs.db, activeDateKey, {
        type,
        capacity,
        createdBy: user?.uid ?? "unknown",
      });
      toast.success(`تمت إضافة ${type === "bus" ? "أتوبيس" : "ميكروباص"}`);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إضافة المركبة");
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (!dbRefs) return;
    try {
      await TripRepository.removeVehicle(dbRefs.db, activeDateKey, vehicleId);
      toast.success("تم حذف المركبة");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء حذف المركبة");
    }
  };

  const handleUpdateCapacity = async (vehicleId: string, capacity: number) => {
    if (!dbRefs) return;
    try {
      await TripRepository.updateVehicleCapacity(dbRefs.db, activeDateKey, vehicleId, capacity);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء تحديث السعة");
    }
  };

  const handleTakeControl = async (vehicleId: string) => {
    if (!dbRefs || !user) return { success: false, error: "Not initialized" };
    try {
      const adminName = profile?.fullName || user.displayName || user.email?.split("@")[0] || "منسق";
      console.log(`[handleTakeControl] Initiating takeControl for vehicleId=${vehicleId}, user.uid=${user.uid}, adminName=${adminName}`);
      const res = await TripRepository.takeControl(dbRefs.db, activeDateKey, vehicleId, user.uid, adminName);
      console.log(`[handleTakeControl] takeControl completed. Result:`, res);
      if (!res.success) {
        toast.error(res.error);
      }
      return res;
    } catch (e: any) {
      console.error("[handleTakeControl] Exception caught:", e);
      if (e instanceof FirebaseTripError) {
        console.error(`[handleTakeControl] FirebaseTripError code=${e.code} path=${e.path}`, e.cause);
      }
      toast.error(`حدث خطأ: ${e?.message || 'Unknown error'}`);
      return { success: false, error: e?.message };
    }
  };

  const handleReleaseControl = async (vehicleId: string) => {
    if (!dbRefs || !user) return { success: false, error: "Not initialized" };
    try {
      const res = await TripRepository.releaseControl(dbRefs.db, activeDateKey, vehicleId, user.uid);
      if (!res.success) {
        toast.error(res.error);
      }
      return res;
    } catch (e: any) {
      toast.error("حدث خطأ أثناء التخلي عن المسؤولية");
      return { success: false, error: e.message };
    }
  };

  // ── Existing Trip Handlers (kept for Phase 2a compatibility) ────────────

  const handleStartTrip = async (licensePlate: string) => {
    // Phase 2c: start vehicle trip
    if (!dbRefs || !displayedVehicle || !isControllingDisplayed) return;
    try {
      const { ref, update } = await import("firebase/database");
      const vehiclePath = `rakeb/vehicles/default/${activeDateKey}/${displayedVehicle.id}`;
      await update(ref(dbRefs.db, vehiclePath), {
        status: "running",
        licensePlate,
        currentStationId: stations[0]?.id ?? null,
      });
      toast.success("تم بدء الرحلة للمركبة");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء بدء الرحلة");
    }
  };

  const handleEndTrip = async () => {
    if (!dbRefs || isCompleting || !displayedVehicle || !isControllingDisplayed) return;
    setIsCompleting(true);
    try {
      const { ref, update } = await import("firebase/database");
      const vehiclePath = `rakeb/vehicles/default/${activeDateKey}/${displayedVehicle.id}`;
      await update(ref(dbRefs.db, vehiclePath), {
        status: "ended",
        currentStationId: null,
        nextStationId: null,
      });

      toast.success(`تم إنهاء مسار المركبة بنجاح`);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إنهاء مسار المركبة");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleEndDay = async () => {
    if (!dbRefs || isCompleting) return;
    setIsCompleting(true);
    try {
      const nextDate = getNextDateKey(activeDateKey);
      const [year, month, day] = nextDate.split("-").map(Number);
      const { ref, get } = await import("firebase/database");
      const settingsSnap = await get(ref(dbRefs.db, "rakeb/settings/default"));

      let cutoffTimeStr = "13:15";
      let isCutoffEnabled = false;
      if (settingsSnap.exists()) {
        const s = settingsSnap.val();
        if (s.cutoffTime) cutoffTimeStr = s.cutoffTime;
        if (s.cutoffEnabled === true) isCutoffEnabled = true;
      }

      if (isCutoffEnabled) {
        const [cutoffHours, cutoffMinutes] = cutoffTimeStr.split(":").map(Number);
        const cutoff = new Date(year, month - 1, day);
        cutoff.setDate(cutoff.getDate() - 1);
        cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);

        const now = Date.now() + serverTimeOffset;
        if (now > cutoff.getTime()) {
          const proceed = window.confirm(
            `⚠️ تحذير: موعد غلق التسجيل لرحلة الغد (${cutoffTimeStr}) قد انقضى بالفعل!\nإذا قمت بإنهاء هذه الرحلة الآن، فلن يتمكن الطلاب من التسجيل لرحلة الغد.\n\nهل أنت متأكد من رغبتك في إنهاء الرحلة الآن؟`
          );
          if (!proceed) {
            setIsCompleting(false);
            return;
          }
        }
      }

      // Read daily status for metadata enrichment
      const dailyStatusSnapshot = await TripRepository.readDailyStatusSnapshot(
        dbRefs.db,
        activeDateKey,
      );

      const result = await completeTrip({
        db: dbRefs.db,
        activeDateKey,
        serverTimeOffset,
        tripSnapshot: raw,
        adminUid: user?.uid ?? "unknown",
        dailyStatusSnapshot,
        totalStations: stations.length,
      });

      if (result.alreadyCompleted) {
        toast.info("تم إنهاء اليوم بالفعل — لم يتم إجراء أي تغييرات.");
      } else {
        toast.success(`تم إنهاء اليوم بنجاح! اليوم التالي: ${result.nextDateKey}`);
      }
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إنهاء اليوم");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleStartDay = async () => {
    if (!dbRefs || !user) return;
    try {
      await startDay({
        db: dbRefs.db,
        activeDateKey,
        serverTimeOffset,
        adminUid: user.uid,
      });
      toast.success("تم بدء اليوم وتفعيل النظام للطلاب!");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء بدء اليوم");
    }
  };



  const handleDepartStation = async () => {
    if (!dbRefs || !displayedVehicle || !displayedVehicle.currentStationId || !isControllingDisplayed) return;

    const currentIndex = stations.findIndex((s) => s.id === displayedVehicle.currentStationId);
    const isLastPickupStation = currentIndex === stations.length - 1;

    try {
      await departStation({
        db: dbRefs.db,
        vehicleId: displayedVehicle.id,
        currentStationId: displayedVehicle.currentStationId,
        nextStationId: isLastPickupStation
          ? "creativa"
          : (stations[currentIndex + 1]?.id ?? "creativa"),
        isFinalPickup: isLastPickupStation,
        serverTimeOffset,
        adminUid: user?.uid ?? "unknown",
        activeDateKey,
      });

      toast.success(
        isLastPickupStation
          ? "الباص يتحرك الآن نحو كرياتيفا (الوجهة النهائية)!"
          : "الباص يتحرك الآن للنقطة التالية!",
      );
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء مغادرة النقطة");
    }
  };

  const handleArriveAtStation = async () => {
    if (!dbRefs || stations.length === 0 || !displayedVehicle || !isControllingDisplayed) return;

    // Arriving at final destination Creativa
    if (
      displayedVehicle.nextStationId === "creativa" ||
      (displayedVehicle.lastStationId === stations[stations.length - 1]?.id && !displayedVehicle.currentStationId)
    ) {
      setShowEndTripDialog(true);
      return;
    }

    if (!displayedVehicle.nextStationId) return;

    try {
      const nextIndex = stations.findIndex((s) => s.id === displayedVehicle.nextStationId);
      const isNextStationLastPickup = nextIndex === stations.length - 1;

      await arriveAtStation({
        db: dbRefs.db,
        vehicleId: displayedVehicle.id,
        stationId: displayedVehicle.nextStationId,
        nextStationId: isNextStationLastPickup ? "creativa" : stations[nextIndex + 1].id,
        isLastPickup: isNextStationLastPickup,
        serverTimeOffset,
        adminUid: user?.uid ?? "unknown",
        activeDateKey,
      });

      toast.success(`تم الوصول إلى نقطة ${stations[nextIndex].name}`);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء الوصول للنقطة");
    }
  };

  const handleToggleBoarding = async (userId: string, currentBoardedState: boolean) => {
    if (!dbRefs || !displayedVehicle || !isControllingDisplayed) return;
    try {
      if (currentBoardedState) {
        // They are boarded, so we unboard them
        await TripRepository.unboardStudent(
          dbRefs.db,
          activeDateKey,
          userId,
          displayedVehicle.id,
          user?.uid ?? "unknown",
        );
      } else {
        // They are NOT boarded, so we board them
        await TripRepository.boardStudent(
          dbRefs.db,
          activeDateKey,
          userId,
          displayedVehicle.id,
          user?.uid ?? "unknown"
        );
      }
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء تحديث حالة الطالب");
    }
  };

  const isHeadingToCreativa =
    nextStationId === "creativa" || lastStationId === stations[stations.length - 1]?.id;

  // Filter passengers by station for Live Boarding
  const getStationPassengers = (stationId: string) => {
    return passengers
      .filter((p: any) => p.status === "riding" && p.station === stationId)
      .map((p: any) => {
        const record = recordsByStudent[p.id];
        const isBoarded = record?.status === "boarded";
        const vehicleName = isBoarded && record?.vehicleId
          ? getVehicleLabel(record.vehicleId, vehicles)
          : undefined;
        return {
          id: p.id,
          name: p.fullName || "غير معروف",
          phone: p.phone || "---",
          boarded: isBoarded,
          vehicleName,
          locationLink: p.customLocation
            ? `https://maps.google.com/?q=${p.customLocation.lat},${p.customLocation.lng}`
            : undefined,
        };
      });
  };

  const customLocationPassengers = passengers
    .filter((p: any) => p.status === "riding" && p.station === "custom")
    .map((p: any) => {
      const record = recordsByStudent[p.id];
      const isBoarded = record?.status === "boarded";
      const vehicleName = isBoarded && record?.vehicleId
        ? getVehicleLabel(record.vehicleId, vehicles)
        : undefined;
      return {
        id: p.id,
        name: p.fullName || "غير معروف",
        phone: p.phone || "---",
        boarded: isBoarded,
        vehicleName,
        customLocationName: p.customLocation?.name,
        locationLink: p.customLocation
          ? `https://maps.google.com/?q=${p.customLocation.lat},${p.customLocation.lng}`
          : undefined,
      };
    });

  const customStudentMarkers = useMemo(() => {
    return passengers
      .filter((p: any) => p.status === "riding" && p.station === "custom" && p.customLocation?.lat && p.customLocation?.lng)
      .map((p: any) => ({
        id: p.id,
        studentName: p.fullName || "طالب",
        locationName: p.customLocation.name || "موقع مخصص",
        lat: Number(p.customLocation.lat),
        lng: Number(p.customLocation.lng),
      }));
  }, [passengers]);

  if (stationsLoading) {
    return (
      <div className="space-y-5 pt-2 pb-20">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Show trip is in pre-planning (pending) mode — "planning" is only relevant before trip starts
  const showPlanningPanel = tripStatus === "pending";

  return (
    <div className="space-y-4 lg:space-y-5 pt-2 pb-20 relative">
      <div className="px-1">
        <h1 className="text-lg sm:text-xl font-bold text-foreground">إدارة الرحلة والتخطيط</h1>
        <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-0.5">
          التحكم في المركبات ومتابعةالطلاب
        </p>
      </div>

      {/* Segmented Control for Mobile */}
      {displayedVehicle && !showPlanningPanel && (
        <div className="flex mb-5 border-b border-border/50 sticky top-16 z-30 bg-background/95 backdrop-blur-sm lg:hidden mx-[-16px] px-4 w-[calc(100%+32px)]">
          <button
            className={`flex-1 py-3.5 text-center font-bold text-sm relative transition-colors ${activeTab === "trip" ? "text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
            onClick={() => setActiveTab("trip")}
          >
            حالة المركبة
            {activeTab === "trip" && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-sm" />
            )}
          </button>
          <button
            className={`flex-1 py-3.5 text-center font-bold text-sm relative transition-colors ${activeTab === "passengers" ? "text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
            onClick={() => setActiveTab("passengers")}
          >
            الركاب
            {activeTab === "passengers" && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-sm" />
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className={`lg:col-span-1 space-y-5 ${activeTab !== "trip" ? "hidden lg:block" : "block"}`}
        >
          {/* Vehicle Planning Panel — shown before trip starts */}
          {showPlanningPanel && (
            <VehiclePlanning
              vehicles={vehicles}
              confirmedStudents={confirmedStudents}
              onAddVehicle={handleAddVehicle}
              onRemoveVehicle={handleRemoveVehicle}
              onUpdateCapacity={handleUpdateCapacity}
              onStartDay={handleStartDay}
            />
          )}

          {/* Active Vehicles Panel — shown once trip starts. Keep visible always */}
          {!showPlanningPanel && (
            <>
              <ActiveVehicles
                vehicles={vehicles}
                adminUid={user?.uid ?? "unknown"}
                onTakeControl={handleTakeControl}
                onReleaseControl={handleReleaseControl}
                onSelectVehicle={setSelectedVehicleId}
                selectedVehicleId={displayedVehicle?.id}
              />
              {vehicles.length > 0 && vehicles.every(v => v.status === "ended") && (
                <div className="bg-card shadow-card rounded-2xl p-4 border border-border mt-5 flex flex-col items-center justify-center text-center">
                  <h3 className="text-lg font-bold text-foreground mb-2">اكتملت جميع رحلات اليوم</h3>
                  <p className="text-[13px] text-muted-foreground mb-4">
                    تم إنهاء جميع المركبات بنجاح. يمكنك الآن إنهاء اليوم والانتقال لليوم التالي.
                  </p>
                  <Button
                    size="lg"
                    onClick={handleEndDay}
                    disabled={isCompleting}
                    className="w-full sm:w-auto px-8 gap-2 font-semibold shadow-sm"
                  >
                    {isCompleting ? "جاري الإنهاء..." : "إنهاء اليوم والانتقال لليوم التالي"}
                  </Button>
                </div>
              )}
            </>
          )}

          {displayedVehicle && !showPlanningPanel && (
            <>
              <VehicleControls
                vehicle={displayedVehicle}
                isLocationEnabled={isLocationEnabled}
                onTakeControl={handleStartTrip}
                onReleaseControl={() => handleReleaseControl(displayedVehicle.id)}
                onDepartStation={handleDepartStation}
                onEndVehicle={handleEndTrip}
                endVehicleDisabled={isCompleting || !isControllingDisplayed}
                endVehicleLoading={isCompleting}
                canTakeControl={isControllingDisplayed}
              />

              <div className="h-[250px] rounded-2xl overflow-hidden border border-border/50 shadow-sm relative z-0">
                <AdminStationsMap
                  stations={stations}
                  customLocationMarkers={customStudentMarkers}
                  activeStationId={displayedVehicle.currentStationId || displayedVehicle.nextStationId}
                />
              </div>

              <StationTimeline
                status={displayedVehicle.status === "running" ? (displayedVehicle.currentStationId ? "waiting_at_station" : "moving") : (displayedVehicle.status === "planned" ? "pending" : "completed")}
                currentStationId={displayedVehicle.currentStationId || null}
                lastStationId={displayedVehicle.lastStationId || null}
                nextStationId={displayedVehicle.nextStationId || null}
              />
            </>
          )}
        </div>

        <div
          className={`lg:col-span-2 space-y-5 ${activeTab !== "passengers" ? "hidden lg:block" : "block"}`}
        >
          {!displayedVehicle || showPlanningPanel ? (
            <TripSummary passengers={passengers} stations={stations} />
          ) : displayedVehicle.status === "running" || displayedVehicle.status === "full" ? (
            <motion.div
              className="space-y-5"
              initial={mounted ? false : "hidden"}
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
            >
              {!displayedVehicle.currentStationId && (
                <motion.div initial={mounted ? false : "hidden"} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="bg-card rounded-2xl p-8 shadow-card flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 animate-bounce">
                    <span className="text-3xl">🚌</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    {isHeadingToCreativa ? "الباص في طريقه إلى كرياتيفا" : "الباص يتحرك الآن"}
                  </h3>
                  <p className="text-[13px] text-muted-foreground mb-6 max-w-sm">
                    {isHeadingToCreativa
                      ? "الباص في طريقه إلى الوجهة النهائية (مركز كرياتيفا). عند الوصول، اضغط لإنهاء الرحلة."
                      : "الباص في طريقه إلى النقطة التالية. اضغط لتأكيد التوقف وتسجيل صعود الركاب."}
                  </p>

                  <LongPressButton
                    size="lg"
                    onComplete={handleArriveAtStation}
                    className="w-full sm:w-auto px-8 gap-2 font-semibold shadow-sm"
                  >
                    {isHeadingToCreativa ? (
                      <>
                        <Flag className="w-5 h-5" strokeWidth={2} />
                        الوصول إلى كرياتيفا وإنهاء الرحلة (اضغط مطولاً)
                      </>
                    ) : (
                      <>
                        <span className="text-lg">📍</span>
                        الوصول للنقطة التالية (اضغط مطولاً)
                      </>
                    )}
                  </LongPressButton>
                </motion.div>
              )}

              {stations.map((station, idx) => {
                const sp = getStationPassengers(station.id);
                // Don't render empty stations unless it's the current active station
                if (sp.length === 0 && displayedVehicle.currentStationId !== station.id) return null;

                const isActiveStation =
                  displayedVehicle.currentStationId === station.id && displayedVehicle.status === "running";
                return (
                  <motion.div
                    key={station.id}
                    initial={mounted ? false : "hidden"}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    className={
                      isActiveStation
                        ? "sticky top-32 z-20 ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl bg-card shadow-lg"
                        : "opacity-80 hover:opacity-100 transition-opacity"
                    }
                  >
                    <BoardingList
                      stationName={station.name}
                      passengers={sp}
                      onConfirmBoarding={(id) => {
                        const p = sp.find((x: any) => x.id === id);
                        if (p) handleToggleBoarding(p.id, p.boarded);
                      }}
                      onDepartStation={(isActiveStation && isControllingDisplayed) ? handleDepartStation : undefined}
                      isLastStation={station.id === stations[stations.length - 1]?.id}
                    />
                  </motion.div>
                );
              })}

              {customLocationPassengers.length > 0 && (
                <motion.div initial={mounted ? false : "hidden"} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-2 opacity-80 hover:opacity-100 transition-opacity">
                  <BoardingList
                    stationName="طلاب في مواقع مخصصة"
                    passengers={customLocationPassengers}
                    onConfirmBoarding={(id) => {
                      const p = customLocationPassengers.find((x: any) => x.id === id);
                      if (p) handleToggleBoarding(p.id, p.boarded);
                    }}
                    onDepartStation={undefined}
                    isLastStation={false}
                  />
                </motion.div>
              )}
            </motion.div>
          ) : displayedVehicle.status === "ended" ? (
            <div className="bg-card rounded-2xl p-8 shadow-card flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center text-success">
                <CheckCircle2 className="w-8 h-8" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">اكتملت الرحلة بنجاح</h3>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
                  وصل الباص إلى الوجهة النهائية (مركز كرياتيفا). جاري الانتقال لليوم التالي...
                </p>
              </div>
            </div>
          ) : (
            <TripSummary passengers={passengers} stations={stations} />
          )}
        </div>
      </div>

      <AlertDialog open={showEndTripDialog} onOpenChange={setShowEndTripDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من رغبتك في إنهاء الرحلة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيؤدي هذا الإجراء إلى إنهاء مسار المركبة الحالي وإعلام جميع الطلاب بأنه تم اكتمال الرحلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEndTripDialog(false);
                handleEndTrip();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              إنهاء الرحلة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
