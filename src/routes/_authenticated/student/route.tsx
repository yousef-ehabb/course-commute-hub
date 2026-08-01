import { createFileRoute } from "@tanstack/react-router";
import { StudentGuard } from "@/components/guards/StudentGuard";
import { AppShell } from "@/components/layout/AppShell";
import { TripStatusProvider } from "@/hooks/useTripStatus";
import { TodayStatusProvider } from "@/hooks/useTodayStatus";
import { StudentBoardingRecordProvider } from "@/hooks/useStudentBoardingRecord";
import { VehiclesProvider } from "@/hooks/useVehicles";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentRouteLayout,
});

function StudentRouteLayout() {
  return (
    <StudentGuard>
      <TodayStatusProvider>
        <StudentBoardingRecordProvider>
          <VehiclesProvider>
            <TripStatusProvider>
              <AppShell />
            </TripStatusProvider>
          </VehiclesProvider>
        </StudentBoardingRecordProvider>
      </TodayStatusProvider>
    </StudentGuard>
  );
}

