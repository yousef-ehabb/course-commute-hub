import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { useStations } from "@/contexts/StationsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { RakebLogo } from "@/components/ui/RakebLogo";

export const Route = createFileRoute("/register")({
  ssr: false,
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "تسجيل حساب — راكب" },
      { name: "description", content: "أنشئ حساب طالب جديد على راكب في دقيقة." },
      { property: "og:title", content: "تسجيل حساب — راكب" },
      { property: "og:url", content: "/register" },
    ],
    links: [{ rel: "canonical", href: "/register" }],
  }),
});

function RegisterPage() {
  const { signUp, configured } = useAuth();
  const { stations, loading: stationsLoading, error: stationsError } = useStations();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [station, setStation] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stations.length > 0 && !station) {
      setStation(stations[0].id);
    }
  }, [stations, station]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return toast.error("Firebase غير مهيأ بعد. أضف مفاتيح الاتصال أولاً.");
    if (!/^\d{14}$/.test(nationalId)) return toast.error("الرقم القومي لازم يكون 14 رقم");
    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ""))) return toast.error("رقم موبايل غير صحيح");
    setLoading(true);
    try {
      await signUp(email.trim(), password, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalId: nationalId.trim(),
        defaultStation: station,
      });
      toast.success("تم إنشاء الحساب");
      navigate({ to: "/student/home" });
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-elevated">
        <div className="mb-6 flex justify-center">
          <Link to="/">
            <RakebLogo size="lg" />
          </Link>
        </div>
        <h1 className="text-center text-lg font-bold text-foreground">تسجيل حساب طالب</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-[13px]">
              الاسم بالكامل
            </Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-[13px]">
              رقم الموبايل
            </Label>
            <Input
              id="phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nationalId" className="text-[13px]">
              الرقم القومي
            </Label>
            <Input
              id="nationalId"
              required
              maxLength={14}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">نقطة التجمع الافتراضية</Label>
            {stationsLoading ? (
              <div className="flex h-11 items-center justify-center rounded-xl border border-input bg-muted/20 text-[13px] text-muted-foreground">
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" strokeWidth={2} />
                جاري تحميل نقاط التجمع...
              </div>
            ) : stationsError ? (
              <div className="flex h-11 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-[13px] text-destructive">
                {stationsError}
              </div>
            ) : stations.length === 0 ? (
              <div className="flex h-11 items-center justify-center rounded-xl border border-input bg-muted/20 text-[13px] text-muted-foreground">
                لا توجد نقاط تجمع متاحة حالياً
              </div>
            ) : (
              <Select value={station} onValueChange={setStation}>
                <SelectTrigger className="h-11 rounded-xl text-[15px]">
                  <SelectValue placeholder="اختر نقطة التجمع" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="rounded-lg text-[14px]">
                      {s.name} — {s.time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5 pt-2">
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </div>
          <Button type="submit" className="w-full mt-2" size="lg" disabled={loading}>
            {loading ? "جارٍ التسجيل..." : "سجل الآن"}
          </Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          عندك حساب؟{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            دخول
          </Link>
        </p>
      </div>
    </div>
  );
}
