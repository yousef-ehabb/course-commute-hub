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
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, Mail, RefreshCw } from "lucide-react";
import { RakebLogo } from "@/components/ui/RakebLogo";
import { motion, AnimatePresence } from "framer-motion";
import { StationPicker } from "@/components/student/StationPicker";

export const Route = createFileRoute("/register")({
  ssr: false,
  component: RegisterPage,
  head: () => ({
    meta: [
      { title: "تسجيل حساب — راكب" },
      { name: "description", content: "أنشئ حسابك الجديد على منصة راكب لمتابعة واختيار نقاط التجمع." },
      { property: "og:title", content: "تسجيل حساب — راكب" },
      { property: "og:description", content: "منصة ذكية لإدارة نقل المتدربين ومتابعة الرحلات لحظيًا." },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "/register" },
    ],
    links: [{ rel: "canonical", href: "/register" }],
  }),
});

function RegisterPage() {
  const { signUp, signInWithGoogle, sendVerificationEmail, configured } = useAuth();
  const { stations, loading: stationsLoading, error: stationsError } = useStations();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [station, setStation] = useState<string>("");
  const [customLocation, setCustomLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [googleUid, setGoogleUid] = useState("");

  async function handleGoogleSignUp() {
    if (!configured) return toast.error("Firebase غير مهيأ بعد. أضف مفاتيح الاتصال أولاً.");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      const { getFirebaseAuth } = await import("@/lib/firebase");
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        setIsGoogleUser(true);
        setGoogleUid(currentUser.uid);
        if (currentUser.displayName) setFullName(currentUser.displayName);
        if (currentUser.email) setEmail(currentUser.email);
        toast.success("تم الدخول بـ Google! يرجى إكمال بياناتك وموقع التجمع.");
        changeStep(2);
      } else {
        navigate({ to: "/student/home", replace: true });
      }
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleCompleteGoogleRegistration() {
    if (!validateStep2() || !validateStep3()) return;
    setLoading(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, set } = await import("firebase/database");
      const userProfile = {
        uid: googleUid,
        fullName: fullName.trim(),
        phone: phone.trim(),
        nationalId: nationalId.trim(),
        defaultStation: station,
        role: "student",
        createdAt: Date.now(),
      };
      await set(ref(getFirebaseDb(), `rakeb/users/${googleUid}`), userProfile);
      toast.success("تم إكمال حسابك بنجاح! أهلاً بك في راكب 🎉");
      navigate({ to: "/student/home", replace: true });
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Auto-detect Google authenticated user who needs to complete registration profile
  useEffect(() => {
    (async () => {
      try {
        const { getFirebaseAuth, getFirebaseDb } = await import("@/lib/firebase");
        const { ref, get } = await import("firebase/database");
        const currentUser = getFirebaseAuth().currentUser;
        if (currentUser && currentUser.providerData.some((p) => p.providerId === "google.com")) {
          const snap = await get(ref(getFirebaseDb(), `rakeb/users/${currentUser.uid}`));
          if (!snap.exists()) {
            setIsGoogleUser(true);
            setGoogleUid(currentUser.uid);
            if (currentUser.displayName) setFullName(currentUser.displayName);
            if (currentUser.email) setEmail(currentUser.email);
            setStep(2);
          }
        }
      } catch (e) {
        console.error("Google user check error:", e);
      }
    })();
  }, []);

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
        ...(station === "custom" && customLocation ? { customLocation } : {}),
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
              className="flex flex-col items-center text-center space-y-5"
            >
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-foreground">أهلاً بيك 👋</h1>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  هتحتاج دقيقة واحدة بس علشان تنشئ حسابك وتبدأ تستخدم التطبيق.
                </p>
              </div>

              <div className="w-full space-y-3">
                <Button onClick={nextStep} className="w-full" size="lg" disabled={googleLoading}>
                  يلا نبدأ بالبريد الإلكتروني
                </Button>

                <div className="relative my-2 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <span className="relative bg-card px-2 text-xs text-muted-foreground">أو</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-border"
                  size="lg"
                  disabled={googleLoading}
                  onClick={handleGoogleSignUp}
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
                  {googleLoading ? "جارٍ التسجيل..." : "التسجيل السريع بـ Google"}
                </Button>
              </div>

              <p className="mt-4 text-center text-[13px] text-muted-foreground">
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
                    {isGoogleUser ? "1 من 2" : "1 من 3"}
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
                    {isGoogleUser ? "2 من 2" : "2 من 3"}
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
                  <StationPicker
                    currentStationId={station}
                    customLocationName={customLocation?.name}
                    customLocationCoords={customLocation ? { lat: customLocation.lat, lng: customLocation.lng } : null}
                    stations={stations}
                    onChange={(newStation, customLoc) => {
                      setStation(newStation);
                      if (newStation === "custom" && customLoc) {
                        setCustomLocation(customLoc);
                      }
                    }}
                  />
                )}
                <p className="text-[13px] text-muted-foreground mt-1.5">
                  تقدر تغيرها بعدين لو احتجت من إعدادات حسابك.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={prevStep} className="w-12 p-0 shrink-0" disabled={loading}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button
                  onClick={isGoogleUser ? handleCompleteGoogleRegistration : nextStep}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : isGoogleUser ? (
                    "إتمام التسجيل"
                  ) : (
                    "التالي"
                  )}
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
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">تم إرسال رابط التأكيد! 📧</h2>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  أرسلنا رابط تأكيد إلى بريدك الإلكتروني <strong>{email}</strong>. يرجى فتح بريدك الإلكتروني والضغط على الرابط لتأكيد حسابك.
                </p>
                <p className="text-[13px] text-muted-foreground/80 pt-1">
                  (تأكد أيضاً من فحص مجلد الرسائل غير المرغوب فيها Spam)
                </p>
              </div>

              <div className="w-full space-y-3 pt-2">
                <Button onClick={() => navigate({ to: "/student/home" })} className="w-full" size="lg">
                  متابعة إلى الصفحة الرئيسية
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  disabled={resending}
                  onClick={async () => {
                    setResending(true);
                    try {
                      await sendVerificationEmail();
                      toast.success("تم إعادة إرسال رابط التأكيد بنجاح");
                    } catch (err) {
                      toast.error("حدث خطأ أثناء إرسال البريد الإلكتروني");
                    } finally {
                      setResending(false);
                    }
                  }}
                >
                  {resending ? (
                    <>
                      <RefreshCw className="ml-2 h-3.5 w-3.5 animate-spin" />
                      جارٍ الإرسال...
                    </>
                  ) : (
                    "لم تصلك الرسالة؟ إعادة الإرسال"
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
