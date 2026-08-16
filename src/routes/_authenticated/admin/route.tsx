import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TodayStatusProvider } from "@/hooks/useTodayStatus";
import { BoardingRecordsProvider } from "@/hooks/useBoardingRecords";
import { TripStatusProvider } from "@/hooks/useTripStatus";
import { VehiclesProvider } from "@/hooks/useVehicles";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { useCourse } from "@/contexts/CourseContext";
import { reconcileOnStartup } from "@/lib/tripService";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminRouteLayout,
});

function AdminStartupInitializer({ children }: { children: React.ReactNode }) {
  const { activeDateKey, loaded } = useActiveDate();
  const { courseId } = useCourse();
  const reconciledKeysRef = useRef<Record<string, boolean>>({});
  const key = `${courseId}-${activeDateKey}`;

  useEffect(() => {
    if (!loaded || reconciledKeysRef.current[key]) return;
    reconciledKeysRef.current[key] = true;

    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const db = getFirebaseDb();
        await reconcileOnStartup(db, activeDateKey, courseId);
      } catch (err) {
        console.warn("[AdminStartup] Reconciliation pass error:", err);
      }
    })();
  }, [activeDateKey, loaded, courseId, key]);

  return <>{children}</>;
}

function AdminRouteLayout() {
  return (
    <AdminGuard>
      <AdminStartupInitializer>
        <TodayStatusProvider>
          <BoardingRecordsProvider>
            <TripStatusProvider>
              <VehiclesProvider>
                <AdminLayout />
              </VehiclesProvider>
            </TripStatusProvider>
          </BoardingRecordsProvider>
        </TodayStatusProvider>
      </AdminStartupInitializer>
    </AdminGuard>
  );
}
