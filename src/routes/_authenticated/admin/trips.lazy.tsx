import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { TripControls } from "@/components/admin/TripControls";
import { StationTimeline } from "@/components/admin/StationTimeline";
import { BoardingList } from "@/components/admin/BoardingList";
import { TripSummary } from "@/components/admin/TripSummary";
import { useStations } from "@/contexts/StationsContext";
import { useTripStatus } from "@/hooks/useTripStatus";
import { useTodayStatus, type DailyRecord } from "@/hooks/useTodayStatus";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { toast } from "sonner";
import { Flag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  startTrip,
  completeTrip,
  departStation,
  arriveAtStation,
  toggleBoarding,
  FirebaseTripError,
} from "@/lib/tripService";
import { TripRepository } from "@/lib/TripRepository";
import { useAuth } from "@/contexts/AuthContext";

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
  const { activeDateKey, serverTimeOffset } = useActiveDate();
  const { user } = useAuth();

  const [dbRefs, setDbRefs] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"trip" | "passengers">("trip");
  const [mounted, setMounted] = useState(false);

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
          setUsers(Object.entries(val).map(([uid, u]: [string, any]) => ({ uid, ...u })));
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

  const handleStartTrip = async (licensePlate: string) => {
    if (!dbRefs || stations.length === 0) return;
    try {
      await startTrip({
        db: dbRefs.db,
        tripPath: dbRefs.tripPath,
        dailyPath: dbRefs.dailyPath,
        firstStationId: stations[0].id,
        secondStationId: stations.length > 1 ? stations[1].id : null,
        passengerIds: passengers.map((p: any) => p.id),
        serverTimeOffset,
        adminUid: user?.uid ?? "unknown",
        activeDateKey,
        licensePlate: licensePlate || undefined,
      });

      toast.success("تم بدء الرحلة بنجاح!");

      if ("geolocation" in navigator) {
        const id = navigator.geolocation.watchPosition(
          async (pos) => {
            setIsLocationEnabled(true);
            try {
              await TripRepository.updateLocation(dbRefs.db, dbRefs.tripPath, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                updatedAt: Date.now(),
              });
            } catch (locErr) {
              console.warn("[Trips] Location update failed:", locErr);
            }
          },
          () => {
            setIsLocationEnabled(false);
            toast.error("فشل تتبع الموقع. يرجى تفعيل إذن الـ GPS في متصفحك.");
          },
          { enableHighAccuracy: true },
        );
        watchIdRef.current = id;
      } else {
        toast.error("متصفحك لا يدعم تحديد الموقع الجغرافي.");
      }
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء بدء الرحلة");
    }
  };

  const handleEndTrip = async () => {
    if (!dbRefs || isCompleting) return;
    setIsCompleting(true);
    try {
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

      // Stop GPS tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsLocationEnabled(false);
      }

      if (result.alreadyCompleted) {
        toast.info("الرحلة مكتملة بالفعل — لم يتم إجراء أي تغييرات.");
      } else {
        toast.success(`تم الوصول إلى كرياتيفا وإنهاء الرحلة! اليوم التالي: ${result.nextDateKey}`);
      }
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إنهاء الرحلة");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDepartStation = async () => {
    if (!dbRefs || !currentStationId) return;

    const currentIndex = stations.findIndex((s) => s.id === currentStationId);
    const isLastPickupStation = currentIndex === stations.length - 1;

    try {
      await departStation({
        db: dbRefs.db,
        tripPath: dbRefs.tripPath,
        currentStationId,
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
    if (!dbRefs || stations.length === 0) return;

    // Arriving at final destination Creativa
    if (
      nextStationId === "creativa" ||
      (lastStationId === stations[stations.length - 1]?.id && !currentStationId)
    ) {
      handleEndTrip();
      return;
    }

    const nextIndex = stations.findIndex((s) => s.id === nextStationId);
    if (nextIndex === -1) {
      handleEndTrip();
      return;
    }

    try {
      const isNextStationLastPickup = nextIndex === stations.length - 1;

      await arriveAtStation({
        db: dbRefs.db,
        tripPath: dbRefs.tripPath,
        stationId: stations[nextIndex].id,
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
    if (!dbRefs) return;
    try {
      await toggleBoarding(dbRefs.db, dbRefs.dailyPath, userId, !currentBoardedState);
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
      .map((p: any) => ({
        id: p.id,
        name: p.fullName || "غير معروف",
        phone: p.phone || "---",
        boarded: p.boarded || false,
        locationLink: p.customLocation
          ? `https://maps.google.com/?q=${p.customLocation.lat},${p.customLocation.lng}`
          : undefined,
      }));
  };

  const customLocationPassengers = passengers
    .filter((p: any) => p.status === "riding" && p.station === "custom")
    .map((p: any) => ({
      id: p.id,
      name: p.fullName || "غير معروف",
      phone: p.phone || "---",
      boarded: p.boarded || false,
      locationLink: p.customLocation
        ? `https://maps.google.com/?q=${p.customLocation.lat},${p.customLocation.lng}`
        : undefined,
    }));

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

  return (
    <div className="space-y-0 lg:space-y-5 pt-2 pb-20 relative">
      <div className="px-1 hidden lg:block">
        <h1 className="text-xl font-semibold text-foreground">إدارة الرحلة</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          التحكم في رحلة اليوم وتأكيد الركاب
        </p>
      </div>

      {/* Segmented Control for Mobile */}
      <div className="flex w-full mb-5 border-b border-border/50 sticky top-16 z-30 bg-background/95 backdrop-blur-sm lg:hidden mx-[-16px] px-4 w-[calc(100%+32px)]">
        <button
          className={`flex-1 py-3.5 text-center font-bold text-sm relative transition-colors ${activeTab === "trip" ? "text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
          onClick={() => setActiveTab("trip")}
        >
          حالة الرحلة
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className={`lg:col-span-1 space-y-5 ${activeTab !== "trip" ? "hidden lg:block" : "block"}`}
        >
          <TripControls
            status={isCompleting ? "completing" : tripStatus}
            isLocationEnabled={isLocationEnabled}
            onStartTrip={handleStartTrip}
            onEndTrip={handleEndTrip}
            endTripDisabled={isCompleting}
            endTripLoading={isCompleting}
            totalPassengers={passengers.length}
            boardedPassengers={passengers.filter((p) => p.boarded).length}
          />
          <StationTimeline
            status={tripStatus}
            currentStationId={currentStationId}
            lastStationId={lastStationId}
            nextStationId={nextStationId}
          />
        </div>

        <div
          className={`lg:col-span-2 space-y-5 ${activeTab !== "passengers" ? "hidden lg:block" : "block"}`}
        >
          {tripStatus === "waiting_at_station" || tripStatus === "moving" ? (
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
              {tripStatus === "moving" && (
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

                  <Button
                    size="lg"
                    onClick={handleArriveAtStation}
                    className="w-full sm:w-auto px-8 gap-2 font-semibold shadow-sm"
                  >
                    {isHeadingToCreativa ? (
                      <>
                        <Flag className="w-5 h-5" strokeWidth={2} />
                        الوصول إلى كرياتيفا وإنهاء الرحلة
                      </>
                    ) : (
                      <>
                        <span className="text-lg">📍</span>
                        الوصول للنقطة التالية
                      </>
                    )}
                  </Button>
                </motion.div>
              )}

              {stations.map((station, idx) => {
                const sp = getStationPassengers(station.id);
                // Don't render empty stations unless it's the current active station
                if (sp.length === 0 && currentStationId !== station.id) return null;

                const isActiveStation =
                  currentStationId === station.id && tripStatus === "waiting_at_station";
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
                      onDepartStation={isActiveStation ? handleDepartStation : undefined}
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
          ) : tripStatus === "completed" ? (
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
    </div>
  );
}
