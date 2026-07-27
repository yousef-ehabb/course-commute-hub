import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Map,
  BarChart3,
  Settings,
  MapPin,
  History,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RakebLogo } from "@/components/ui/RakebLogo";
import { Button } from "@/components/ui/button";

export function AdminLayout() {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();
  const currentPath = routerState.location.pathname;

  const navItems = [
    { name: "الرئيسية", icon: LayoutDashboard, path: "/admin/dashboard" },
    { name: "الطلاب", icon: Users, path: "/admin/students" },
    { name: "المحطات", icon: MapPin, path: "/admin/stations" },
    { name: "الرحلات", icon: Map, path: "/admin/trips" },
    { name: "السجل", icon: History, path: "/admin/history" },
    { name: "إحصائيات", icon: BarChart3, path: "/admin/stats" },
    { name: "إعدادات", icon: Settings, path: "/admin/settings" },
  ];

  const handleLogout = async () => {
    await signOutUser();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-xl shadow-card">
        <div className="container mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/admin/dashboard">
              <RakebLogo size="md" />
            </Link>
            <span className="text-[11px] bg-primary/8 text-primary px-2 py-0.5 rounded-lg font-semibold">
              Admin
            </span>
          </div>
          {profile && (
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-muted-foreground hidden sm:block">
                {profile.fullName.split(" ")[0]}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block fixed rtl:right-0 ltr:left-0 top-14 h-[calc(100vh-3.5rem)] w-60 bg-card/50 backdrop-blur-sm z-30">
          <nav className="p-3 space-y-1 mt-2">
            {navItems.map((item) => {
              const isActive = currentPath.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 ${
                    isActive
                      ? "bg-primary/8 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[14px]">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 lg:pl-60 rtl:lg:pl-0 rtl:lg:pr-60 pb-24 lg:pb-6">
          <div className="container mx-auto p-3 md:p-5 max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom Navigation (Mobile & Tablet) */}
      <nav className="lg:hidden fixed bottom-0 w-full z-50 bg-card/80 backdrop-blur-xl shadow-nav border-t border-border/50">
        <div className="flex overflow-x-auto gap-1 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&::-webkit-scrollbar]:hidden snap-x justify-around sm:justify-start">
          {navItems.map((item) => {
            const isActive = currentPath.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="snap-center flex flex-col items-center justify-center gap-1 py-2 flex-shrink-0 min-w-[4.5rem] transition-colors"
              >
                <div
                  className={`flex items-center justify-center w-12 h-8 rounded-xl transition-all duration-200 ${
                    isActive ? "bg-primary/10" : ""
                  }`}
                >
                  <item.icon
                    className={`w-6 h-6 transition-colors duration-200 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
