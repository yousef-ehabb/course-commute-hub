import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Search,
  Clock,
  UserCheck,
  Users,
  UserX,
  MapPin,
  ChevronDown,
  ChevronUp,
  History,
  ShieldAlert,
  FilterX,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCourse } from "@/contexts/CourseContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useStations } from "@/contexts/StationsContext";
import { getStationName } from "@/utils/stationResolver";
import type { UserProfile } from "@/types";

export const Route = createLazyFileRoute("/_authenticated/admin/history")({
  component: HistoryPage,
});

interface TripHistoryRecord {
  dateKey: string;
  startedAt?: number;
  endedAt?: number;
  completedAt?: number;
  completedBy?: string;
  tripDuration?: number;
  totalStationsVisited?: number;
  totalExpectedPassengers?: number;
  totalCancelledPassengers?: number;
  status?: string;
  currentStationId?: string;
  nextStationId?: string;
  createdAt?: number;
  [key: string]: unknown;
}

function formatDurationMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return "غير محدد";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }
  return `${minutes} دقيقة`;
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return "---";
  try {
    return format(new Date(ts), "hh:mm a", { locale: ar });
  } catch {
    return "---";
  }
}

function HistoryPage() {
  const { stations, loading: stationsLoading } = useStations();
  const { courseId } = useCourse();
  const [historyMap, setHistoryMap] = useState<Record<string, TripHistoryRecord> | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [dailyStatusMap, setDailyStatusMap] = useState<Record<string, Record<string, any>>>({});
  const [boardingMap, setBoardingMap] = useState<Record<string, Record<string, any>>>({});
  
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchDate, setSearchDate] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setMounted(true);
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue, get } = await import("firebase/database");
      const db = getFirebaseDb();
      
      // Fetch users map once
      try {
        const usersSnap = await get(ref(db, "rakeb/users"));
        if (usersSnap.exists()) {
          setUsersMap(usersSnap.val());
        }
      } catch (err) {
        console.error("Failed to load users map:", err);
      }

      // Fetch daily statuses map once
      try {
        const dailySnap = await get(ref(db, `rakeb/dailyStatus/${courseId}`));
        if (dailySnap.exists()) {
          setDailyStatusMap(dailySnap.val());
        }
      } catch (err) {
        console.error("Failed to load daily statuses:", err);
      }

      // Subscribe to history
      const historyRef = ref(db, `rakeb/tripHistory/${courseId}`);
      unsubscribe = onValue(
        historyRef,
        async (snap) => {
          if (snap.exists()) {
            const data = snap.val();
            setHistoryMap(data);
            
            // Fetch boarding records per dateKey because root read is restricted by rules
            const boardingMapTemp: Record<string, any> = {};
            await Promise.all(
              Object.keys(data).map(async (dateKey) => {
                try {
                  const bSnap = await get(ref(db, `rakeb/boardingRecords/${dateKey}`));
                  if (bSnap.exists()) {
                    boardingMapTemp[dateKey] = bSnap.val();
                  }
                } catch (e) {
                  console.error(`Failed to fetch boarding for ${dateKey}:`, e);
                }
              })
            );
            setBoardingMap(boardingMapTemp);
          } else {
            setHistoryMap({});
            setBoardingMap({});
          }
          setLoading(false);
        },
        (error) => {
          console.error("Failed to load history:", error);
          setLoading(false);
        },
      );
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const sortedTrips = useMemo(() => {
    if (!historyMap) return [];
    const entries = Object.entries(historyMap).map(([dateKey, record]) => ({
      ...record,
      dateKey,
    }));

    // Filter by searchDate, startDateFilter, endDateFilter
    return entries
      .filter((trip) => {
        if (searchDate && !trip.dateKey.includes(searchDate)) {
          return false;
        }
        if (startDateFilter && trip.dateKey < startDateFilter) {
          return false;
        }
        if (endDateFilter && trip.dateKey > endDateFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [historyMap, searchDate, startDateFilter, endDateFilter]);

  const toggleExpand = (dateKey: string) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const clearFilters = () => {
    setSearchDate("");
    setStartDateFilter("");
    setEndDateFilter("");
  };

  // Helper to categorize passengers (students + staff) for a specific date
  const getStudentsForDay = (dateKey: string) => {
    const dayData = dailyStatusMap[dateKey] || {};
    const dayBoarding = boardingMap[dateKey] || {};
    const boarded: { name: string; stationName: string; isStaff?: boolean }[] = [];
    const absent: { name: string; stationName: string; isStaff?: boolean }[] = [];
    const cancelled: { name: string; stationName: string; isStaff?: boolean }[] = [];

    // Track all processed passenger IDs to avoid double-counting
    const processedIds = new Set<string>();

    // 1. Process explicit daily status records (students and staff)
    Object.entries(dayData).forEach(([uid, record]: [string, any]) => {
      const u = usersMap[uid];
      const isStaff = Boolean(record.isStaff || u?.role === "admin");
      
      // If not staff and not student (or no record status), skip
      if (!isStaff && u?.role !== "student" && !record.status) return;
      processedIds.add(uid);

      const stName = getStationName(record.station || u?.defaultStation, stations);
      const passengerName = record.fullName || u?.fullName || (u as any)?.name || (isStaff ? "موظف" : "طالب");

      if (record.status === "cancelled") {
        cancelled.push({ name: passengerName, stationName: stName, isStaff });
      } else if (record.status === "riding") {
        // Explicit riding status — check boarding
        const isBoarded = dayBoarding[uid]?.status === "boarded" || record.boarded === true;
        if (isBoarded) {
          boarded.push({ name: passengerName, stationName: stName, isStaff });
        } else {
          absent.push({ name: passengerName, stationName: stName, isStaff });
        }
      } else if (record.boarded === true) {
        // No explicit status but boarded flag is set
        boarded.push({ name: passengerName, stationName: stName, isStaff });
      }
    });

    // 2. Process boarding records for passengers not already in dailyStatus
    Object.entries(dayBoarding).forEach(([uid, record]: [string, any]) => {
      if (processedIds.has(uid)) return;
      const u = usersMap[uid];
      const isStaff = Boolean(record.isStaff || u?.role === "admin");
      processedIds.add(uid);

      const stName = getStationName(u?.defaultStation, stations);
      const passengerName = u?.fullName || (u as any)?.name || (isStaff ? "موظف" : "طالب");

      if (record.status === "boarded") {
        boarded.push({ name: passengerName, stationName: stName, isStaff });
      }
    });

    // 3. Add remaining registered students as absent (enrolled in course with station selected)
    Object.entries(usersMap).forEach(([uid, u]) => {
      if (processedIds.has(uid)) return;
      if (u.role !== "student") return;
      // Only include students who have a valid station assigned (i.e. registered for the course)
      if (!u.defaultStation || u.defaultStation === "creativa" || u.defaultStation === "unassigned" || u.defaultStation === "none" || u.defaultStation === "unknown" || u.defaultStation.trim() === "") return;
      processedIds.add(uid);

      const stName = getStationName(u.defaultStation, stations);
      const studentName = u.fullName || (u as any).name || "غير معروف";
      absent.push({ name: studentName, stationName: stName, isStaff: false });
    });

    return { boarded, absent, cancelled };
  };

  if (loading || stationsLoading) {
    return (
      <div className="space-y-5 pt-2 pb-20">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2 pb-20">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          سجل الرحلات
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          أرشيف كامل للرحلات المكتملة وإحصائياتها التفصيلية
        </p>
      </div>

      {/* Filter controls */}
      <Card className="rounded-2xl shadow-card border-none bg-card">
        <div
          className="p-4 flex items-center justify-between cursor-pointer sm:cursor-default"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="w-4 h-4 text-primary" />
            تصفية النتائج
          </div>
          <Button variant="ghost" size="sm" className="sm:hidden p-0 h-auto hover:bg-transparent">
            {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>

        <CardContent className={`p-4 pt-0 space-y-3 ${showFilters ? "block" : "hidden sm:block"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute rtl:right-3 ltr:left-3 top-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="بحث بالتاريخ (مثال: 2026-07)"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="rtl:pr-9 ltr:pl-9 h-10 rounded-xl text-xs"
              />
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 absolute rtl:right-3 ltr:left-3 top-3 text-muted-foreground" />
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="rtl:pr-9 ltr:pl-9 h-10 rounded-xl text-xs"
                placeholder="من تاريخ"
              />
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 absolute rtl:right-3 ltr:left-3 top-3 text-muted-foreground" />
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="rtl:pr-9 ltr:pl-9 h-10 rounded-xl text-xs"
                placeholder="إلى تاريخ"
              />
            </div>
          </div>

          {(searchDate || startDateFilter || endDateFilter) && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8"
              >
                <FilterX className="w-3.5 h-3.5" />
                مسح الفلاتر
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trips list */}
      {sortedTrips.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center bg-card shadow-card">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">لا توجد رحلات مؤرشفة</h3>
          <p className="text-xs text-muted-foreground mt-1">
            لم يتم العثور على رحلات تكتمل في النطاق المحدد.
          </p>
        </Card>
      ) : (
        <motion.div 
          className="space-y-3"
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
          {sortedTrips.map((trip) => {
            const isExpanded = !!expandedKeys[trip.dateKey];
            const durationText = formatDurationMs(trip.tripDuration);
            const startTimeText = formatTimestamp(trip.startedAt || trip.createdAt as number);
            const endTimeText = formatTimestamp(trip.endedAt || trip.completedAt);
            
            const { boarded, absent, cancelled } = getStudentsForDay(trip.dateKey);
            const boardedCount = boarded.length;
            const expectedCount = boarded.length + absent.length;
            
            const dayBoarding = boardingMap[trip.dateKey] || {};
            const boardedRecords = Object.values(dayBoarding).filter((r: any) => r.status === "boarded");
            const firstBoardingRecord = boardedRecords.find((r: any) => r.boardedByCoordinatorId);
            const coordinatorId = firstBoardingRecord ? (firstBoardingRecord as any).boardedByCoordinatorId : null;
            
            const coordUser = coordinatorId ? usersMap[coordinatorId] : null;
            const coordName = coordUser ? (coordUser.fullName || (coordUser as any).name || coordinatorId) : null;
            
            const enderUser = trip.completedBy ? usersMap[trip.completedBy] : null;
            const enderName = enderUser ? (enderUser.fullName || (enderUser as any).name || trip.completedBy) : (trip.completedBy || "النظام");
            
            const displayAdminName = coordName || enderName;
            
            const showEnderNote = coordinatorId && trip.completedBy && coordinatorId !== trip.completedBy;

            return (
              <motion.div
                key={trip.dateKey}
                initial={mounted ? false : "hidden"}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 }
                }}
              >
                <Card
                  className="rounded-2xl border-none shadow-card bg-card overflow-hidden transition-all"
                >
                <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {/* Primary header info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground dir-ltr text-right">
                          {trip.dateKey}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          مدة الرحلة: {durationText}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[11px] font-medium flex items-center gap-1">
                        مكتملة
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(trip.dateKey)}
                        className="gap-1 text-xs h-8 rounded-xl"
                      >
                        {isExpanded ? (
                          <>
                            إخفاء التفاصيل
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            عرض التفاصيل
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Summary metric pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">الحضور / المتوقع</div>
                        <div className="text-xs font-bold text-foreground">
                          <span dir="ltr" className="inline-flex items-center gap-1">
                            <span className="text-emerald-600">{boardedCount}</span>
                            <span className="text-muted-foreground">/</span>
                            <span>{expectedCount}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                      <UserX className="w-4 h-4 text-destructive shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">الاعتذارات</div>
                        <div className="text-xs font-bold text-foreground">
                          {trip.totalCancelledPassengers ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">نقاط التجمع</div>
                        <div className="text-xs font-bold text-foreground">
                          {trip.totalStationsVisited ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">المنسق</div>
                        <div className="text-[11px] font-semibold text-foreground truncate" title={displayAdminName}>
                          {displayAdminName}
                        </div>
                        {showEnderNote && (
                          <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight truncate max-w-[140px]" title={`تم الإنهاء بواسطة: ${enderName}`}>
                            (تم الإنهاء: {enderName})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-border/50 space-y-4 animate-in fade-in-50 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-xl">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            وقت البدء:
                          </span>
                          <span className="font-medium text-foreground">{startTimeText}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            وقت الإنهاء:
                          </span>
                          <span className="font-medium text-foreground">{endTimeText}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Boarded Passengers */}
                        <div>
                          <h4 className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4" />
                            الركاب الحاضرين ({boarded.length})
                          </h4>
                          {boarded.length === 0 ? (
                            <p className="text-xs text-muted-foreground">لا يوجد</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {boarded.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground">{s.name}</span>
                                    {s.isStaff && (
                                      <span className="text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                                        موظف / مدرب
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground text-[10px]">{s.stationName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Absent Passengers */}
                        <div>
                          <h4 className="text-xs font-bold text-destructive mb-2 flex items-center gap-1.5">
                            <UserX className="w-4 h-4" />
                            الركاب الغائبين ({absent.length})
                          </h4>
                          {absent.length === 0 ? (
                            <p className="text-xs text-muted-foreground">لا يوجد</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {absent.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground">{s.name}</span>
                                    {s.isStaff && (
                                      <span className="text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                                        موظف / مدرب
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground text-[10px]">{s.stationName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Cancelled Passengers */}
                        <div>
                          <h4 className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4" />
                            الاعتذارات ({cancelled.length})
                          </h4>
                          {cancelled.length === 0 ? (
                            <p className="text-xs text-muted-foreground">لا يوجد</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {cancelled.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground">{s.name}</span>
                                    {s.isStaff && (
                                      <span className="text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                                        موظف / مدرب
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground text-[10px]">{s.stationName}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {Boolean(trip.status) && (
                        <div className="text-xs text-muted-foreground pt-2">
                          حالة الأرشفة:{" "}
                          <span className="text-foreground font-medium">{String(trip.status)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
