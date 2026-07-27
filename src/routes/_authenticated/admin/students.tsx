import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useStations } from "@/contexts/StationsContext";
import { useTodayStatus } from "@/hooks/useTodayStatus";
import { getStationName } from "@/utils/stationResolver";
import { Download } from "lucide-react";
import { exportToExcel } from "@/lib/export";
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
}

type FilterType = "all" | "riding" | "not_riding";

function StudentsPage() {
  const { stations } = useStations();
  const { getAllStudentsStatus } = useTodayStatus();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [users, setUsers] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let unsub: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      unsub = onValue(ref(getFirebaseDb(), "rakeb/users"), (snap) => {
        const val = snap.val();
        if (val) {
          setUsers(Object.entries(val).map(([uid, u]: [string, any]) => ({ uid, ...u })));
        } else {
          setUsers([]);
        }
      });
    })();
    return () => unsub?.();
  }, []);

  const students = useMemo<StudentRecord[]>(() => {
    const allStatus = getAllStudentsStatus(users);
    return allStatus.map((u) => {
      const stationName = getStationName(u.station, stations);
      return {
        id: u.id,
        name: u.fullName || "غير معروف",
        phone: u.phone || "---",
        nationalId: u.nationalId || "---",
        station: stationName,
        isRidingToday: u.status === "riding",
      };
    });
  }, [getAllStudentsStatus, users, stations]);

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

  return (
    <div className="w-full max-w-5xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-md pb-24">
      {/* Header */}
      <header className="w-full sticky top-0 z-10 bg-surface/80 backdrop-blur-md shadow-sm flex items-center justify-between py-4 mb-stack-md -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-95 duration-150"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          <span className="font-label-md text-label-md">تصدير إلى Excel</span>
        </button>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
          الطلاب
        </h1>
        {/* Invisible spacer to perfectly center the title against the button */}
        <div className="w-32 opacity-0 pointer-events-none hidden sm:block"></div>
      </header>

      {/* Search Bar Section */}
      <div className="relative w-full mb-stack-lg">
        <input
          className="w-full h-14 pr-12 pl-4 rounded-2xl border border-outline-variant bg-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body-lg text-body-lg text-on-surface shadow-sm placeholder:text-on-surface-variant/50"
          placeholder="ابحث بالاسم أو الموبايل..."
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-on-surface-variant">
          <span className="material-symbols-outlined">search</span>
        </div>
      </div>

      {/* Filter Chips Section */}
      <div className="flex overflow-x-auto hide-scrollbar gap-stack-sm mb-stack-lg pb-2 -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0">
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
        className="flex flex-col gap-4"
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
          <div className="text-center text-on-surface-variant py-16 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest rounded-3xl border border-dashed border-outline-variant">
            <span className="material-symbols-outlined text-[48px] text-outline-variant/50">search_off</span>
            <p className="font-title-md text-title-md">لا توجد نتائج مطابقة</p>
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
              className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/40 hover:border-primary/30 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <h2 className="font-title-lg text-title-lg text-on-surface group-hover:text-primary transition-colors">
                    {student.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                    <p className="font-body-md text-body-md">{student.station}</p>
                  </div>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm tracking-normal flex items-center gap-1.5 border ${
                    isRiding
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-surface-container text-on-surface-variant border-outline-variant/30"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isRiding ? "bg-primary" : "bg-on-surface-variant"}`}
                  />
                  {isRiding ? "تم تأكيد الحضور" : "لم يتم التأكيد"}
                </div>
              </div>

              <div className="h-px w-full bg-outline-variant/30 mb-4"></div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-on-surface-variant" dir="ltr">
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  <span className="font-body-md text-body-md tracking-wider">{student.phone}</span>
                </div>
                <a
                  href={`tel:${student.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-primary bg-primary/5 hover:bg-primary/10 px-4 py-2 rounded-lg font-label-md transition-colors active:scale-95 duration-150"
                >
                  <span className="material-symbols-outlined text-[18px]">phone_in_talk</span>
                  اتصال
                </a>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
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
      className={`px-6 py-2.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all duration-200 active:scale-95 border ${
        active
          ? "bg-primary text-white border-primary shadow-sm"
          : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:bg-surface-container hover:text-on-surface"
      }`}
    >
      {label}
    </button>
  );
}
