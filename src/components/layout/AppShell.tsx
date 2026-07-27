import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, Map, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RakebLogo } from "@/components/ui/RakebLogo";

export function AppShell() {
  const routerState = useRouterState();
  const { profile } = useAuth();
  const currentPath = routerState.location.pathname;

  const navItems = [
    { name: "الرئيسية", icon: Home, path: "/student/home" },
    { name: "تتبع الباص", icon: Map, path: "/student/track" },
    { name: "حسابي", icon: User, path: "/student/profile" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Minimal Top Bar */}
      <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-xl border-b border-border/40">
        <div className="mx-auto max-w-md px-5 h-14 flex items-center justify-center">
          <Link to="/student/home">
            <RakebLogo size="md" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-24">
        <div className="mx-auto max-w-md px-5 py-4">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation — Frosted Glass */}
      <nav className="fixed bottom-0 w-full z-50 bg-card/80 backdrop-blur-xl shadow-nav">
        <div className="flex justify-around items-center max-w-md mx-auto px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path === "/student/home" && currentPath === "/student");
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-1 py-1 min-w-[4rem] transition-colors"
              >
                <div
                  className={`flex items-center justify-center w-10 h-8 rounded-2xl transition-all duration-200 ${
                    isActive ? "bg-primary/10" : ""
                  }`}
                >
                  <item.icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors duration-200 ${
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
