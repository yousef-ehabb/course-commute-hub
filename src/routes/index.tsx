import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Bus, MapPin, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "راكب — إدارة مواصلات الكورسات" },
      { name: "description", content: "سجل ركوبك، اتبع الأوتوبيس مباشرة، وأدر رحلاتك ومحطاتك في مكان واحد." },
      { property: "og:title", content: "راكب — إدارة مواصلات الكورسات" },
      { property: "og:description", content: "منصة عربية احترافية لتنظيم مواصلات الكورسات والفعاليات." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-primary">
          <Bus className="h-7 w-7" />
          <span className="text-2xl font-extrabold">راكب</span>
        </div>
        <nav className="flex gap-3">
          <Link
            to="/login"
            className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
          >
            دخول
          </Link>
          <Link
            to="/register"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            سجل الآن
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="text-center">
          <h1 className="text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
            نظّم مواصلات كورساتك <span className="text-primary">في دقيقة</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            سجل ركوبك، اعرف ميعاد الأوتوبيس، واتبع مكانه مباشرة على الخريطة. والأدمن يدير الطلاب والمحطات والرحلات من مكان واحد.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="rounded-lg bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95"
            >
              سجل كطالب
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-input bg-background px-6 py-3 text-base font-bold hover:bg-accent hover:text-accent-foreground"
            >
              دخول الأدمن
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: MapPin, title: "تتبع لحظي", desc: "شوف الأوتوبيس على الخريطة وحالة كل محطة." },
            { icon: Users, title: "إدارة كاملة", desc: "طلاب، محطات، ورحلات في لوحة تحكم واحدة." },
            { icon: ShieldCheck, title: "تأكيد صعود", desc: "كل طالب يتأكد ركوبه، وتصدير Excel و PDF." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        صُنع بحب — راكب v2
      </footer>
    </div>
  );
}
