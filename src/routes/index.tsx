import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, CheckCircle2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RakebLogo } from "@/components/ui/RakebLogo";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "راكب — إدارة باص التدريب" },
      {
        name: "description",
        content: "أكد حضورك، اختر نقطة التجمع المناسبة، وتابع الباص حتى وصوله.",
      },
      { property: "og:title", content: "راكب — إدارة باص التدريب" },
      {
        property: "og:description",
        content: "منصة عربية احترافية لتنظيم حضور متدربي الكورسات والفعاليات.",
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
            <span>جاي ولا الدور الجاي؟</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground tracking-tight max-w-3xl mx-auto">
            كل حاجه تخص باص التدريب <span className="text-primary">في مكان واحد</span>
          </h1>

          <p className="mx-auto max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            أكد حضورك، اختار نقطة التجمع المناسبة ليك، وتابع الباص لحد ما يوصل.
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
              title: "تتبع الباص",
              desc: "شوف الباص فين دلوقتي واعرف هيوصل نقطة التجمع إمتى.",
            },
            {
              icon: Navigation,
              title: "نقطة التجمع",
              desc: "اختار نقطة التجمع المناسبة ليك واعرف معاد وصول الباص.",
            },
            {
              icon: CheckCircle2,
              title: "تأكيد الحضور",
              desc: "أكد حضورك علشان يبقى اسمك موجود في كشف باص التدريب.",
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
        راكب — نظام إدارة باص التدريب
      </footer>
    </div>
  );
}
