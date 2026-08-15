import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Save,
  Clock,
  Users,
  Archive,
  PlusCircle,
  AlertTriangle,
  Copy,
  Layers,
  Check,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { DEFAULT_CUTOFF_TIME } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCourse } from "@/contexts/CourseContext";
import type { CourseInfo } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const {
    courseId,
    setCourseId,
    courses: coursesList,
    createCourse,
    archiveCourse,
    deleteCourse,
  } = useCourse();

  const [cutoffTime, setCutoffTime] = useState(DEFAULT_CUTOFF_TIME);
  const [cutoffEnabled, setCutoffEnabled] = useState(true);
  const [forceLock, setForceLock] = useState(false);
  const [vehicleLimits, setVehicleLimits] = useState({ micro: 14, bus: 50 });
  const [activeDateKey, setActiveDateKey] = useState<string>("");

  const [dbRef, setDbRef] = useState<any>(null);

  // Course Modal States
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseId, setNewCourseId] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Course Action Dialogs State
  const [actionTargetCourse, setActionTargetCourse] = useState<CourseInfo | null>(null);
  const [actionType, setActionType] = useState<"archive" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const copyRegisterLink = (cId: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://rakeb.vercel.app";
    const link = `${origin}/register?course=${encodeURIComponent(cId)}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(
        () => toast.success(`تم نسخ رابط التسجيل بنجاح!`, { description: link }),
        () => toast.error("فشل في نسخ الرابط")
      );
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success(`تم نسخ رابط التسجيل بنجاح!`, { description: link });
      } catch (err) {
        toast.error("فشل في نسخ الرابط");
      }
      document.body.removeChild(textArea);
    }
  };

  useEffect(() => {
    let unsubSettings: (() => void) | undefined;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");

      const db = getFirebaseDb();
      setDbRef(db);

      // Listen to settings for active courseId
      const path = `rakeb/settings/${courseId}`;
      unsubSettings = onValue(
        ref(db, path),
        (snap) => {
          const val = snap.val();
          if (val) {
            if (val.cutoffTime !== undefined) setCutoffTime(val.cutoffTime);
            if (val.cutoffEnabled !== undefined) setCutoffEnabled(val.cutoffEnabled);
            if (val.forceLock !== undefined) setForceLock(val.forceLock);
            if (val.vehicleLimits) setVehicleLimits(val.vehicleLimits);
            if (val.activeDateKey) setActiveDateKey(val.activeDateKey);
          }
        },
        (error) => {
          console.error("[Settings] Failed to load settings:", error);
        }
      );
    })().catch((err) => {
      console.error("[Settings] Initialization failed:", err);
    });

    return () => {
      unsubSettings?.();
    };
  }, [courseId]);

  const handleSave = async () => {
    if (!dbRef) return;
    try {
      const { ref, update } = await import("firebase/database");

      let cutoffTimestamp = null;
      if (activeDateKey && cutoffTime) {
        const [year, month, day] = activeDateKey.split("-").map(Number);
        const [cutoffHours, cutoffMinutes] = cutoffTime.split(":").map(Number);
        const cutoff = new Date(year, month - 1, day);
        cutoff.setDate(cutoff.getDate() - 1);
        cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);
        cutoffTimestamp = cutoff.getTime();
      }

      await update(ref(dbRef, `rakeb/settings/${courseId}`), {
        cutoffTime,
        cutoffEnabled,
        forceLock,
        ...(cutoffTimestamp ? { cutoffTimestamp } : {}),
        vehicleLimits,
        updatedAt: Date.now(),
        updatedBy: user?.uid || "unknown",
      });
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (e) {
      console.error("[Settings] Save failed:", e);
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  const handleCreateCourseSubmit = async () => {
    if (!newCourseId.trim() || !newCourseName.trim()) return;
    setIsCreatingCourse(true);
    try {
      await createCourse(newCourseId, newCourseName);
      toast.success(`تم إنشاء الدورة "${newCourseName.trim()}" بنجاح!`, {
        action: {
          label: "نسخ رابط التسجيل",
          onClick: () => copyRegisterLink(newCourseId.trim().toLowerCase()),
        },
      });
      setNewCourseId("");
      setNewCourseName("");
      setCreateDialogOpen(false);
    } catch (e: any) {
      console.error("[Settings] Create course failed:", e);
      toast.error(e?.message || "حدث خطأ أثناء إنشاء الدورة");
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const executeCourseAction = async () => {
    if (!actionTargetCourse || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === "archive") {
        await archiveCourse(actionTargetCourse.id);
        toast.success(`تم أرشفة الدورة "${actionTargetCourse.name}" ونقل طلابها للأرشيف.`);
      } else if (actionType === "delete") {
        await deleteCourse(actionTargetCourse.id);
        toast.success(`تم حذف الدورة "${actionTargetCourse.name}" وجميع بياناتها بنجاح.`);
      }
      setActionTargetCourse(null);
      setActionType(null);
    } catch (e: any) {
      console.error(`[Settings] ${actionType} course failed:`, e);
      toast.error(e?.message || `حدث خطأ أثناء تنفيذ الإجراء على الدورة`);
    } finally {
      setActionLoading(false);
    }
  };

  // Combine default with custom courses for full overview
  const allDisplayCourses: CourseInfo[] = [
    {
      id: "default",
      name: "الدورة الأساسية",
      adminUid: "system",
      status: "active",
      createdAt: 0,
      startDate: 0,
    },
    ...coursesList.filter((c) => c.id !== "default"),
  ];

  return (
    <div className="space-y-6 pt-4 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
          <p className="text-muted-foreground mt-1">إدارة إعدادات النظام والدورات</p>
        </div>
        <Button className="hidden md:flex gap-2 bg-primary" onClick={handleSave}>
          <Save className="w-4 h-4" />
          حفظ التعديلات
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Registration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              إعدادات التسجيل للدورة الحالية ({courseId})
            </CardTitle>
            <CardDescription>تحكم في أوقات غلق التسجيل للطلاب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div>
                <label className="text-sm font-medium text-foreground">إغلاق التسجيل يدوياً</label>
                <p className="text-xs text-muted-foreground">منع الطلاب من تغيير حالتهم فوراً وبشكل دائم</p>
              </div>
              <Switch
                checked={forceLock}
                onCheckedChange={setForceLock}
                className={forceLock ? "bg-red-500" : ""}
              />
            </div>

            <div
              className={`flex items-center justify-between pb-4 border-b border-border/50 ${
                forceLock ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <div>
                <label className="text-sm font-medium text-foreground">تفعيل غلق التسجيل التلقائي</label>
                <p className="text-xs text-muted-foreground">منع الطلاب من تغيير حالتهم بعد وقت محدد</p>
              </div>
              <Switch checked={cutoffEnabled} onCheckedChange={setCutoffEnabled} />
            </div>

            <div className={`space-y-2 ${!cutoffEnabled || forceLock ? "opacity-50 pointer-events-none" : ""}`}>
              <label className="text-sm font-medium text-foreground">وقت غلق التسجيل يومياً</label>
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full p-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">الوقت بصيغة 24 ساعة (مثال: 22:00 = 10 مساءً)</p>
            </div>

            <div className="pt-4 border-t border-border/50">
              <label className="text-sm font-medium text-foreground">تاريخ الرحلة القادمة (اليوم الفعال)</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="date"
                  value={activeDateKey || ""}
                  onChange={async (e) => {
                    const newDate = e.target.value;
                    if (!newDate || !dbRef) return;
                    try {
                      const { ref, update } = await import("firebase/database");
                      await update(ref(dbRef, `rakeb/settings/${courseId}`), { activeDateKey: newDate });
                      setActiveDateKey(newDate);
                      toast.success("تم تحديث تاريخ الرحلة القادمة بنجاح");
                    } catch (err) {
                      toast.error("فشل في تحديث تاريخ الرحلة");
                    }
                  }}
                  className="w-full p-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                هذا هو تاريخ الرحلة التي سيتم التسجيل لها للدورة الحالية.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              سعات المركبات
            </CardTitle>
            <CardDescription>تحديد أقصى عدد لركاب كل نوع</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3 text-foreground">ميكروباص</span>
              <input
                type="number"
                value={vehicleLimits.micro}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, micro: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-border rounded-lg bg-card text-foreground text-center"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3 text-foreground">أتوبيس</span>
              <input
                type="number"
                value={vehicleLimits.bus}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, bus: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-border rounded-lg bg-card text-foreground text-center"
              />
            </div>
          </CardContent>
        </Card>

        {/* Course Management */}
        <Card className="md:col-span-2 border-primary/20">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-primary" />
                  إدارة الدورات
                </CardTitle>
                <CardDescription>
                  إنشاء دورات جديدة، التبديل بينها، نسخ روابط التسجيل، والأرشفة أو الحذف
                </CardDescription>
              </div>

              <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button className="gap-2 shrink-0">
                    <PlusCircle className="w-4 h-4" />
                    دورة جديدة
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>إنشاء دورة جديدة</AlertDialogTitle>
                    <AlertDialogDescription>
                      أدخل تفاصيل الدورة الجديدة. سيتم إنشاء رابط تسجيل مخصص لها فوراً.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">اسم الدورة</label>
                      <Input
                        placeholder="مثال: الدفعة 42 (مسار الويب)"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">معرف الدورة (بالإنجليزية وبدون مسافات)</label>
                      <Input
                        placeholder="مثال: intake-42"
                        value={newCourseId}
                        onChange={(e) => setNewCourseId(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCreateCourseSubmit}
                      disabled={isCreatingCourse || !newCourseId.trim() || !newCourseName.trim()}
                    >
                      {isCreatingCourse ? "جاري الإنشاء..." : "إنشاء الدورة"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                قائمة الدورات المتاحة
              </h4>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md font-medium">
                {allDisplayCourses.length} دورات
              </span>
            </div>

            <div className="space-y-3">
              {allDisplayCourses.map((c) => {
                const isCurrent = c.id === courseId;
                const isActive = c.status === "active";
                const isDefault = c.id === "default";

                return (
                  <div
                    key={c.id}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? "border-primary/50 bg-primary/5 shadow-xs"
                        : "border-border/60 bg-card hover:border-border"
                    }`}
                  >
                    {/* Course Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-foreground">{c.name}</span>
                        <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-mono dir-ltr">
                          {c.id}
                        </span>

                        {isCurrent ? (
                          <span className="text-[11px] bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                            <Check className="w-3 h-3" />
                            الدورة المعروضة حالياً
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setCourseId(c.id);
                              toast.success(`تم التبديل إلى دورة "${c.name}"`);
                            }}
                            className="text-[11px] bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-0.5 rounded-full font-semibold transition-colors active:scale-95"
                          >
                            تبديل إليها
                          </button>
                        )}

                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {isActive ? "نشطة" : "مؤرشفة"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono dir-ltr">
                        <span>/register?course={c.id}</span>
                      </div>
                    </div>

                    {/* Course Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Copy registration link */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs font-semibold shrink-0"
                        onClick={() => copyRegisterLink(c.id)}
                        title="نسخ رابط تسجيل الطلاب لهذه الدورة"
                      >
                        <Copy className="w-3.5 h-3.5 text-primary" />
                        <span>نسخ الرابط</span>
                      </Button>

                      {/* Archive Course Button */}
                      {isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                          onClick={() => {
                            setActionTargetCourse(c);
                            setActionType("archive");
                          }}
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>أرشفة</span>
                        </Button>
                      )}

                      {/* Delete Course Button (for custom courses) */}
                      {!isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setActionTargetCourse(c);
                            setActionType("delete");
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog for Course Actions (Archive / Delete) */}
      <AlertDialog
        open={!!actionTargetCourse && !!actionType}
        onOpenChange={(open) => {
          if (!open) {
            setActionTargetCourse(null);
            setActionType(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[380px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-base">
              {actionType === "archive" ? "أرشفة الدورة" : "حذف الدورة نهائياً"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm leading-relaxed">
              {actionType === "archive" ? (
                <>
                  هل أنت متأكد من أرشفة دورة{" "}
                  <strong className="text-foreground">"{actionTargetCourse?.name}"</strong>؟
                  <br />
                  <span className="text-xs text-amber-700 dark:text-amber-400 block mt-2">
                    سيتم نقل جميع طلاب هذه الدورة للأرشيف، وسيمكنهم التسجيل في الدورات الجديدة ببياناتهم المحفوظة.
                  </span>
                </>
              ) : (
                <>
                  هل أنت متأكد من حذف دورة{" "}
                  <strong className="text-destructive">"{actionTargetCourse?.name}"</strong> بالكامل؟
                  <br />
                  <span className="text-xs text-destructive font-semibold block mt-2">
                    سيتم مسح بيانات الدورة وسجلاتها ورحلاتها نهائياً. لا يمكن التراجع عن هذا الإجراء!
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel disabled={actionLoading} className="rounded-xl">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeCourseAction}
              disabled={actionLoading}
              className={`rounded-xl ${
                actionType === "archive"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }`}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التنفيذ...
                </>
              ) : actionType === "archive" ? (
                "تأكيد الأرشفة"
              ) : (
                "تأكيد الحذف النهائي"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile Save Floating Button */}
      <div className="md:hidden fixed bottom-20 ltr:right-4 rtl:left-4 z-40">
        <Button
          onClick={handleSave}
          className="rounded-full w-14 h-14 shadow-lg bg-primary text-white flex items-center justify-center p-0"
        >
          <Save className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
