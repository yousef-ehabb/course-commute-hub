import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ActiveDateProvider } from "@/contexts/ActiveDateContext";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedGuard,
});

function AuthedGuard() {
  const { user, isEmailVerified, sendVerificationEmail, loading } = useAuth();
  const [resending, setResending] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleResend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      toast.success("تم إعادة إرسال رابط تأكيد البريد الإلكتروني بنجاح");
    } catch (err) {
      toast.error("حدث خطأ أثناء الإرسال. يرجى المحاولة لاحقاً.");
    } finally {
      setResending(false);
    }
  };

  return (
    <ActiveDateProvider>
      {!isEmailVerified && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 px-4 py-2 text-xs md:text-sm flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>بريدك الإلكتروني غير مأكد بعد. يرجى مراجعة صندوق الوارد لتأكيد الحساب.</span>
          </div>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80 disabled:opacity-50 text-xs"
          >
            {resending && <RefreshCw className="w-3 h-3 animate-spin" />}
            إعادة إرسال الرابط
          </button>
        </div>
      )}
      <Outlet />
    </ActiveDateProvider>
  );
}
