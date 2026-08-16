import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RakebLogo } from "@/components/ui/RakebLogo";
import { AlertTriangle, Archive } from "lucide-react";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — راكب" },
      { name: "description", content: "سجل الدخول إلى حساب راكب لمتابعة وإدارة رحلات النقل." },
      { property: "og:title", content: "تسجيل الدخول — راكب" },
      { property: "og:description", content: "منصة ذكية لإدارة نقل المتدربين ومتابعة الرحلات لحظيًا." },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/login" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
});

function LoginPage() {
  const { signIn, signInWithGoogle, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
        // 1. Check active user profile first (always permitted for own uid)
        const snap = await get(ref(getFirebaseDb(), `rakeb/users/${currentUser.uid}`));
        const profile = snap.val();

        if (profile?.role === "admin") {
          navigate({ to: "/admin/dashboard", replace: true });
          toast.success("تم الدخول");
          return;
        } else if (profile) {
          navigate({ to: "/student/home", replace: true });
          toast.success("تم الدخول");
          return;
        }

        // 2. If no active profile, safely check if deleted or archived
        try {
          const deletedSnap = await get(ref(getFirebaseDb(), `rakeb/deletedUsers/${currentUser.uid}`));
          if (deletedSnap?.exists()) {
            const { signOut } = await import("firebase/auth");
            await signOut(getFirebaseAuth());
            toast.error("تم حذف حسابك بواسطة المسؤول. تواصل مع الإدارة للمزيد.");
            return;
          }
        } catch {
          // Ignore if permission denied on deletedUsers
        }

        try {
          const indexSnap = await get(ref(getFirebaseDb(), `rakeb/archivedUsersIndex/${currentUser.uid}`));
          if (indexSnap?.exists()) {
            toast.info("انتهى الكورس السابق. يرجى التسجيل في كورس جديد.");
            return;
          }
        } catch {
          // Ignore if permission denied on archivedUsersIndex
        }

        // Incomplete profile — redirect to register
        navigate({ to: "/register", replace: true });
      } else {
        navigate({ to: "/student/home", replace: true });
      }

      toast.success("تم الدخول");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!configured) return toast.error("Firebase غير مهيأ بعد. أضف مفاتيح الاتصال أولاً.");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      const { getFirebaseAuth, getFirebaseDb } = await import("@/lib/firebase");
      const { ref, get } = await import("firebase/database");
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        // 1. Check active user profile first
        const snap = await get(ref(getFirebaseDb(), `rakeb/users/${currentUser.uid}`));
        const profile = snap.val();
        if (profile) {
          if (profile.role === "admin") {
            navigate({ to: "/admin/dashboard", replace: true });
          } else {
            navigate({ to: "/student/home", replace: true });
          }
          toast.success("تم تسجيل الدخول بنجاح مع Google");
          return;
        }

        // 2. Safely check deleted / archived
        try {
          const deletedSnap = await get(ref(getFirebaseDb(), `rakeb/deletedUsers/${currentUser.uid}`));
          if (deletedSnap?.exists()) {
            const { signOut } = await import("firebase/auth");
            await signOut(getFirebaseAuth());
            toast.error("تم حذف حسابك بواسطة المسؤول. تواصل مع الإدارة للمزيد.");
            return;
          }
        } catch {
          // Ignore permission error
        }

        try {
          const indexSnap = await get(ref(getFirebaseDb(), `rakeb/archivedUsersIndex/${currentUser.uid}`));
          if (indexSnap?.exists()) {
            toast.info("انتهى الكورس السابق. يرجى التسجيل في كورس جديد.");
            return;
          }
        } catch {
          // Ignore permission error
        }

        toast.info("لم يتم العثور على حساب لبريدك الإلكتروني، يرجى إكمال بيانات التسجيل أولاً.");
        navigate({ to: "/register", replace: true });
      }
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  // Get archived profile from AuthContext for the archived user banner
  const { accountStatus, archivedProfile, signOutUser } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm space-y-4">
        {/* Archived account banner */}
        {accountStatus === "archived" && archivedProfile && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">انتهى الكورس السابق</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  أهلاً <strong>{archivedProfile.profile.fullName}</strong>، كورسك السابق انتهى. للاستمرار، سجّل في كورس جديد وبياناتك محفوظة.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deleted account banner */}
        {accountStatus === "deleted" && (
          <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">تم حذف حسابك</h3>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  تم حذف حسابك بواسطة المسؤول. تواصل مع الإدارة للمزيد من المعلومات.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-card p-8 shadow-elevated">
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
          <Button type="submit" className="w-full" size="lg" disabled={loading || googleLoading}>
            {loading ? "جارٍ الدخول..." : "دخول"}
          </Button>
        </form>

        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-card px-3 text-xs text-muted-foreground">أو</span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 border-border"
          size="lg"
          disabled={loading || googleLoading}
          onClick={handleGoogleSignIn}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {googleLoading ? "جارٍ الاتصال..." : "الدخول بواسطة Google"}
        </Button>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          ليس لديك حساب؟{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            سجل الآن
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
