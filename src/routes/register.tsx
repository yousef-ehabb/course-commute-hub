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
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";
import { RakebLogo } from "@/components/ui/RakebLogo";
import { motion, AnimatePresence } from "framer-motion";

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

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [station, setStation] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Set default station if available
  useEffect(() => {
    if (stations.length > 0 && !station) {
      setStation(stations[0].id);
    }
  }, [stations, station]);

  const validateStep2 = () => {
    if (!fullName.trim()) {
      toast.error("يرجى إدخال الاسم بالكامل");
      return false;
    }
    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ""))) {
      toast.error("رقم موبايل غير صحيح");
      return false;
    }
    if (!/^\d{14}$/.test(nationalId)) {
      toast.error("الرقم القومي لازم يكون 14 رقم");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!station) {
      toast.error("يرجى اختيار نقطة التجمع");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return toast.error("Firebase غير مهيأ بعد. أضف مفاتيح الاتصال أولاً.");

    // Final validations just in case
    if (!validateStep2() || !validateStep3()) return;
    if (!email.trim() || password.length < 6) {
      toast.error("يرجى إدخال البريد الإلكتروني وكلمة مرور لا تقل عن 6 أحرف");
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalId: nationalId.trim(),
        defaultStation: station,
      });
      // Registration successful! Move to success step
      setStep(5);
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Animation variants
  const variants = {
    initial: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" as const }
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -50 : 50,
      opacity: 0,
      transition: { duration: 0.2, ease: "easeIn" as const }
    }),
  };

  // We need to track direction to slide correctly
  const [direction, setDirection] = useState(1);
  const changeStep = (newStep: number) => {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  };

  const nextStep = () => {
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    changeStep(step + 1);
  };

  const prevStep = () => {
    changeStep(step - 1);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-8">
      {/* Header outside the animated box to stay static */}
      {step < 5 && (
        <div className="mb-6 w-full max-w-sm flex justify-center">
          <Link to="/">
            <RakebLogo size="lg" />
          </Link>
        </div>
      )}

      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-elevated overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col items-center text-center space-y-6"
            >
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-foreground">أهلاً بيك 👋</h1>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  هتحتاج دقيقة واحدة بس علشان تنشئ حسابك وتبدأ تستخدم التطبيق.
                </p>
              </div>
              <Button onClick={nextStep} className="w-full" size="lg">
                يلا نبدأ
              </Button>
              <p className="mt-6 text-center text-[13px] text-muted-foreground">
                عندك حساب؟{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  دخول
                </Link>
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">المعلومات الشخصية</h2>
                  <span className="text-[13px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    1 من 3
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-[13px]">الاسم بالكامل (بالعربي)</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-[13px]">رقم الموبايل</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    placeholder="01xxxxxxxxx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nationalId" className="text-[13px]">الرقم القومي</Label>
                  <Input
                    id="nationalId"
                    maxLength={14}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={prevStep} className="w-12 p-0 shrink-0">
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button onClick={nextStep} className="w-full">
                  التالي
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">نقطة التجمع</h2>
                  <span className="text-[13px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    2 من 3
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[14px]">اختر نقطة التجمع الافتراضية</Label>
                {stationsLoading ? (
                  <div className="flex h-11 items-center justify-center rounded-xl border border-input bg-muted/20 text-[13px] text-muted-foreground">
                    <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" strokeWidth={2} />
                    جاري التحميل...
                  </div>
                ) : stationsError ? (
                  <div className="flex h-11 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-[13px] text-destructive">
                    {stationsError}
                  </div>
                ) : stations.length === 0 ? (
                  <div className="flex h-11 items-center justify-center rounded-xl border border-input bg-muted/20 text-[13px] text-muted-foreground">
                    لا توجد نقاط متاحة حالياً
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
                <p className="text-[13px] text-muted-foreground mt-1.5">
                  تقدر تغيرها بعدين لو احتجت من إعدادات حسابك.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={prevStep} className="w-12 p-0 shrink-0">
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button onClick={nextStep} className="w-full">
                  التالي
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.form
              key="step4"
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-6"
              onSubmit={onSubmit}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">إعداد الحساب</h2>
                  <span className="text-[13px] font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    3 من 3
                  </span>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px]">
                    البريد الإلكتروني <span className="font-normal text-muted-foreground">(هيكون ده اسم الدخول للحساب)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    autoFocus
                  />
                  <p className="text-[12.5px] text-muted-foreground">
                    استخدم بريد إلكتروني هتسجل بيه دخولك بعد كده.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[13px]">
                    كلمة مرور الحساب
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
                  <p className="text-[12.5px] text-muted-foreground leading-snug">
                    دي كلمة المرور الخاصة بحسابك في التطبيق، وليست كلمة مرور البريد الإلكتروني.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={prevStep} className="w-12 p-0 shrink-0" disabled={loading}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جارٍ التسجيل...
                    </>
                  ) : (
                    "سجل الآن"
                  )}
                </Button>
              </div>
            </motion.form>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              custom={direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col items-center text-center space-y-5 py-4"
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">حسابك جاهز! ✅</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  تقدر دلوقتي تبدأ تستخدم الويبسايت وتتابع باص التدريب.
                </p>
              </div>
              <Button onClick={() => navigate({ to: "/student/home" })} className="w-full mt-4" size="lg">
                ابدأ
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
