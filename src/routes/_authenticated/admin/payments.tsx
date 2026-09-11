import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useCourse } from "@/contexts/CourseContext";
import { filterStudentsByCourse } from "@/utils/courseFilter";
import { Check, X, Search, CreditCard, Clock, AlertCircle, ShieldCheck, Banknote, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPaymentsPage,
});

type PaymentRecord = {
  amount?: number;
  status?: string;
  submittedAt?: number;
  rejectionReason?: string;
  verifiedAt?: number;
};

function AdminPaymentsPage() {
  const { user } = useAuth();
  const { courseId } = useCourse();
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "submitted" | "pending" | "rejected">("all");
  const [loading, setLoading] = useState(true);

  // Rejection Dialog State
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectUserId, setRejectUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, onValue } = await import("firebase/database");
        const db = getFirebaseDb();

        unsubUsers = onValue(ref(db, "rakeb/users"), (snap) => {
          if (!isMounted) return;
          const val = snap.val();
          if (val) {
            const allUsers = Object.entries(val).map(([uid, u]: [string, any]) => ({ uid, ...u }));
            setUsers(filterStudentsByCourse(allUsers, courseId));
          } else {
            setUsers([]);
          }
          setLoading(false);
        });

        unsubPayments = onValue(ref(db, `rakeb/payments/${courseId}`), (snap) => {
          if (!isMounted) return;
          const val = snap.val();
          if (val) {
            setPayments(val);
          } else {
            setPayments({});
          }
        });
      } catch (e) {
        console.error("Failed to load users or payments", e);
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      unsubUsers?.();
      unsubPayments?.();
    };
  }, [courseId]);

  const studentsWithPayments = useMemo(() => {
    return users
      .filter((u) => u.paymentStatus && u.paymentStatus !== "active")
      .map((u) => {
        const paymentRecord = payments[u.uid];
        return {
          ...u,
          paymentAmount: u.paymentAmount || paymentRecord?.amount || 0,
          paymentRecord,
        };
      })
      .sort((a, b) => {
        // Sort by submitted at first
        const aTime = a.paymentRecord?.submittedAt || 0;
        const bTime = b.paymentRecord?.submittedAt || 0;
        return bTime - aTime;
      });
  }, [users, payments]);

  const filteredStudents = useMemo(() => {
    return studentsWithPayments.filter((s) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (s.fullName || "").toLowerCase().includes(q) ||
        (s.phone || "").includes(q) ||
        (s.nationalId || "").includes(q);
      if (!matchesSearch) return false;

      if (filterType === "all") return true;
      if (filterType === "submitted") return s.paymentStatus === "payment_submitted";
      if (filterType === "pending") return s.paymentStatus === "pending_payment";
      if (filterType === "rejected") return s.paymentStatus === "payment_rejected";
      return true;
    });
  }, [studentsWithPayments, searchTerm, filterType]);

  const handleApprove = async (userId: string) => {
    setActionLoading(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      const db = getFirebaseDb();

      const updates: Record<string, any> = {};
      updates[`rakeb/users/${userId}/paymentStatus`] = "active";
      updates[`rakeb/payments/${courseId}/${userId}/status`] = "verified";
      updates[`rakeb/payments/${courseId}/${userId}/verifiedAt`] = Date.now();
      updates[`rakeb/payments/${courseId}/${userId}/verifiedBy`] = user?.uid || "unknown";

      await update(ref(db), updates);
      toast.success("تم قبول الدفع وتفعيل حساب الطالب بنجاح");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء قبول الدفع");
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualActivate = async (student: any) => {
    setActionLoading(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      const db = getFirebaseDb();

      const now = Date.now();
      const updates: Record<string, any> = {};
      updates[`rakeb/users/${student.uid}/paymentStatus`] = "active";
      updates[`rakeb/payments/${courseId}/${student.uid}`] = {
        userId: student.uid,
        courseId,
        amount: student.paymentAmount || 0,
        status: "verified",
        paymentMethod: "cash",
        verifiedAt: now,
        verifiedBy: user?.uid || "unknown",
        createdAt: student.paymentRecord?.createdAt || now,
      };

      await update(ref(db), updates);
      toast.success("تم تفعيل حساب الطالب بنجاح (دفع نقدي/يدوي)");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تفعيل الحساب");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectUserId || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      const db = getFirebaseDb();

      const updates: Record<string, any> = {};
      updates[`rakeb/users/${rejectUserId}/paymentStatus`] = "payment_rejected";
      updates[`rakeb/payments/${courseId}/${rejectUserId}/status`] = "rejected";
      updates[`rakeb/payments/${courseId}/${rejectUserId}/rejectionReason`] = rejectionReason;
      updates[`rakeb/payments/${courseId}/${rejectUserId}/rejectedAt`] = Date.now();
      updates[`rakeb/payments/${courseId}/${rejectUserId}/rejectedBy`] = user?.uid || "unknown";

      await update(ref(db), updates);
      toast.success("تم رفض الدفع وتسجيل السبب");
      setRejectDialogOpen(false);
      setRejectionReason("");
      setRejectUserId(null);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء رفض الدفع");
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectDialog = (userId: string) => {
    setRejectUserId(userId);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "---";
    return new Date(timestamp).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-4 pb-24">
      {/* Header */}
      <header className="w-full sticky top-0 z-10 bg-background/80 backdrop-blur-md shadow-xs flex items-center justify-between py-4 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            مراجعة المدفوعات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            مراجعة وتفعيل الحسابات للطلاب المتقدمين في كورس ({courseId})
          </p>
        </div>
      </header>

      {/* Search Bar Section */}
      <div className="relative w-full mb-4">
        <input
          className="w-full h-12 pr-11 pl-4 rounded-xl border border-border bg-card focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-foreground shadow-xs placeholder:text-muted-foreground"
          placeholder="ابحث بالاسم، الموبايل، أو الرقم القومي..."
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-muted-foreground">
          <Search className="w-4 h-4" />
        </div>
      </div>

      {/* Filter Chips Section */}
      <div className="flex overflow-x-auto gap-2 mb-4 pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        <FilterChip
          label="الكل"
          active={filterType === "all"}
          onClick={() => setFilterType("all")}
          count={studentsWithPayments.length}
        />
        <FilterChip
          label="بانتظار المراجعة"
          active={filterType === "submitted"}
          onClick={() => setFilterType("submitted")}
          count={studentsWithPayments.filter((s) => s.paymentStatus === "payment_submitted").length}
        />
        <FilterChip
          label="لم يتم الدفع"
          active={filterType === "pending"}
          onClick={() => setFilterType("pending")}
          count={studentsWithPayments.filter((s) => s.paymentStatus === "pending_payment").length}
        />
        <FilterChip
          label="مرفوض"
          active={filterType === "rejected"}
          onClick={() => setFilterType("rejected")}
          count={studentsWithPayments.filter((s) => s.paymentStatus === "payment_rejected").length}
        />
      </div>

      {/* Students List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 flex flex-col items-center justify-center gap-2 bg-card rounded-2xl border border-dashed border-border">
          <Check className="w-10 h-10 text-emerald-500/50" />
          <p className="text-sm font-medium">لا يوجد طلاب بانتظار تفعيل الدفع</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredStudents.map((student) => {
            const isSubmitted = student.paymentStatus === "payment_submitted";
            const isPending = student.paymentStatus === "pending_payment";
            const isRejected = student.paymentStatus === "payment_rejected";

            return (
              <motion.div
                key={student.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-4 sm:p-5 rounded-2xl shadow-xs border border-border/50 transition-all flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">{student.fullName}</h2>
                    {isSubmitted && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        قيد المراجعة
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border/40">
                        لم يتم الدفع
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                        مرفوض
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <span>{student.phone}</span>
                    </div>
                    {student.nationalId && (
                      <div className="flex items-center gap-1.5" dir="ltr">
                        <span className="font-mono">{student.nationalId}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-primary font-bold">
                      <Banknote className="w-4 h-4" />
                      <span>المبلغ: {student.paymentAmount} ج.م</span>
                    </div>
                  </div>
                  {(isSubmitted || isRejected) && student.paymentRecord?.submittedAt && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      وقت التقديم: {formatDate(student.paymentRecord?.submittedAt)}
                    </div>
                  )}
                  {isRejected && student.paymentRecord?.rejectionReason && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-1 bg-red-50 dark:bg-red-950/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                      <strong>سبب الرفض:</strong> {student.paymentRecord.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 justify-end mt-2 lg:mt-0">
                  {isSubmitted && (
                    <>
                      <Button
                        onClick={() => openRejectDialog(student.uid)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gap-1"
                        disabled={actionLoading}
                      >
                        <X className="w-4 h-4" />
                        رفض
                      </Button>
                      <Button
                        onClick={() => handleApprove(student.uid)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        disabled={actionLoading}
                      >
                        <Check className="w-4 h-4" />
                        قبول الدفع وتفعيل
                      </Button>
                    </>
                  )}

                  {(isPending || isRejected) && (
                    <Button
                      onClick={() => handleManualActivate(student)}
                      variant="outline"
                      size="sm"
                      className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      disabled={actionLoading}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      تفعيل يدوي (دفع نقدي)
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>رفض الدفع</AlertDialogTitle>
            <AlertDialogDescription>
              يرجى توضيح سبب رفض الدفع. سيظهر هذا السبب للطالب ليتمكن من معالجته.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: صورة الإيصال غير واضحة..."
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectSubmit}
              disabled={actionLoading || !rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {actionLoading ? "جاري الحفظ..." : "تأكيد الرفض"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 border flex items-center gap-2 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-xs"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}
