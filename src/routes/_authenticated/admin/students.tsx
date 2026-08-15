import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStations } from "@/contexts/StationsContext";
import { useTodayStatus } from "@/hooks/useTodayStatus";
import { useBoardingRecords } from "@/hooks/useBoardingRecords";
import { useVehicles } from "@/hooks/useVehicles";
import { useCourse } from "@/contexts/CourseContext";
import { filterStudentsByCourse } from "@/utils/courseFilter";
import { getStationName } from "@/utils/stationResolver";
import { getVehicleLabelById } from "@/utils/vehicleLabels";
import { Download, Search, SearchX, MapPin, Phone, PhoneCall, Trash2, Archive, AlertTriangle, Loader2 } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: StudentsPage,
});

interface StudentRecord {
  id: string;
  name: string;
  phone: string;
  station: string;
  nationalId: string;
  isRidingToday: boolean;
  isBoarded?: boolean;
  vehicleName?: string;
  customLocation?: { lat: number; lng: number; name?: string };
}

type FilterType = "all" | "riding" | "not_riding";

function StudentsPage() {
  const { stations } = useStations();
  const { getAllStudentsStatus } = useTodayStatus();
  const { recordsByStudent } = useBoardingRecords();
  const { vehicles } = useVehicles();
  const { courseId } = useCourse();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [users, setUsers] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  // Delete/Archive dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<"archive" | "delete" | null>(null);

  useEffect(() => {
    setMounted(true);
    let unsub: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      unsub = onValue(ref(getFirebaseDb(), "rakeb/users"), (snap) => {
        const val = snap.val();
        if (val) {
          const allUsers = Object.entries(val).map(([uid, u]: [string, any]) => ({ uid, ...u }));
          setUsers(filterStudentsByCourse(allUsers, courseId));
        } else {
          setUsers([]);
        }
      });
    })();
    return () => unsub?.();
  }, [courseId]);

  const students = useMemo<StudentRecord[]>(() => {
    const allStatus = getAllStudentsStatus(users);
    return allStatus
      .filter((u) => !u.isStaff)
      .map((u) => {
        const stationName = getStationName(u.station, stations, u.customLocation?.name);
        const record = recordsByStudent[u.id];
        const isBoarded = record?.status === "boarded";
        const vehicleName = isBoarded && record?.vehicleId
          ? getVehicleLabelById(record.vehicleId, vehicles)
          : undefined;

        return {
          id: u.id,
          name: u.fullName || "غير معروف",
          phone: u.phone || "---",
          nationalId: u.nationalId || "---",
          station: stationName,
          isRidingToday: u.status === "riding",
          isBoarded,
          vehicleName,
          customLocation: u.customLocation,
        };
      });
  }, [getAllStudentsStatus, users, stations, recordsByStudent, vehicles]);

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.includes(searchTerm) || s.phone.includes(searchTerm);
    if (!matchesSearch) return false;

    if (filterType === "all") return true;
    if (filterType === "riding") return s.isRidingToday;
    if (filterType === "not_riding") return !s.isRidingToday;

    return true;
  });

  const handleExport = () => {
    const exportData = filteredStudents.map((student) => ({
      الاسم: student.name,
      "رقم الهاتف": student.phone,
      "نقطة التجمع": student.station,
      "تأكيد الحضور": student.isRidingToday ? "نعم" : "لا",
    }));

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });

    const metadata = [
      ["Daily Passenger Manifest"],
      [`Date: ${dateStr}`],
      [`Generated at: ${timeStr}`],
      [], // Empty line before table
    ];

    exportToExcel(exportData, `Passenger_Manifest_${now.toISOString().split("T")[0]}`, metadata);
  };

  const openDeleteDialog = (student: StudentRecord) => {
    setSelectedStudent(student);
    setDialogOpen(true);
  };

  const handleArchive = useCallback(async () => {
    if (!selectedStudent) return;
    setActionLoading("archive");
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, get, update } = await import("firebase/database");
      const db = getFirebaseDb();

      // Get the full user profile first
      const userSnap = await get(ref(db, `rakeb/users/${selectedStudent.id}`));
      if (!userSnap.exists()) {
        toast.error("لم يتم العثور على بيانات الطالب");
        return;
      }

      const userData = userSnap.val();
      const updates: Record<string, any> = {};

      // Move to archivedUsers under the current course
      updates[`rakeb/archivedUsers/${courseId}/${selectedStudent.id}`] = {
        ...userData,
        archivedAt: Date.now(),
        archivedFromCourse: courseId,
      };
      // Write reverse-lookup index for efficient archived-user checks
      updates[`rakeb/archivedUsersIndex/${selectedStudent.id}`] = { courseId };
      // Remove from active users
      updates[`rakeb/users/${selectedStudent.id}`] = null;

      await update(ref(db), updates);
      toast.success(`تم أرشفة "${selectedStudent.name}" بنجاح. يمكنه التسجيل في كورس جديد.`);
      setDialogOpen(false);
    } catch (err) {
      console.error("[Students] Archive failed:", err);
      toast.error("حدث خطأ أثناء أرشفة الطالب");
    } finally {
      setActionLoading(null);
    }
  }, [selectedStudent, courseId]);

  const handleDelete = useCallback(async () => {
    if (!selectedStudent) return;
    setActionLoading("delete");
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      const db = getFirebaseDb();

      const updates: Record<string, any> = {};
      // Remove from active users
      updates[`rakeb/users/${selectedStudent.id}`] = null;
      // Flag as permanently deleted
      updates[`rakeb/deletedUsers/${selectedStudent.id}`] = {
        deletedAt: Date.now(),
        deletedFromCourse: courseId,
        studentName: selectedStudent.name,
      };

      await update(ref(db), updates);
      toast.success(`تم حذف "${selectedStudent.name}" نهائياً.`);
      setDialogOpen(false);
    } catch (err) {
      console.error("[Students] Delete failed:", err);
      toast.error("حدث خطأ أثناء حذف الطالب");
    } finally {
      setActionLoading(null);
    }
  }, [selectedStudent, courseId]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-4 pb-24">
      {/* Header */}
      <header className="w-full sticky top-0 z-10 bg-background/80 backdrop-blur-md shadow-xs flex items-center justify-between py-4 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-95 text-xs font-semibold"
        >
          <Download className="w-4 h-4" />
          <span>تصدير إلى Excel</span>
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          الطلاب
        </h1>
        {/* Invisible spacer to perfectly center the title against the button */}
        <div className="w-32 opacity-0 pointer-events-none hidden sm:block"></div>
      </header>

      {/* Search Bar Section */}
      <div className="relative w-full mb-4">
        <input
          className="w-full h-12 pr-11 pl-4 rounded-xl border border-border bg-card focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm text-foreground shadow-xs placeholder:text-muted-foreground"
          placeholder="ابحث بالاسم أو الموبايل..."
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
        />
        <FilterChip
          label="تم تأكيد الحضور"
          active={filterType === "riding"}
          onClick={() => setFilterType("riding")}
        />
        <FilterChip
          label="لم يتم التأكيد"
          active={filterType === "not_riding"}
          onClick={() => setFilterType("not_riding")}
        />
      </div>

      {/* Student List */}
      <motion.div 
        className="flex flex-col gap-3"
        initial={mounted ? false : "hidden"}
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
          }
        }}
      >
        {filteredStudents.length === 0 && (
          <div className="text-center text-muted-foreground py-12 flex flex-col items-center justify-center gap-2 bg-card rounded-2xl border border-dashed border-border">
            <SearchX className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">لا توجد نتائج مطابقة</p>
          </div>
        )}

        {filteredStudents.map((student) => {
          const isRiding = student.isRidingToday;

          return (
            <motion.div
              key={student.id}
              initial={mounted ? false : "hidden"}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 }
              }}
              className="bg-card p-4 sm:p-5 rounded-2xl shadow-xs border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {student.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                    <MapPin className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs font-medium">{student.station}</p>
                    {student.customLocation?.lat && student.customLocation?.lng && (
                      <a
                        href={`https://maps.google.com/?q=${student.customLocation.lat},${student.customLocation.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/20"
                      >
                        🗺️ فتح الخريطة
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Delete/Archive button */}
                  <button
                    onClick={() => openDeleteDialog(student)}
                    className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all active:scale-90 duration-150"
                    title="إدارة حساب الطالب"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {student.isBoarded && (
                    <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                      ✓ تم الصعود {student.vehicleName ? `• ${student.vehicleName}` : ""}
                    </div>
                  )}
                  <div
                    className={`px-2.5 py-1 rounded-full text-xs tracking-normal flex items-center gap-1.5 border font-medium ${
                      isRiding
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted text-muted-foreground border-border/40"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isRiding ? "bg-primary" : "bg-muted-foreground"}`}
                    />
                    {isRiding ? "تم تأكيد الحضور" : "لم يتم التأكيد"}
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-border/40 mb-3"></div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground" dir="ltr">
                  <Phone className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wider">{student.phone}</span>
                </div>
                <a
                  href={`tel:${student.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 duration-150"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  اتصال
                </a>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Delete / Archive Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-base">
              إدارة حساب الطالب
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm leading-relaxed">
              ماذا تريد أن تفعل بحساب <strong className="text-foreground">{selectedStudent?.name}</strong>؟
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-3 py-2">
            {/* Archive Button */}
            <button
              onClick={handleArchive}
              disabled={!!actionLoading}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                {actionLoading === "archive" ? (
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">أرشفة</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                  انتهى الكورس — الطالب يقدر يسجل في كورس جديد
                </p>
              </div>
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={!!actionLoading}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-all active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                {actionLoading === "delete" ? (
                  <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-800 dark:text-red-200">حذف نهائي</p>
                <p className="text-[11px] text-red-700 dark:text-red-400 leading-snug">
                  حذف الحساب بالكامل ومنعه من الدخول
                </p>
              </div>
            </button>
          </div>

          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel disabled={!!actionLoading} className="w-full rounded-xl">
              إلغاء
            </AlertDialogCancel>
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 border ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-xs"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
