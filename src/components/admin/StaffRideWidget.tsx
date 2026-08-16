import { useState, useEffect } from "react";
import { Bus, Check, X, HelpCircle, AlertTriangle, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCourse } from "@/contexts/CourseContext";
import { useStations } from "@/contexts/StationsContext";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { useTodayStatus } from "@/hooks/useTodayStatus";
import { useBoardingRecords } from "@/hooks/useBoardingRecords";
import { useVehicles } from "@/hooks/useVehicles";
import { getVehicleLabelById } from "@/utils/vehicleLabels";
import { getStationName } from "@/utils/stationResolver";
import { StationPicker } from "@/components/student/StationPicker";
import { Button } from "@/components/ui/button";

export function StaffRideWidget() {
  const { user, profile } = useAuth();
  const { courseId } = useCourse();
  const { stations } = useStations();
  const { records } = useTodayStatus();
  const { recordsByStudent } = useBoardingRecords();
  const { vehicles } = useVehicles();
  const { activeDateKey, cutoffTime, cutoffEnabled, forceLock, getServerTime, loaded: dateLoaded } =
    useActiveDate();

  const [busy, setBusy] = useState(false);
  const [station, setStation] = useState<string>("");
  const [isClosed, setIsClosed] = useState(false);
  const [showPickerForNewRide, setShowPickerForNewRide] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Find my current daily record
  const myRecord = records.find((r) => r.id === user?.uid);
  const myBoarding = user?.uid ? recordsByStudent[user.uid] : undefined;
  const isBoarded = myBoarding?.status === "boarded" || Boolean(myRecord?.boarded);
  const boardedVehicleLabel =
    isBoarded && myBoarding?.vehicleId ? getVehicleLabelById(myBoarding.vehicleId, vehicles) : undefined;

  // Determine current status: "riding" | "cancelled" | "undecided"
  const currentStatus: "riding" | "cancelled" | "undecided" = myRecord
    ? myRecord.status === "riding"
      ? "riding"
      : myRecord.status === "cancelled"
        ? "cancelled"
        : "undecided"
    : "undecided";

  // Sync initial station from record or profile, but ensure it's valid
  useEffect(() => {
    const isValidStation = (id: string) => id === "custom" || stations.some((s) => s.id === id);

    if (myRecord?.station && isValidStation(myRecord.station)) {
      setStation(myRecord.station);
    } else if (profile?.defaultStation && isValidStation(profile.defaultStation)) {
      setStation(profile.defaultStation);
    } else {
      setStation(""); // Invalid/deleted station, force them to pick!
    }
  }, [myRecord, profile, stations]);

  // Check cutoff time
  useEffect(() => {
    if (forceLock) {
      setIsClosed(true);
      return;
    }
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
  }, [cutoffEnabled, activeDateKey, cutoffTime, forceLock, getServerTime]);

  const handleStatusChange = async (
    newStatus: "riding" | "cancelled" | "undecided",
    targetStation?: string,
    customLoc?: { lat: number; lng: number; name: string },
  ) => {
    if (!user || !activeDateKey) return;
    if (isClosed && !isBoarded) {
      toast.error("انتهى وقت تعديل حجز الباص للنهارده.");
      return;
    }
    if (isBoarded && newStatus !== "riding") {
      toast.error("تم تسجيل صعودك للباص بالفعل، ماينفعش تلغي غير من عند المشرف.");
      return;
    }

    const effectiveStation = targetStation || station;
    if (newStatus === "riding" && !effectiveStation) {
      // Don't auto-confirm if no valid station is selected yet
      setShowPickerForNewRide(true);
      return;
    }

    setBusy(true);
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, set, remove } = await import("firebase/database");
      const path = `rakeb/dailyStatus/${courseId}/${activeDateKey}/${user.uid}`;

      if (newStatus === "undecided") {
        // Remove or set undecided
        await remove(ref(getFirebaseDb(), path));
        toast.info("تم التغيير لـ «لسه ماقررتش»");
        setShowPickerForNewRide(false);
      } else {
        const updatePayload: Record<string, any> = {
          status: newStatus,
          station: effectiveStation,
          fullName: profile?.fullName || user.displayName || user.email?.split("@")[0] || "موظف",
          phone: profile?.phone || "",
          isStaff: true,
          updatedAt: getServerTime(),
        };

        if (effectiveStation === "custom" && (customLoc || profile?.customLocation)) {
          updatePayload.customLocation = customLoc || profile?.customLocation;
        }

        await set(ref(getFirebaseDb(), path), updatePayload);
        if (newStatus === "riding") {
          toast.success("تمام، سجلناك معانا ✓");
        } else {
          toast.info("سجلنا إنك مش هتركب النهارده.");
        }
      }
      setIsEditing(false);
    } catch (e: any) {
      console.error("[StaffRideWidget] Update status failed:", e);
      toast.error(e?.message || "حصلت مشكلة أثناء تحديث حالتك");
    } finally {
      setBusy(false);
    }
  };

  const handleStationChange = async (
    newStation: string,
    customLoc?: { lat: number; lng: number; name: string },
  ) => {
    setStation(newStation);
    if (currentStatus === "riding" || showPickerForNewRide) {
      setShowPickerForNewRide(false);
      await handleStatusChange("riding", newStation, customLoc);
    }
  };

  const currentStationName = getStationName(
    station,
    stations,
    myRecord?.customLocation?.name || profile?.customLocation?.name,
  );

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-5 shadow-card border border-border/80 relative overflow-hidden">
      {/* Top Banner Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${currentStatus !== "undecided" && !isEditing && currentStatus !== "riding" ? "" : "pb-3 border-b border-border/40"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">هتركب معانا النهارده؟</h3>
              <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                موظف / مدرب
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isBoarded ? (
            <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ركبت خلاص {boardedVehicleLabel ? `• ${boardedVehicleLabel}` : ""}
            </span>
          ) : currentStatus === "riding" ? (
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              أيوه، هركب
            </span>
          ) : currentStatus === "cancelled" ? (
            <span className="bg-destructive/10 text-destructive font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1">
              <X className="w-3.5 h-3.5" />
              لأ، مش هركب
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground font-semibold text-xs px-3 py-1 rounded-full flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              لسه ماقررتش
            </span>
          )}

            {currentStatus !== "undecided" && !isBoarded && !isClosed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 text-xs px-2 ml-1 text-muted-foreground hover:text-foreground"
              >
                {isEditing ? "إلغاء" : "تعديل"}
              </Button>
            )}
          </div>
        </div>

        {/* Decision Buttons (3-state) */}
        {(currentStatus === "undecided" || isEditing || showPickerForNewRide) && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {/* 1. Riding */}
              <Button
                type="button"
                variant={currentStatus === "riding" ? "default" : "outline"}
                size="sm"
                disabled={busy || (isClosed && !isBoarded)}
                onClick={() => handleStatusChange("riding")}
                className={`h-11 rounded-xl text-xs sm:text-sm font-bold gap-1.5 transition-all ${currentStatus === "riding"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 hover:border-emerald-300"
                  }`}
              >
                {busy && currentStatus === "riding" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>أيوه، هركب</span>
              </Button>

              {/* 2. Cancelled */}
              <Button
                type="button"
                variant={currentStatus === "cancelled" ? "default" : "outline"}
                size="sm"
                disabled={busy || isBoarded || isClosed}
                onClick={() => handleStatusChange("cancelled")}
                className={`h-11 rounded-xl text-xs sm:text-sm font-bold gap-1.5 transition-all ${currentStatus === "cancelled"
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
                    : "hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                  }`}
              >
                {busy && currentStatus === "cancelled" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                <span>لأ، مش هركب</span>
              </Button>

              {/* 3. Undecided */}
              <Button
                type="button"
                variant={currentStatus === "undecided" ? "secondary" : "outline"}
                size="sm"
                disabled={busy || isBoarded || isClosed}
                onClick={() => handleStatusChange("undecided")}
                className={`h-11 rounded-xl text-xs sm:text-sm font-bold gap-1.5 transition-all ${currentStatus === "undecided" ? "bg-muted font-bold text-foreground" : "text-muted-foreground"
                  }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>لسه ماقررتش</span>
              </Button>
            </div>
          </div>
        )}

        {/* Station Picker (Visible when Riding is selected, or when they need to pick before riding) */}
        {(currentStatus === "riding" || showPickerForNewRide) && (
          <div className={`space-y-2.5 ${currentStatus !== "undecided" && !isEditing ? "pt-3" : "pt-2"}`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
              <span>هتركب منين؟</span>
              <span className="text-foreground font-bold">{currentStationName}</span>
            </div>

            <StationPicker
              currentStationId={station}
              customLocationName={myRecord?.customLocation?.name || profile?.customLocation?.name}
              customLocationCoords={
                myRecord?.customLocation || profile?.customLocation
                  ? {
                    lat: (myRecord?.customLocation || profile?.customLocation)!.lat,
                    lng: (myRecord?.customLocation || profile?.customLocation)!.lng,
                  }
                  : null
              }
              stations={stations}
              onChange={handleStationChange}
              disabled={busy || isClosed}
            />

            {/* Confirmation Note */}
            {currentStatus === "riding" && !showPickerForNewRide && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  تمام، سجلناك معانا في محطة <strong>«{currentStationName}»</strong>.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Lock note if cutoff passed */}
        {isClosed && (
          <div className={`bg-muted/60 text-muted-foreground p-2 rounded-xl text-xs flex items-center justify-center gap-1.5 ${currentStatus !== "undecided" && !isEditing ? "mt-3" : "mt-2"}`}>
            <Lock className="w-3.5 h-3.5" />
            <span>انتهى وقت تعديل حجز الباص للنهارده</span>
          </div>
        )}
      </div>
      );
}
