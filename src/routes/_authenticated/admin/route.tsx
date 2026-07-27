import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TodayStatusProvider } from "@/hooks/useTodayStatus";
import { TripStatusProvider } from "@/hooks/useTripStatus";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { reconcileOnStartup } from "@/lib/tripService";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminRouteLayout,
});

function AdminStartupInitializer({ children }: { children: React.ReactNode }) {
  const { activeDateKey, loaded } = useActiveDate();
  const hasReconciledRef = useRef(false);

  useEffect(() => {
    if (!loaded || hasReconciledRef.current) return;
    hasReconciledRef.current = true;

    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const db = getFirebaseDb();
        await reconcileOnStartup(db, activeDateKey);
      } catch (err) {
        console.warn("[AdminStartup] Reconciliation pass error:", err);
      }
    })();
  }, [activeDateKey, loaded]);

  return <>{children}</>;
}

function AdminRouteLayout() {
  return (
    <AdminGuard>
      <AdminStartupInitializer>
        <TodayStatusProvider>
          <TripStatusProvider>
            <AdminLayout />
          </TripStatusProvider>
        </TodayStatusProvider>
      </AdminStartupInitializer>
    </AdminGuard>
  );
}
