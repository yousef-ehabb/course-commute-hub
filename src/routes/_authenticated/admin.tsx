import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { STATIONS, VEHICLE_LIMITS, VEHICLE_LABEL, suggestVehicle } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bus, CheckCircle2, Circle, Users, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "لوحة الأدمن — راكب" },
      { name: "description", content: "إدارة الطلاب والمحطات والرحلات." },
    ],
  }),
});

type Passenger = {
  uid: string;
  fullName: string;
  phone: string;
  station: string;
  status: "riding" | "cancelled";
  boarded?: boolean;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AdminPage() {
  const { profile, user } = useAuth();
  const [rows, setRows] = useState<Passenger[]>([]);
  const [search, setSearch] = useState("");
  const [stationFilter, setStationFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const path = `rakeb/dailyStatus/default/${todayKey()}`;
      unsub = onValue(ref(getFirebaseDb(), path), (snap) => {
        const v = (snap.val() ?? {}) as Record<
          string,
          { status: "riding" | "cancelled"; station: string; fullName?: string; phone?: string; boarded?: boolean }
        >;
        setRows(
          Object.entries(v).map(([uid, r]) => ({
            uid,
            fullName: r.fullName ?? "—",
            phone: r.phone ?? "",
            station: r.station,
            status: r.status,
            boarded: r.boarded,
          })),
        );
      });
    })();
    return () => unsub?.();
  }, [user]);

  const riding = rows.filter((r) => r.status === "riding");
  const cancelled = rows.filter((r) => r.status === "cancelled");
  const boarded = riding.filter((r) => r.boarded).length;

  const perStation = useMemo(
    () =>
      STATIONS.map((s) => ({
        name: s.name,
        count: riding.filter((r) => r.station === s.id).length,
      })),
    [riding],
  );

  const filtered = rows.filter((r) => {
    if (stationFilter !== "all" && r.station !== stationFilter) return false;
    if (search && !`${r.fullName} ${r.phone}`.includes(search)) return false;
    return true;
  });

  async function toggleBoarded(uid: string, current: boolean) {
    const { getFirebaseDb } = await import("@/lib/firebase");
    const { ref, update } = await import("firebase/database");
    await update(ref(getFirebaseDb(), `rakeb/dailyStatus/default/${todayKey()}/${uid}`), {
      boarded: !current,
    });
  }

  if (profile && profile.role !== "admin") {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          هذه الصفحة للأدمن فقط. اطلب من مسؤول النظام ترقية حسابك.
        </CardContent>
      </Card>
    );
  }

  const suggested = suggestVehicle(riding.length);

  return (
    <Tabs defaultValue="dashboard">
      <TabsList>
        <TabsTrigger value="dashboard">الرئيسية</TabsTrigger>
        <TabsTrigger value="students">الطلاب</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Users} label="راكبين" value={riding.length} tone="primary" />
          <StatCard icon={XCircle} label="ملغي" value={cancelled.length} tone="muted" />
          <StatCard icon={CheckCircle2} label="صعدوا" value={boarded} tone="accent" />
          <StatCard icon={Bus} label={`اقتراح: ${VEHICLE_LABEL[suggested]}`} value={`≤ ${VEHICLE_LIMITS[suggested]}`} tone="primary" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الطلاب لكل محطة</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perStation}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="students" className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="بحث بالاسم أو الموبايل"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="rounded-md border bg-background px-3 text-sm"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
          >
            <option value="all">كل المحطات</option>
            {STATIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الموبايل</TableHead>
                  <TableHead>المحطة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>صعد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      لا يوجد بيانات
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.uid}>
                      <TableCell>{r.fullName}</TableCell>
                      <TableCell dir="ltr">{r.phone}</TableCell>
                      <TableCell>{STATIONS.find((s) => s.id === r.station)?.name ?? r.station}</TableCell>
                      <TableCell>
                        {r.status === "riding" ? (
                          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">راكب</span>
                        ) : (
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">ملغي</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleBoarded(r.uid, Boolean(r.boarded))}
                          className="text-primary"
                          disabled={r.status !== "riding"}
                        >
                          {r.boarded ? (
                            <CheckCircle2 className="h-5 w-5 text-accent" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone: "primary" | "accent" | "muted";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "accent"
        ? "bg-accent/15 text-accent"
        : "bg-muted text-muted-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-extrabold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}