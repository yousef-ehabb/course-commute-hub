import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStations } from "@/contexts/StationsContext";
import { useTodayStatus } from "@/hooks/useTodayStatus";
import { useTripStatus } from "@/hooks/useTripStatus";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { RideSwitch } from "@/components/student/RideSwitch";
import { CountdownTimer } from "@/components/student/CountdownTimer";
import { StationPicker } from "@/components/student/StationPicker";
import { TripStatusBanner } from "@/components/student/TripStatusBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";

export const Route = createLazyFileRoute("/_authenticated/student/home")({
  component: StudentHome,
});

function StudentHome() {
  const { user, profile } = useAuth();
  const {
    stations,
    loading: stationsLoading,
    error: stationsError,
    retry: retryStations,
  } = useStations();
  const {
    records,
    loaded: statusLoaded,
    error: statusError,
    retry: retryStatus,
  } = useTodayStatus();

  const error = stationsError || statusError;
  const handleRetry = () => {
    retryStations();
    retryStatus();
  };
  const {
    activeDateKey,
    cutoffTime,
    cutoffEnabled,
    loaded: dateLoaded,
    getServerTime,
  } = useActiveDate();
  const defaultStationId = profile?.defaultStation ?? stations[0]?.id;

  const [riding, setRiding] = useState(true);
  const [station, setStation] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingStation, setPendingStation] = useState<string | null>(null);

  const loaded = statusLoaded && dateLoaded;

  const isStationInvalid =
    !!station && station !== "custom" && !stations.find((s) => s.id === station);

  useEffect(() => {
    if (stations.length > 0 && !station && profile?.defaultStation) {
      setStation(profile.defaultStation);
    }
  }, [stations, profile, station]);

  const { status: tripStatus } = useTripStatus();

  useEffect(() => {
    if (!user) return;

    const myRecord = records.find((r) => r.id === user.uid);
    if (myRecord) {
      setRiding(myRecord.status === "riding");
      if (myRecord.station) setStation(myRecord.station);
    } else {
      setRiding(true);
    }
  }, [user, records]);

  useEffect(() => {
    if (!cutoffEnabled || !activeDateKey || !cutoffTime) {
      setIsClosed(false);
      return;
    }
    const [year, month, day] = activeDateKey.split("-").map(Number);
    const [cutoffHours, cutoffMinutes] = cutoffTime.split(":").map(Number);

    const cutoff = new Date(year, month - 1, day);
    cutoff.setDate(cutoff.getDate() - 1);
    cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);

    setIsClosed(getServerTime() > cutoff.getTime());
  }, [cutoffEnabled, activeDateKey, cutoffTime]);

  async function updateDefaultStation(newStation: string) {
    if (!user || newStation === "custom") return;

    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, update } = await import("firebase/database");
      await update(ref(getFirebaseDb(), `rakeb/users/${user.uid}`), {
        defaultStation: newStation,
      });
      toast.success("تم تحديث نقطة التجمع الافتراضية بنجاح");
    } catch (e) {
      console.error("Failed to update default station:", e);
      toast.error("فشل في تحديث نقطة التجمع الافتراضية");
    }
  }

  const handleStationChoice = async (type: "temporary" | "permanent") => {
    if (!pendingStation) return;
    setDrawerOpen(false);
    setStation(pendingStation);

    if (type === "permanent") {
      await updateDefaultStation(pendingStation);
    }

    if (riding) {
      updateStatus(true, pendingStation);
    }
    setPendingStation(null);
  };

  async function updateStatus(newRiding: boolean, newStation: string) {
    if (!user || !newStation) return;
    setBusy(true);

    const saveToFirebase = async (customLoc?: { lat: number; lng: number }) => {
      try {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, set, remove } = await import("firebase/database");
        const path = `rakeb/dailyStatus/default/${activeDateKey}/${user.uid}`;

        if (newRiding && newStation === defaultStationId) {
          await remove(ref(getFirebaseDb(), path));
        } else {
          const data: any = {
            status: newRiding ? "riding" : "cancelled",
            station: newStation,
            updatedAt: getServerTime(),
            fullName: profile?.fullName ?? "",
            phone: profile?.phone ?? "",
          };
          if (customLoc) {
            data.customLocation = customLoc;
          }
          await set(ref(getFirebaseDb(), path), data);
        }
        toast.success(newRiding ? "تم تأكيد الحضور بنجاح" : "تم إلغاء تأكيد الحضور لليوم");
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setBusy(false);
      }
    };

    if (newStation === "custom" && newRiding) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            saveToFirebase({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            toast.error("فشل في تحديد موقعك الجغرافي. يرجى تفعيل إذن الموقع.");
            setBusy(false);
          },
          { enableHighAccuracy: true },
        );
      } else {
        toast.error("متصفحك لا يدعم تحديد الموقع الجغرافي.");
        setBusy(false);
      }
    } else {
      await saveToFirebase();
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 px-4 text-center">
        <p className="text-red-500 font-medium">
          تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.
        </p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (stationsLoading || !loaded) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Greeting — subtle, de-emphasized */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          أهلاً {profile?.fullName?.split(" ")[0]} 👋
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">إدارة رحلتك اليوم</p>
      </div>

      {/* 2. HERO — Ride Status (largest, most prominent) */}
      {(isStationInvalid || (!station && riding)) && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-xl flex items-start gap-3 text-sm font-medium">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            {isStationInvalid
              ? "نقطة التجمع السابقة الخاصة بك لم تعد متاحة. يرجى اختيار نقطة تجمع افتراضية جديدة."
              : "يرجى اختيار نقطة تجمع لتأكيد الحضور."}
          </p>
        </div>
      )}

      <RideSwitch
        status={riding ? "riding" : "cancelled"}
        onChange={(checked) => {
          setRiding(checked);
          updateStatus(checked, station);
        }}
        disabled={busy || !loaded || !station || isClosed || isStationInvalid}
      />

      {/* 3. Countdown — compact inline */}
      {cutoffEnabled && (
        <CountdownTimer
          cutoffTime={cutoffTime}
          activeDateKey={activeDateKey}
          getServerTime={getServerTime}
          onExpire={() => setIsClosed(true)}
        />
      )}

      {/* 4. Station picker — tertiary */}
      {riding && (
        <StationPicker
          currentStationId={station}
          stations={stations}
          onChange={async (newStation) => {
            const isDefaultInvalid =
              !profile?.defaultStation || !stations.find((s) => s.id === profile.defaultStation);

            if (newStation === "custom") {
              setStation(newStation);
              if (riding) updateStatus(true, newStation);
            } else if (isDefaultInvalid) {
              setStation(newStation);
              await updateDefaultStation(newStation);
              if (riding) updateStatus(true, newStation);
            } else if (newStation !== profile.defaultStation) {
              setPendingStation(newStation);
              setDrawerOpen(true);
            } else {
              setStation(newStation);
              if (riding) updateStatus(true, newStation);
            }
          }}
          disabled={busy || !loaded || isClosed}
        />
      )}

      {/* 5. Trip status — context info */}
      <TripStatusBanner status={tripStatus} />

      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} direction="bottom">
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" />
          <Drawer.Content className="bg-background flex flex-col rounded-t-3xl mt-24 fixed bottom-0 left-0 right-0 z-50 max-h-[85vh]">
            <div className="p-5 bg-card rounded-t-3xl flex-1">
              <div className="mx-auto w-10 h-1 flex-shrink-0 rounded-full bg-muted mb-6" />
              <div className="max-w-md mx-auto text-right">
                <Drawer.Title className="font-bold text-lg mb-1">
                  لقد اخترت نقطة تجمع مختلفة.
                </Drawer.Title>
                <Drawer.Description className="text-[13px] text-muted-foreground mb-5">
                  كيف تود استخدام هذه النقطة؟
                </Drawer.Description>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-right h-auto py-3 px-4"
                    onClick={() => handleStationChoice("temporary")}
                  >
                    <div className="flex flex-col items-start w-full">
                      <span className="font-semibold text-foreground">استخدام لليوم فقط</span>
                      <span className="text-sm text-muted-foreground font-normal mt-1">
                        ستبقى نقطة التجمع الافتراضية كما هي دون تغيير.
                      </span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-right h-auto py-3 px-4"
                    onClick={() => handleStationChoice("permanent")}
                  >
                    <div className="flex flex-col items-start w-full">
                      <span className="font-semibold text-foreground">
                        تعيين كنقطة تجمع افتراضية
                      </span>
                      <span className="text-sm text-muted-foreground font-normal mt-1">
                        سيتم استخدام هذه النقطة لجميع الأيام القادمة.
                      </span>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
