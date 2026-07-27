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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

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
  const [historyMap, setHistoryMap] = useState<Record<string, TripHistoryRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const db = getFirebaseDb();
      const historyRef = ref(db, "rakeb/tripHistory/default");

      unsubscribe = onValue(
        historyRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setHistoryMap(snapshot.val() as Record<string, TripHistoryRecord>);
          } else {
            setHistoryMap({});
          }
          setLoading(false);
        },
        (error) => {
          console.error("[HistoryPage] Failed to fetch history:", error);
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

  if (loading) {
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
          initial="hidden"
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
            const startTimeText = formatTimestamp(trip.startedAt);
            const endTimeText = formatTimestamp(trip.endedAt || trip.completedAt);

            return (
              <motion.div
                key={trip.dateKey}
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
                        <div className="text-[10px] text-muted-foreground">الركاب المتوقعون</div>
                        <div className="text-xs font-bold text-foreground">
                          {trip.totalExpectedPassengers ?? 0}
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
                        <div className="text-[10px] text-muted-foreground">المحطات</div>
                        <div className="text-xs font-bold text-foreground">
                          {trip.totalStationsVisited ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-2.5 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground">منفذ الإنهاء</div>
                        <div className="text-[11px] font-semibold text-foreground truncate max-w-[90px]">
                          {trip.completedBy ? trip.completedBy.substring(0, 8) : "النظام"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-border/50 space-y-3 animate-in fade-in-50 duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/30 p-3 rounded-xl">
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
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            معرف المستخدم الآدمن:
                          </span>
                          <span className="font-mono text-foreground">
                            {trip.completedBy || "غير مسجل"}
                          </span>
                        </div>
                      </div>

                      {Boolean(trip.status) && (
                        <div className="text-xs text-muted-foreground">
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
