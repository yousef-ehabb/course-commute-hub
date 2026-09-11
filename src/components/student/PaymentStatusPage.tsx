import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourse } from "@/contexts/CourseContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCard, Clock, AlertCircle, Copy, MessageCircle } from "lucide-react";
import { RakebLogo } from "@/components/ui/RakebLogo";

interface PaymentMethods {
  instaPay?: string;
  vodafoneCash?: string;
  instructions?: string;
  whatsappNumber?: string;
}

export function PaymentStatusPage() {
  const { user, profile, paymentStatus, signOutUser } = useAuth();
  const { courseId, course } = useCourse();
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"instaPay" | "vodafoneCash" | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, get } = await import("firebase/database");
        const db = getFirebaseDb();

        const snap = await get(ref(db, `rakeb/settings/${courseId}/paymentMethods`));
        if (isMounted && snap.exists()) {
          setMethods(snap.val());
        }

        if (paymentStatus === "payment_rejected" && user) {
          const paymentSnap = await get(ref(db, `rakeb/payments/${courseId}/${user.uid}`));
          if (isMounted && paymentSnap.exists()) {
            setRejectionReason(paymentSnap.val().rejectionReason || "تم رفض عملية الدفع من قبل الإدارة.");
          }
        }
      } catch (err) {
        console.error("Failed to load payment methods", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [courseId, paymentStatus, user]);

  const handleSubmitPayment = async () => {
    if (!user || !profile || !courseId) return;
    setSubmitting(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      const db = getFirebaseDb();

      const now = Date.now();
      const amount = profile.paymentAmount || (course?.transportation?.payment?.days || 0) * (course?.transportation?.payment?.dailyFee || 0);

      const updates: Record<string, any> = {};
      updates[`rakeb/payments/${courseId}/${user.uid}`] = {
        userId: user.uid,
        courseId,
        amount,
        status: "submitted",
        paymentMethod: selectedMethod || "unknown",
        submittedAt: now,
        createdAt: now, // For initial creation, will be preserved by rules if already exists
      };
      updates[`rakeb/users/${user.uid}/paymentStatus`] = "payment_submitted";

      await update(ref(db), updates);
      
      // WhatsApp Template Logic
      if (methods?.whatsappNumber) {
        let phoneNum = methods.whatsappNumber.replace(/[^0-9]/g, "");
        if (phoneNum.startsWith("01")) {
          phoneNum = "2" + phoneNum;
        } else if (!phoneNum.startsWith("20")) {
          phoneNum = "20" + phoneNum;
        }

        const methodAr = selectedMethod === "instaPay" ? "إنستاباي (InstaPay)" : selectedMethod === "vodafoneCash" ? "فودافون كاش" : "غير محدد";
        const message = `السلام عليكم،
تم تحويل مبلغ الاشتراك.
الاسم: ${profile.fullName}
الرقم القومي: ${profile.nationalId}
الكورس: ${course?.name || courseId}
المبلغ: ${amount} ج.م
طريقة الدفع: ${methodAr}
مرفق صورة إيصال التحويل.`;

        const url = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
      } else {
        toast.success("تم إرسال تأكيد الدفع بنجاح");
      }
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء إرسال التأكيد");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground text-sm">جاري تحميل البيانات...</p>
      </div>
    );
  }

  const days = course?.transportation?.payment?.days || 0;
  const dailyFee = course?.transportation?.payment?.dailyFee || 0;
  const calculatedFee = days * dailyFee;
  const totalAmount = profile?.paymentAmount || calculatedFee;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center mb-8">
          <RakebLogo size="lg" />
        </div>

        {paymentStatus === "payment_submitted" && (
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-2">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">جاري مراجعة الدفع</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              لقد قمت بتأكيد الدفع. الإدارة تقوم الآن بمراجعة طلبك وتفعيله قريباً. يرجى الانتظار.
            </p>
            <div className="pt-4 flex flex-col gap-2">
              <Button variant="outline" onClick={signOutUser} className="w-full">
                تسجيل الخروج
              </Button>
            </div>
          </div>
        )}

        {paymentStatus === "payment_rejected" && (
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-red-200 dark:border-red-900/50 space-y-4">
            <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold">تم رفض عملية الدفع</h2>
                <p className="text-sm mt-1 leading-relaxed opacity-90">{rejectionReason}</p>
              </div>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <Button onClick={handleSubmitPayment} disabled={submitting} className="w-full bg-red-600 hover:bg-red-700 text-white">
                {submitting ? "جاري التأكيد..." : "لقد قمت بالدفع (إعادة المحاولة)"}
              </Button>
              <Button variant="outline" onClick={signOutUser} className="w-full">
                تسجيل الخروج
              </Button>
            </div>
          </div>
        )}

        {paymentStatus === "pending_payment" && (
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">اشتراك الباص</h2>
              <p className="text-sm text-muted-foreground">
                يرجى دفع رسوم الاشتراك لتفعيل حسابك واستخدام الباص.
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 flex flex-col gap-2">
              {!profile?.paymentAmount && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">التفاصيل</span>
                  <span className="font-semibold text-foreground">{days} أيام × {dailyFee} ج.م</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">المبلغ المطلوب</span>
                <span className="text-xl font-bold text-primary">{totalAmount} ج.م</span>
              </div>
            </div>

            {methods && (
              <div className="space-y-4">
                {methods.instructions && (
                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {methods.instructions}
                  </div>
                )}

                {methods.instaPay && (
                  <div className="flex items-center justify-between bg-background border border-border p-3 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1">حساب إنستاباي (InstaPay)</span>
                      <span className="font-semibold text-sm font-mono" dir="ltr">{methods.instaPay}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(methods.instaPay!, "حساب إنستاباي")}>
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}

                {methods.vodafoneCash && (
                  <div className="flex items-center justify-between bg-background border border-border p-3 rounded-lg">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1">فودافون كاش</span>
                      <span className="font-semibold text-sm font-mono" dir="ltr">{methods.vodafoneCash}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(methods.vodafoneCash!, "رقم فودافون كاش")}>
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-2">كيف قمت بالدفع؟</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedMethod("instaPay")}
                      className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                        selectedMethod === "instaPay" 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border bg-card hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="font-semibold text-sm">إنستاباي</span>
                    </button>
                    <button
                      onClick={() => setSelectedMethod("vodafoneCash")}
                      className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                        selectedMethod === "vodafoneCash" 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border bg-card hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="font-semibold text-sm">فودافون كاش</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border space-y-3">
              <Button 
                onClick={handleSubmitPayment} 
                disabled={submitting || !selectedMethod} 
                className="w-full text-base py-6 bg-[#25D366] hover:bg-[#25D366]/90 text-white shadow-lg shadow-[#25D366]/20"
              >
                <MessageCircle className="w-5 h-5 ml-2" />
                {submitting ? "جاري الإرسال..." : "تم الدفع – إرسال عبر WhatsApp"}
              </Button>
              <Button variant="ghost" onClick={signOutUser} className="w-full text-muted-foreground">
                تسجيل الخروج
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
