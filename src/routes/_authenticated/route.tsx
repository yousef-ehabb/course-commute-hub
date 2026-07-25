import { createFileRoute, Outlet, Navigate, Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Bus, Home, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, profile, loading, signOutUser } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جارٍ التحميل...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2 text-primary">
            <Bus className="h-6 w-6" />
            <span className="text-lg font-extrabold">راكب</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              to="/home"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Home className="h-4 w-4" />
              الرئيسية
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                <LayoutDashboard className="h-4 w-4" />
                الأدمن
              </Link>
            )}
            <span className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground md:inline-flex">
              <UserIcon className="h-4 w-4" />
              {profile?.fullName ?? user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOutUser();
                router.navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}