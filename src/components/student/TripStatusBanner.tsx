import { Bus, MapPin, CheckCircle2, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Vehicle, BoardingRecord } from "@/types";
import { getVehicleLabel, getVehicleCountText } from "@/utils/vehicleLabels";

interface TripStatusBannerProps {
  status: "pending" | "waiting_at_station" | "moving" | "completed";
  licensePlate?: string | null;
  vehicles?: Vehicle[];
  boardingRecord?: BoardingRecord | null;
}

export function TripStatusBanner({
  status,
  licensePlate,
  vehicles = [],
  boardingRecord,
}: TripStatusBannerProps) {
  const activeVehicles = vehicles.filter(
    (v) => v.status === "running" || v.status === "full"
  );
  const availableVehicles = activeVehicles.filter(
    (v) => v.status === "running" && v.occupiedSeats < v.capacity
  );
  const plannedVehicles = vehicles.filter((v) => v.status === "planned");

  const isBoarded = boardingRecord?.status === "boarded";
  const myVehicle = isBoarded
    ? vehicles.find((v) => v.id === boardingRecord?.vehicleId)
    : null;

  // ── Boarded state — student is on a vehicle ─────────────────────────
  if (isBoarded && myVehicle) {
    const vehicleLabel = getVehicleLabel(myVehicle, vehicles);

    if (myVehicle.status === "ended") {
      return (
        <div className="rounded-2xl bg-emerald-500/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-400">
              وصلنا بالسلامة! 🎉
            </h3>
            <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/60">
              اكتملت رحلة اليوم
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
            <Bus className="w-5 h-5 animate-pulse" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold text-primary">
              أنت دلوقتي داخل {vehicleLabel}
            </h3>
            <p className="text-[12px] text-primary/70 mt-0.5">
              تم تسجيل حضورك. تابع الرحلة من هنا.
            </p>
          </div>
        </div>
        <Link
          to="/student/track"
          className="w-full h-11 bg-primary text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.97]"
        >
          <MapPin className="w-4 h-4" strokeWidth={1.8} />
          تتبع الرحلة
        </Link>
      </div>
    );
  }

  // ── Pending — trip hasn't started ───────────────────────────────────
  if (status === "pending") {
    // Show planned vehicle count if available
    const totalPlanned = plannedVehicles.length + activeVehicles.length;
    return (
      <div className="rounded-2xl bg-card shadow-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          <Clock className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">حالة النقل</h3>
          <p className="text-[12px] text-muted-foreground">
            {totalPlanned > 0
              ? `تم تجهيز ${getVehicleCountText(totalPlanned)} لنقل المتدربين النهارده. لسه التحرك مبدأش.`
              : "لسه التحرك مبدأش."}
          </p>
        </div>
      </div>
    );
  }

  // ── Moving — vehicles are on the road, student not boarded ──────────
  if (status === "moving") {
    return (
      <div className="rounded-2xl bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
            <Bus className="w-5 h-5 animate-pulse" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold text-primary">
              العربية جاية في الطريق
            </h3>
            <p className="text-[12px] text-primary/70 mt-0.5">
              {availableVehicles.length > 0
                ? `فيه ${getVehicleCountText(availableVehicles.length)} شغالين. كون مستعد!`
                : "العربيات في الطريق. تابع من هنا."}
            </p>
          </div>
        </div>
        <Link
          to="/student/track"
          className="w-full h-11 bg-primary text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.97]"
        >
          <MapPin className="w-4 h-4" strokeWidth={1.8} />
          تتبع العربية
        </Link>
      </div>
    );
  }

  // ── Waiting at Station ─────────────────────────────────────────────
  if (status === "waiting_at_station") {
    return (
      <div className="rounded-2xl bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary animate-pulse">
            <MapPin className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold text-primary">
              العربية واصلة نقطة التجمع
            </h3>
            <p className="text-[12px] text-primary/70 mt-0.5">
              بيتم تسجيل صعود المتدربين دلوقتي
            </p>
          </div>
        </div>
        <Link
          to="/student/track"
          className="w-full h-11 bg-primary text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.97]"
        >
          <MapPin className="w-4 h-4" strokeWidth={1.8} />
          تتبع العربية
        </Link>
      </div>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl bg-emerald-500/5 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
        <CheckCircle2 className="w-5 h-5" strokeWidth={1.8} />
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-400">
          اكتملت رحلة اليوم
        </h3>
        <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/60">
          كل المركبات وصلت. نشوفكم بكرة إن شاء الله!
        </p>
      </div>
    </div>
  );
}
