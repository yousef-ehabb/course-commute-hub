import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStations } from "@/contexts/StationsContext";
import { useTripStatus } from "@/hooks/useTripStatus";
import { getStation } from "@/utils/stationResolver";
import { StationTimeline } from "@/components/admin/StationTimeline";
import React, { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const TrackMap = React.lazy(() => import("@/components/student/TrackMap"));
import { Button } from "@/components/ui/button";

export const Route = createLazyFileRoute("/_authenticated/student/track")({
  component: TrackBusPage,
});

function TrackBusPage() {
  const {
    stations,
    loading: stationsLoading,
    error: stationsError,
    retry: retryStations,
  } = useStations();
  const {
    status: tripStatus,
    currentStationId,
    nextStationId,
    lastStationId,
    location,
    licensePlate,
    error: tripError,
    retry: retryTrip,
    loaded: tripLoaded,
  } = useTripStatus();

  const error = stationsError || tripError;
  const handleRetry = () => {
    retryStations();
    retryTrip();
  };
  const [busLocation, setBusLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (stations.length === 0) return;

    if ((tripStatus === "waiting_at_station" || tripStatus === "moving") && location) {
      setBusLocation([location.lat, location.lng]);
    } else if (tripStatus === "waiting_at_station" && currentStationId) {
      const st = getStation(currentStationId, stations);
      if (st) setBusLocation([st.latitude, st.longitude]);
    } else if (tripStatus === "moving" && lastStationId) {
      const st = getStation(lastStationId, stations);
      if (st) setBusLocation([st.latitude, st.longitude]);
    } else {
      setBusLocation(null);
    }
  }, [tripStatus, location, currentStationId, lastStationId, stations]);

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

  if (stationsLoading || !tripLoaded) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
        <Skeleton className="flex-1 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl mt-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4 flex justify-between items-start">
        <div>
          <h1 className="text-lg font-semibold text-foreground">تتبع الباص</h1>
          <p className="text-[13px] text-muted-foreground">تابع حركة الباص لحظة بلحظة</p>
        </div>
        {licensePlate && (
          <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20 flex flex-col items-center">
            <span className="text-[10px] font-medium opacity-80">رقم الباص</span>
            <span className="text-sm font-bold whitespace-nowrap">{licensePlate}</span>
          </div>
        )}
      </div>

      <div className="flex-1 relative rounded-2xl overflow-hidden shadow-card z-0 bg-gray-100 dark:bg-gray-800">
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-muted-foreground">جاري تحميل الخريطة...</div>}>
          <TrackMap busLocation={busLocation} />
        </Suspense>
      </div>

      <div className="mt-4">
        <StationTimeline
          status={tripStatus}
          currentStationId={currentStationId}
          nextStationId={nextStationId}
          lastStationId={lastStationId}
        />
      </div>
    </div>
  );
}
