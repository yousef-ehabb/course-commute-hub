import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
import { STATIONS } from "@/lib/constants";
import { Bus } from "lucide-react";

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
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [station, setStation] = useState<string>(STATIONS[0].id);
  const [loading, setLoading] = useState(false);

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
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-center gap-2 text-primary">
          <Bus className="h-8 w-8" />
          <span className="text-2xl font-extrabold">راكب</span>
        </div>
        <h1 className="text-center text-xl font-bold">تسجيل حساب طالب</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="fullName">الاسم بالكامل</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">رقم الموبايل</Label>
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label htmlFor="nationalId">الرقم القومي</Label>
            <Input
              id="nationalId"
              required
              maxLength={14}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <Label>نقطة الركوب</Label>
            <Select value={station} onValueChange={setStation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border-t pt-4">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label htmlFor="password">كلمة السر</Label>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "جارٍ التسجيل..." : "سجل"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          عندك حساب؟{" "}
          <Link to="/login" className="font-semibold text-primary">
            دخول
          </Link>
        </p>
      </div>
    </div>
  );
}