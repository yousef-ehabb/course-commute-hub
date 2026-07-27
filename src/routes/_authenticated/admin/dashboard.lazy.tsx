import { createLazyFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import type { UserProfile } from "@/types";
import { StatsCards } from "@/components/admin/StatsCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useStations } from "@/contexts/StationsContext";
import { getStationName } from "@/utils/stationResolver";
import { useTodayStatus } from "@/hooks/useTodayStatus";
import { useTripStatus } from "@/hooks/useTripStatus";
import { Car, BusFront, Bus, MapPin, Navigation } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createLazyFileRoute("/_authenticated/admin/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { stations } = useStations();
  const { getAllStudentsStatus } = useTodayStatus();
  const { status: tripStatus } = useTripStatus();
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
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

  const { totalRiders, totalCancelled, totalBoarded, stationCounts } = useMemo(() => {
    let riders = 0;
    let cancelled = 0;
    let boarded = 0;
    const counts: Record<string, number> = {};
    stations.forEach((s) => (counts[s.name] = 0));

    const allStatus = getAllStudentsStatus(users);

    allStatus.forEach((user) => {
      if (user.status === "riding") {
        riders++;
        if (user.station) {
          const stName = getStationName(user.station, stations);
          counts[stName] = (counts[stName] || 0) + 1;
        }
        if (user.boarded) {
          boarded++;
        }
      } else if (user.status === "cancelled") {
        cancelled++;
      }
    });

    return {
      totalRiders: riders,
      totalCancelled: cancelled,
      totalBoarded: boarded,
      stationCounts: Object.entries(counts).map(([name, count]) => ({
        name,
        count,
      })),
    };
  }, [getAllStudentsStatus, users, stations]);

  const getVehicleSuggestion = (count: number) => {
    if (count <= 14)
      return {
        text: "ميكروباص",
        icon: Car,
        capacity: 14,
        color: "text-blue-500",
        bg: "bg-blue-100 dark:bg-blue-900/30",
      };
    if (count <= 33)
      return {
        text: "ميني باص",
        icon: BusFront,
        capacity: 33,
        color: "text-purple-500",
        bg: "bg-purple-100 dark:bg-purple-900/30",
      };
    return {
      text: "أتوبيس كبير",
      icon: Bus,
      capacity: 50,
      color: "text-green-500",
      bg: "bg-green-100 dark:bg-green-900/30",
    };
  };

  const suggestion = getVehicleSuggestion(totalRiders);
  const occupancyRate = Math.round((totalRiders / suggestion.capacity) * 100) || 0;

  return (
    <div className="space-y-6 pt-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الرئيسية</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">نظرة عامة على رحلات اليوم</p>
      </div>

      {/* Active Trip Status */}
      <Card className="bg-primary text-primary-foreground border-none shadow-elevated">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Bus className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">حالة الرحلة اليوم</h2>
              <p className="text-primary-foreground/90 text-[13px] mt-1">
                {tripStatus === "not_started" &&
                  "الرحلة لم تبدأ بعد. يمكنك بدء الرحلة من إدارة الرحلات."}
                {tripStatus === "moving" && "الباص يتحرك الآن في مساره."}
                {tripStatus === "waiting_at_station" &&
                  "الباص متوقف في النقطة الحالية، في انتظار ركوب الطلاب."}
                {tripStatus === "completed" && "اكتملت رحلة اليوم بنجاح وتم الوصول لكرياتيفا."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button asChild size="lg" className="h-14 text-base rounded-[16px] shadow-sm">
          <Link to="/admin/trips">
            <Navigation className="w-5 h-5 ml-2" />
            إدارة الرحلة
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-14 text-base rounded-[16px] shadow-sm bg-white hover:bg-gray-50 border-gray-200"
        >
          <Link to="/admin/stations">
            <MapPin className="w-5 h-5 ml-2 text-primary" />
            إدارة النقاط
          </Link>
        </Button>
      </div>

      <StatsCards
        totalRiders={totalRiders}
        totalCancelled={totalCancelled}
        totalBoarded={totalBoarded}
        occupancyRate={occupancyRate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>توزيع الطلاب على نقاط التجمع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 md:h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stationCounts}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Suggestion */}
        <Card>
          <CardHeader>
            <CardTitle>المركبة المقترحة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center ${suggestion.bg} ${suggestion.color}`}
              >
                <suggestion.icon className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">{suggestion.text}</h3>
                <p className="text-gray-500 mt-1">العدد المطلوب: {totalRiders} طالب</p>
                <p className="text-sm text-gray-400 mt-1">سعة المركبة: {suggestion.capacity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
