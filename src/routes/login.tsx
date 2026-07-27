import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RakebLogo } from "@/components/ui/RakebLogo";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "دخول — راكب" },
      { name: "description", content: "سجل الدخول إلى حساب راكب." },
      { property: "og:title", content: "دخول — راكب" },
      { property: "og:url", content: "/login" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
});

function LoginPage() {
  const { signIn, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return toast.error("Firebase غير مهيأ بعد. أضف مفاتيح الاتصال أولاً.");
    setLoading(true);
    try {
      await signIn(email.trim(), password);

      const { getFirebaseAuth, getFirebaseDb } = await import("@/lib/firebase");
      const { ref, get } = await import("firebase/database");
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        const snap = await get(ref(getFirebaseDb(), `rakeb/users/${currentUser.uid}`));
        const profile = snap.val();
        if (profile?.role === "admin") {
          navigate({ to: "/admin/dashboard", replace: true });
        } else {
          navigate({ to: "/student/home", replace: true });
        }
      } else {
        navigate({ to: "/student/home", replace: true });
      }

      toast.success("تم الدخول");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-elevated">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <RakebLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-center text-lg font-bold text-foreground">تسجيل الدخول</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px]">
              البريد الإلكتروني
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[13px]">
              كلمة السر
            </Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "جارٍ الدخول..." : "دخول"}
          </Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          ليس لديك حساب؟{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            سجل الآن
          </Link>
        </p>
      </div>
    </div>
  );
}
