import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Route guard that only allows authenticated students.
 * - Loading → full-screen spinner (no UI leak)
 * - Not authenticated → redirect to /login
 * - Authenticated but not student → redirect to /admin/dashboard
 * - Student → render children
 */
export function StudentGuard({ children }: { children: ReactNode }) {
  const { isStudent, isAuthenticated, loading, error, retryAuth } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 px-4 text-center bg-background dir-rtl">
        <p className="text-destructive font-semibold text-base">{error}</p>
        <button
          onClick={retryAuth}
          className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm text-sm"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isStudent) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
