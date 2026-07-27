import { createFileRoute } from "@tanstack/react-router";
import { StudentGuard } from "@/components/guards/StudentGuard";
import { AppShell } from "@/components/layout/AppShell";
import { TripStatusProvider } from "@/hooks/useTripStatus";
import { TodayStatusProvider } from "@/hooks/useTodayStatus";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentRouteLayout,
});

function StudentRouteLayout() {
  return (
    <StudentGuard>
      <TodayStatusProvider>
        <TripStatusProvider>
          <AppShell />
        </TripStatusProvider>
      </TodayStatusProvider>
    </StudentGuard>
  );
}
