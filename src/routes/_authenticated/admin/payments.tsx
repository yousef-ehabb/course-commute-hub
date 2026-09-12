import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourse } from "@/contexts/CourseContext";
import { filterStudentsByCourse } from "@/utils/courseFilter";
import type { UserProfile } from "@/types";
import { Check, X, Search, CreditCard, Clock, ShieldCheck, Banknote, Phone } from "lucide-react";
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
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPaymentsPage,
});

type PaymentRecord = {
  amount?: number;
  status?: string;
  submittedAt?: number;
  rejectionReason?: string;
  verifiedAt?: number;
  paymentMethod?: string;
  createdAt?: number;
};

function AdminPaymentsPage() {
  const { user } = useAuth();
  const { courseId, courses } = useCourse();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRecord>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "submitted" | "pending" | "rejected">("all");
  const [loading, setLoading] = useState(true);

  // Active courses set to avoid matching ended/archived courses
  const activeCourseIds = useMemo(() => {
    const ids = new Set<string>(["default"]);
    courses.forEach((c) => {
      if (c.status === "active") {
        ids.add(c.id);
      }
    });
    return ids;
  }, [courses]);

  const coursesMap = useMemo(() => {
    const map: Record<string, string> = { default: "الكورس الأساسي" };
    courses.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [courses]);

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
            const allUsers = Object.entries(val).map(([uid, u]) => ({
              ...(u as Record<string, unknown>),
              uid,
            })) as UserProfile[];
            setUsers(filterStudentsByCourse(allUsers, courseId, activeCourseIds));
          } else {
            setUsers([]);
          }
          setLoading(false);
        });

        if (courseId === "all") {
          // Listen to all payments and aggregate across active courses
          unsubPayments = onValue(ref(db, "rakeb/payments"), (snap) => {
            if (!isMounted) return;
            const val = snap.val();
            if (val) {
              const aggregated: Record<string, PaymentRecord> = {};
              for (const [cId, coursePayments] of Object.entries(val)) {
                if (
                  activeCourseIds.has(cId) &&
                  coursePayments &&
                  typeof coursePayments === "object"
                ) {
                  for (const [uid, pRec] of Object.entries(
                    coursePayments as Record<string, unknown>,
                  )) {
                    aggregated[uid] = pRec as PaymentRecord;
                  }
                }
              }
              setPayments(aggregated);
            } else {
              setPayments({});
            }
          });
        } else {
          unsubPayments = onValue(ref(db, `rakeb/payments/${courseId}`), (snap) => {
            if (!isMounted) return;
            const val = snap.val();
            if (val) {
              setPayments(val);
            } else {
              setPayments({});
            }
          });
        }
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
  }, [courseId, activeCourseIds]);

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

      // Find student to get their actual courseId
      const student = studentsWithPayments.find((s) => s.uid === userId);
      const studentCourseId = student?.courseId || (courseId !== "all" ? courseId : "default");

      const updates: Record<string, unknown> = {};
      updates[`rakeb/users/${userId}/paymentStatus`] = "active";
      updates[`rakeb/payments/${studentCourseId}/${userId}/status`] = "verified";
      updates[`rakeb/payments/${studentCourseId}/${userId}/verifiedAt`] = Date.now();
      updates[`rakeb/payments/${studentCourseId}/${userId}/verifiedBy`] = user?.uid || "unknown";

      await update(ref(db), updates);
      toast.success("تم قبول الدفع وتفعيل حساب الطالب بنجاح");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء قبول الدفع");
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualActivate = async (student: UserProfile & { paymentRecord?: PaymentRecord }) => {
    setActionLoading(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      const db = getFirebaseDb();

      const studentCourseId = student.courseId || (courseId !== "all" ? courseId : "default");
      const now = Date.now();
      const updates: Record<string, unknown> = {};
      updates[`rakeb/users/${student.uid}/paymentStatus`] = "active";
      updates[`rakeb/payments/${studentCourseId}/${student.uid}`] = {
        userId: student.uid,
        courseId: studentCourseId,
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

      const student = studentsWithPayments.find((s) => s.uid === rejectUserId);
      const studentCourseId = student?.courseId || (courseId !== "all" ? courseId : "default");

      const updates: Record<string, unknown> = {};
      updates[`rakeb/users/${rejectUserId}/paymentStatus`] = "payment_rejected";
      updates[`rakeb/payments/${studentCourseId}/${rejectUserId}/status`] = "rejected";
      updates[`rakeb/payments/${studentCourseId}/${rejectUserId}/rejectionReason`] =
        rejectionReason;
      updates[`rakeb/payments/${studentCourseId}/${rejectUserId}/rejectedAt`] = Date.now();
      updates[`rakeb/payments/${studentCourseId}/${rejectUserId}/rejectedBy`] =
        user?.uid || "unknown";

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
    <div className="space-y-5 pt-2 pb-12 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
          <span>مراجعة المدفوعات</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          مراجعة وتفعيل الحسابات للطلاب المتقدمين في كورس ({courseId})
        </p>
      </div>

      {/* Search Bar Section */}
      <div className="relative w-full">
        <input
          className="w-full h-11 sm:h-12 rtl:pr-10 rtl:pl-4 ltr:pl-10 ltr:pr-4 rounded-xl border border-border bg-card focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-xs sm:text-sm text-foreground shadow-xs placeholder:text-muted-foreground"
          placeholder="ابحث بالاسم، الموبايل، أو الرقم القومي..."
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="absolute inset-y-0 rtl:right-3.5 ltr:left-3.5 flex items-center pointer-events-none text-muted-foreground">
          <Search className="w-4 h-4" />
        </div>
      </div>

      {/* Filter Chips Section */}
      <div className="w-full min-w-0 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex gap-2 pb-1 pt-0.5 min-w-full sm:flex sm:flex-wrap">
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
            count={
              studentsWithPayments.filter((s) => s.paymentStatus === "payment_submitted").length
            }
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
            count={
              studentsWithPayments.filter((s) => s.paymentStatus === "payment_rejected").length
            }
          />
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 px-4 flex flex-col items-center justify-center gap-2 bg-card rounded-2xl border border-dashed border-border">
          <Check className="w-9 h-9 text-emerald-500/60" />
          <p className="text-sm font-medium">لا يوجد طلاب بانتظار تفعيل الدفع</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full min-w-0">
          {filteredStudents.map((student) => {
            const isSubmitted = student.paymentStatus === "payment_submitted";
            const isPending = student.paymentStatus === "pending_payment";
            const isRejected = student.paymentStatus === "payment_rejected";

            return (
              <motion.div
                key={student.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-4 sm:p-5 rounded-2xl shadow-card border border-border/60 transition-all flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center w-full min-w-0"
              >
                <div className="flex flex-col gap-2 w-full min-w-0">
                  {/* Name and Status Badge */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-foreground truncate max-w-full">
                      {student.fullName}
                    </h2>
                    {isSubmitted && (
                      <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                        قيد المراجعة
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-muted text-muted-foreground border border-border/40 shrink-0">
                        لم يتم الدفع
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                        مرفوض
                      </span>
                    )}
                    {courseId === "all" && (
                      <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {coursesMap[student.courseId || "default"] ||
                          student.courseId ||
                          "الكورس الأساسي"}
                      </span>
                    )}
                  </div>

                  {/* Student Metadata Row */}
                  <div className="flex items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground flex-wrap min-w-0">
                    <div className="flex items-center gap-1 shrink-0" dir="ltr">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span>{student.phone}</span>
                    </div>
                    {student.nationalId && (
                      <div className="flex items-center gap-1 shrink-0" dir="ltr">
                        <span className="font-mono">{student.nationalId}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-primary font-bold shrink-0">
                      <Banknote className="w-3.5 h-3.5" />
                      <span>المبلغ: {student.paymentAmount} ج.م</span>
                    </div>
                  </div>

                  {/* Submission Timestamp */}
                  {(isSubmitted || isRejected) && student.paymentRecord?.submittedAt && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>وقت التقديم: {formatDate(student.paymentRecord?.submittedAt)}</span>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {isRejected && student.paymentRecord?.rejectionReason && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-xl border border-destructive/20 break-words w-full mt-1">
                      <strong>سبب الرفض:</strong> {student.paymentRecord.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t border-border/40 lg:border-t-0">
                  {isSubmitted && (
                    <>
                      <Button
                        onClick={() => openRejectDialog(student.uid)}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 h-9 font-medium"
                        disabled={actionLoading}
                      >
                        <X className="w-4 h-4" />
                        <span>رفض</span>
                      </Button>
                      <Button
                        onClick={() => handleApprove(student.uid)}
                        size="sm"
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 font-medium"
                        disabled={actionLoading}
                      >
                        <Check className="w-4 h-4" />
                        <span>قبول الدفع وتفعيل</span>
                      </Button>
                    </>
                  )}

                  {(isPending || isRejected) && (
                    <Button
                      onClick={() => handleManualActivate(student)}
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto gap-1.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30 h-9 font-medium"
                      disabled={actionLoading}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>تفعيل يدوي (دفع نقدي)</span>
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
        <AlertDialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-lg p-5 sm:p-6">
          <AlertDialogHeader className="text-start">
            <AlertDialogTitle className="text-base sm:text-lg">رفض الدفع</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              يرجى توضيح سبب رفض الدفع. سيظهر هذا السبب للطالب ليتمكن من معالجته.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: صورة الإيصال غير واضحة..."
              className="text-xs sm:text-sm h-10 rounded-xl"
              autoFocus
            />
          </div>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel disabled={actionLoading} className="w-full sm:w-auto rounded-xl">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectSubmit}
              disabled={actionLoading || !rejectionReason.trim()}
              className="w-full sm:w-auto bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
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
      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 border flex items-center gap-1.5 sm:gap-2 shrink-0 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-xs"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] ${
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
