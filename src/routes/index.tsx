import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RakebLogo } from "@/components/ui/RakebLogo";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "راكب — إدارة مواصلات الكورسات" },
      {
        name: "description",
        content: "سجل ركوبك، اتبع الأوتوبيس مباشرة، وأدر رحلاتك ومحطاتك في مكان واحد.",
      },
      { property: "og:title", content: "راكب — إدارة مواصلات الكورسات" },
      {
        property: "og:description",
        content: "منصة عربية احترافية لتنظيم مواصلات الكورسات والفعاليات.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/">
          <RakebLogo size="lg" />
        </Link>
        <nav className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="font-semibold text-muted-foreground hover:text-foreground"
          >
            <Link to="/login">دخول</Link>
          </Button>
          <Button asChild size="sm" className="font-semibold shadow-sm">
            <Link to="/register">سجل الآن</Link>
          </Button>
        </nav>
      </header>

      {/* Main Hero */}
      <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <section className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold">
            <span>نظام إدارة مواصلات الكورسات والفعاليات</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight text-foreground tracking-tight max-w-3xl mx-auto">
            نظّم مواصلات كورساتك <span className="text-primary">بسهولة وأمان</span>
          </h1>

          <p className="mx-auto max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            سجل ركوبك اليومي، اعرف ميعاد الباص، وتتبّع حركته لحظة بلحظة على الخريطة من واجهة واحدة
            بسيطة.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="h-12 px-8 text-base font-bold shadow-elevated">
              <Link to="/register">سجل كطالب</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base font-bold">
              <Link to="/login">دخول الأدمن</Link>
            </Button>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: MapPin,
              title: "تتبع لحظي",
              desc: "شوف الباص على الخريطة مباشرة وتتبّع وصوله لكل محطة.",
            },
            {
              icon: Users,
              title: "إدارة متكاملة",
              desc: "تنظيم الطلاب والمحطات والرحلات اليومية بمرونة عالية.",
            },
            {
              icon: ShieldCheck,
              title: "تأكيد صعود",
              desc: "تأكيد صعود كل طالب بسهولة وتصدير كشوفات الرحلة.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-card p-6 shadow-card space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <f.icon className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        راكب — نظام إدارة مواصلات الكورسات
      </footer>
    </div>
  );
}
