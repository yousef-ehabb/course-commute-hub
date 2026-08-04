import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import type { UserProfile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { MapPin, TrendingUp, Users, CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useStations } from "@/contexts/StationsContext";
import { getStationName, isStationSelected } from "@/utils/stationResolver";

import { useAuth } from "@/contexts/AuthContext";

export const Route = createLazyFileRoute("/_authenticated/admin/stats")({
  component: StatsPage,
});

const dayNamesArabic = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const { stations, loading: stationsLoading } = useStations();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [topStation, setTopStation] = useState<{ name: string; avg: number }>({
    name: "---",
    avg: 0,
  });
  const [avgRiders, setAvgRiders] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [trendText, setTrendText] = useState("لا تتوفر بيانات كافية");
  const [stationBreakdown, setStationBreakdown] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    let unsubDaily: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const db = getFirebaseDb();

      // Listen to total registered users
      unsubUsers = onValue(
        ref(db, "rakeb/users"),
        (snap) => {
          const val = snap.val();
          if (val) {
            const usersList = Object.entries(val)
              .map(([uid, u]: [string, any]) => ({ uid, ...u }))
              .filter((u: any) => u.role === "student");
            setUsers(usersList);
            setTotalUsers(usersList.length);
          } else {
            setTotalUsers(0);
          }
        },
        (error) => {
          console.error("[Stats] Failed to load users:", error);
        },
      );

      // Listen to all daily statuses across dates
      unsubDaily = onValue(
        ref(db, "rakeb/dailyStatus/default"),
        (snap) => {
          const val = snap.val();
          if (!val) {
            setChartData([]);
            setTopStation({ name: "لا توجد بيانات", avg: 0 });
            setAvgRiders(0);
            setStationBreakdown(stations.map((s) => ({ name: s.name, count: 0 })));
            setLoading(false);
            return;
          }

          const dates = Object.keys(val).sort();
          let totalRidersAllTime = 0;
          const stationTotals: Record<string, number> = {};
          stations.forEach((s) => {
            stationTotals[s.id] = 0;
          });
          stationTotals["custom"] = 0;

          const chartItems = dates.map((dateStr) => {
            const parts = dateStr.split("-").map(Number);
            let dayLabel = dateStr;
            if (parts.length === 3) {
              const d = new Date(parts[0], parts[1] - 1, parts[2]);
              const dayName = dayNamesArabic[d.getDay()] || "";
              dayLabel = `${dayName} (${parts[2]}/${parts[1]})`;
            }

            const dayData = val[dateStr] || {};
            let riders = 0;
            let cancelled = 0;
            let boarded = 0;

            // Process explicit records first
            const explicitIds = new Set<string>();
            Object.values(dayData).forEach((u: any) => {
              if (u.role !== "student") return;
              explicitIds.add(u.id);
              const hasSelectedStation = isStationSelected(u.station);
              if (u.status === "riding" && hasSelectedStation) {
                riders++;
                totalRidersAllTime++;
                if (u.boarded) boarded++;
                if (u.station && stationTotals[u.station] !== undefined) {
                  stationTotals[u.station]++;
                }
              } else if (u.status === "cancelled") {
                cancelled++;
              }
            });

            // Add implicit riders (students who don't have an explicit record for this day)
            users.forEach((user) => {
              const hasSelectedStation = isStationSelected(user.defaultStation);
              if (user.role === "student" && hasSelectedStation && !explicitIds.has(user.uid)) {
                riders++;
                totalRidersAllTime++;
                const station = user.defaultStation;
                if (stationTotals[station] !== undefined) {
                  stationTotals[station]++;
                }
              }
            });

            const rate = Math.min(100, Math.round((riders / 50) * 100));

            return {
              dateStr,
              day: dayLabel,
              riders,
              cancelled,
              boarded,
              rate,
            };
          });

          const activeDaysCount = Math.max(1, dates.length);
          const calculatedAvg = Math.round(totalRidersAllTime / activeDaysCount);

          // Find top used station
          let maxCount = -1;
          let maxId = "";
          Object.entries(stationTotals).forEach(([stId, cnt]) => {
            if (cnt > maxCount) {
              maxCount = cnt;
              maxId = stId;
            }
          });

          const topStName = maxId ? getStationName(maxId, stations) : "غير محدد";
          const topStAvg = Math.round((maxCount > 0 ? maxCount : 0) / activeDaysCount);

          // Trend text
          if (chartItems.length >= 2) {
            const latest = chartItems[chartItems.length - 1].riders;
            const prev = chartItems[chartItems.length - 2].riders;
            if (prev > 0) {
              const diff = Math.round(((latest - prev) / prev) * 100);
              setTrendText(`${diff >= 0 ? "+" : ""}${diff}% عن اليوم السابق`);
            } else {
              setTrendText("بيانات جديدة اليوم");
            }
          } else {
            setTrendText("أول يوم مسجل");
          }

          setChartData(chartItems);
          setTopStation({ name: topStName, avg: topStAvg });
          setAvgRiders(calculatedAvg);
          setStationBreakdown(
            stations.map((s) => ({
              name: s.name,
              count: stationTotals[s.id] || 0,
            })),
          );
          setLoading(false);
        },
        (error) => {
          console.error("[Stats] Failed to load daily status:", error);
          setLoading(false);
        },
      );
    })().catch((err) => {
      console.error("[Stats] Initialization failed:", err);
      setLoading(false);
    });

    return () => {
      unsubDaily?.();
      unsubUsers?.();
    };
  }, [user, authLoading, stations, users]);

  if (stationsLoading || loading) {
    return (
      <div className="space-y-5 pt-2 pb-20">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2 pb-20">
      <div>
        <h1 className="text-xl font-semibold text-foreground">الإحصائيات التحليلية</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          تحليلات حية لأداء ورحلات الكورس من قاعدة البيانات
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-primary-foreground border-none shadow-card">
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-primary-foreground/80 text-[13px] font-medium">
                  أكثر نقاط التجمع استخداماً
                </p>
                <h3 className="text-xl font-bold mt-1">{topStation.name}</h3>
                <p className="text-[12px] mt-2 text-primary-foreground/90">
                  بمتوسط {topStation.avg} طالب يومياً
                </p>
              </div>
              <div className="bg-white/15 p-2.5 rounded-2xl">
                <MapPin className="w-5 h-5 text-white" strokeWidth={1.8} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">متوسط الركاب يومياً</p>
                <h3 className="text-xl font-bold text-foreground mt-1">{avgRiders} طالب</h3>
                <p className="text-[12px] mt-2 text-success flex items-center gap-1 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.8} />
                  {trendText}
                </p>
              </div>
              <div className="bg-primary/8 text-primary p-2.5 rounded-2xl">
                <Users className="w-5 h-5" strokeWidth={1.8} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">
                  إجمالي الطلاب المسجلين
                </p>
                <h3 className="text-xl font-bold text-foreground mt-1">{totalUsers} طالب</h3>
                <p className="text-[12px] mt-2 text-muted-foreground">
                  حسابات طلاب معتمدة في النظام
                </p>
              </div>
              <div className="bg-success/8 text-success p-2.5 rounded-2xl">
                <UserCheck className="w-5 h-5" strokeWidth={1.8} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Riders Area Chart */}
        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle>معدل الطلاب الأيام المسجلة</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                لا توجد سجلات رحلات يومية حتى الآن
              </div>
            ) : (
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRiders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="riders"
                      name="عدد الركاب"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRiders)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Line Chart */}
        <Card>
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle>نسبة الإشغال اليومية (%)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
                لا توجد سجلات رحلات يومية حتى الآن
              </div>
            ) : (
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="نسبة الإشغال %"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Station Breakdown Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-4">
            <CardTitle>إجمالي الركاب حسب نقاط التجمع (تراكمي)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stationBreakdown}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" name="إجمالي الركاب" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
