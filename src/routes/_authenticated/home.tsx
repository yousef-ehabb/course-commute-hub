import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { STATIONS, DEFAULT_CUTOFF_TIME } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "الرئيسية — راكب" },
      { name: "description", content: "فعّل ركوبك اليوم واختر نقطة الركوب." },
    ],
  }),
});

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function useCountdown(cutoff: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = useMemo(() => {
    const [h, m] = cutoff.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }, [cutoff]);
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: diff === 0 };
}

function HomePage() {
  const { user, profile } = useAuth();
  const [riding, setRiding] = useState(false);
  const [station, setStation] = useState<string>(profile?.defaultStation ?? STATIONS[0].id);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { text: countdown, expired } = useCountdown(DEFAULT_CUTOFF_TIME);

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const path = `rakeb/dailyStatus/default/${todayKey()}/${user.uid}`;
      unsub = onValue(ref(getFirebaseDb(), path), (snap) => {
        const v = snap.val();
        if (v) {
          setRiding(v.status === "riding");
          if (v.station) setStation(v.station);
        }
        setLoaded(true);
      });
    })();
    return () => unsub?.();
  }, [user]);

  async function updateStatus(newRiding: boolean, newStation: string) {
    if (!user) return;
    if (expired) return toast.error("انتهى وقت التسجيل لليوم");
    setBusy(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, set } = await import("firebase/database");
      const path = `rakeb/dailyStatus/default/${todayKey()}/${user.uid}`;
      await set(ref(getFirebaseDb(), path), {
        status: newRiding ? "riding" : "cancelled",
        station: newStation,
        updatedAt: Date.now(),
        fullName: profile?.fullName ?? "",
        phone: profile?.phone ?? "",
      });
      toast.success(newRiding ? "تم تفعيل ركوبك" : "تم إلغاء ركوبك");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stationInfo = STATIONS.find((s) => s.id === station);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>ركوب اليوم</span>
            <Switch
              checked={riding}
              disabled={busy || !loaded || expired}
              onCheckedChange={(v) => {
                setRiding(v);
                void updateStatus(v, station);
              }}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`rounded-xl p-4 text-center font-bold ${riding ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
            {riding ? "الأوتوبيس مفعّل — استنى في محطتك" : "الأوتوبيس مش مفعّل ليك اليوم"}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{expired ? "انتهى التسجيل" : `يغلق التسجيل بعد ${countdown}`}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            نقطة الركوب اليوم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={station}
            onValueChange={(v) => {
              setStation(v);
              if (riding) void updateStatus(true, v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} — {s.time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {stationInfo?.detail && (
            <p className="text-sm text-muted-foreground">{stationInfo.detail}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">حالة الأوتوبيس</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            هيظهر هنا مكان الأوتوبيس مباشرة لما الأدمن يبدأ الرحلة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}