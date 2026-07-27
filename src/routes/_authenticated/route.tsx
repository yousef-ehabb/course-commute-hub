import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { ActiveDateProvider } from "@/contexts/ActiveDateContext";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedGuard,
});

function AuthedGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <ActiveDateProvider>
      <Outlet />
    </ActiveDateProvider>
  );
}
