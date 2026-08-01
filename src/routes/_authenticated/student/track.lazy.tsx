import { createLazyFileRoute } from "@tanstack/react-router";
import { useStations } from "@/contexts/StationsContext";
import { useTripStatus } from "@/hooks/useTripStatus";
import { useVehicles } from "@/hooks/useVehicles";
import { useStudentBoardingRecord } from "@/hooks/useStudentBoardingRecord";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicleTabState } from "@/hooks/useVehicleTabState";

import { StationTimeline } from "@/components/admin/StationTimeline";
import { StudentVehicleStatus } from "@/components/student/StudentVehicleStatus";
import { VehicleTabStrip } from "@/components/student/VehicleTabStrip";
import { VehiclePassedCard } from "@/components/student/VehiclePassedCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import React, { Suspense, useMemo } from "react";

const TrackMap = React.lazy(() => import("@/components/student/TrackMap"));
import type { VehicleMarker } from "@/components/student/TrackMap";

export const Route = createLazyFileRoute("/_authenticated/student/track")({
  component: TrackBusPage,
});

function TrackBusPage() {
  const { profile } = useAuth();
  const {
    stations,
    loading: stationsLoading,
    error: stationsError,
    retry: retryStations,
  } = useStations();
  const {
    status: tripStatus,
    error: tripError,
    retry: retryTrip,
    loaded: tripLoaded,
  } = useTripStatus();
  const {
    vehicles,
    loaded: vehiclesLoaded,
    error: vehiclesError,
    retry: retryVehicles,
  } = useVehicles();
  const {
    record: boardingRecord,
    loaded: boardingLoaded,
    error: boardingError,
    retry: retryBoarding,
  } = useStudentBoardingRecord();

  const error = stationsError || tripError || vehiclesError || boardingError;
  const handleRetry = () => {
    retryStations();
    retryTrip();
    retryVehicles();
    retryBoarding();
  };

  const allLoaded = tripLoaded && vehiclesLoaded && boardingLoaded;

  // ── Tab State Machine ───────────────────────────────────────────────

  const {
    tabs,
    selectedTabId,
    setSelectedTabId,
    isLockedToVehicle,
    selectedVehicle,
  } = useVehicleTabState(
    vehicles,
    boardingRecord,
    stations,
    profile?.defaultStation,
  );

  const selectedTab = tabs.find((t) => t.vehicle.id === selectedTabId) || null;

  // ── Build vehicle markers for the map (only the selected vehicle) ──

  const vehicleMarkers = useMemo<VehicleMarker[]>(() => {
    if (!selectedVehicle || !selectedVehicle.currentLocation) return [];
    if (selectedVehicle.status !== "running" && selectedVehicle.status !== "full") {
      return [];
    }

    const isMine =
      boardingRecord?.status === "boarded" &&
      boardingRecord.vehicleId === selectedVehicle.id;
    const isFull =
      selectedVehicle.status === "full" ||
      selectedVehicle.occupiedSeats >= selectedVehicle.capacity;

    const currentTab = tabs.find((t) => t.vehicle.id === selectedVehicle.id);

    return [
      {
        id: selectedVehicle.id,
        position: [
          selectedVehicle.currentLocation.lat,
          selectedVehicle.currentLocation.lng,
        ] as [number, number],
        label: currentTab?.label || "المركبة",
        emoji: currentTab?.emoji || "🚐",
        variant: isMine ? "mine" : isFull ? "full" : "available",
      },
    ];
  }, [selectedVehicle, boardingRecord, tabs]);

  // ── Determine timeline status for the selected vehicle ──────────────

  const timelineStatus = useMemo(() => {
    if (!selectedVehicle) return tripStatus;
    if (selectedVehicle.status === "ended") return "completed" as const;
    if (selectedVehicle.status === "running" && selectedVehicle.currentStationId) {
      return "waiting_at_station" as const;
    }
    if (selectedVehicle.status === "running") return "moving" as const;
    return "pending" as const;
  }, [selectedVehicle, tripStatus]);

  // ── Error State ──────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 px-4 text-center">
        <p className="text-red-500 font-medium">
          تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.
        </p>
        <Button onClick={handleRetry}>إعادة المحاولة</Button>
      </div>
    );
  }

  // ── Loading State ────────────────────────────────────────────────────

  if (stationsLoading || !allLoaded) {
    return (
      <div className="flex flex-col space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[calc(100vh-10rem)] gap-2.5">
      {/* 1. Compact Vehicle Tab Strip (Navigation Pills) */}
      <VehicleTabStrip
        tabs={tabs}
        selectedTabId={selectedTabId}
        onTabSelect={setSelectedTabId}
        isLocked={isLockedToVehicle}
      />

      {/* 2. Main content area (Passed Card OR Map + Micro Banner) */}
      {selectedTab?.state === "passed" ? (
        <VehiclePassedCard
          passedTab={selectedTab}
          nextAvailableTab={tabs.find((t) => t.state === "active") || null}
          onSwitchToVehicle={setSelectedTabId}
        />
      ) : (
        <>
          {/* 2. Collapsed Micro Status Banner */}
          <StudentVehicleStatus
            tripStatus={tripStatus}
            vehicle={selectedVehicle}
            boardingRecord={boardingRecord}
            allVehicles={vehicles}
          />

          {/* 3. Hero Map — Dominates the page */}
          <div className="relative w-full h-[320px] sm:h-[400px] rounded-2xl overflow-hidden shadow-card z-0 bg-gray-100 dark:bg-gray-800 shrink-0">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  جاري تحميل الخريطة...
                </div>
              }
            >
              <TrackMap
                vehicleMarkers={vehicleMarkers}
                focusVehicleId={selectedTabId}
              />
            </Suspense>
          </div>

          {/* 4. Timeline */}
          {selectedVehicle && (
            <div className="pt-1 pb-4">
              <StationTimeline
                status={timelineStatus}
                currentStationId={selectedVehicle.currentStationId || null}
                nextStationId={selectedVehicle.nextStationId || null}
                lastStationId={selectedVehicle.lastStationId || null}
              />
            </div>
          )}
        </>
      )}

      {/* Fallback when no vehicles are active and trip is pending */}
      {!selectedVehicle && tripStatus === "pending" && (
        <div className="bg-card rounded-xl p-4 shadow-xs border border-border/50 text-center">
          <p className="text-[13px] text-muted-foreground">
            لسه مفيش مركبات شغالة النهارده. هنبلغك أول ما يبدأ التحرك.
          </p>
        </div>
      )}
    </div>
  );
}
