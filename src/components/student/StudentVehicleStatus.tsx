import { Bus, CheckCircle2, Clock, Navigation, Check } from "lucide-react";
import type { Vehicle, BoardingRecord } from "@/types";
import { getVehicleLabel } from "@/utils/vehicleLabels";
import type { TripStatusType } from "@/hooks/useTripStatus";

interface StudentVehicleStatusProps {
  tripStatus: TripStatusType;
  vehicle: Vehicle | null;
  boardingRecord: BoardingRecord | null;
  /** Pass the full list of vehicles only for accurate label generation (ordinals) */
  allVehicles: Vehicle[];
}

/**
 * Compact, collapsed status banner for mobile-first tracking screens.
 * High-density layout displaying vehicle status in a single clean line.
 */
export function StudentVehicleStatus({
  tripStatus,
  vehicle,
  boardingRecord,
  allVehicles,
}: StudentVehicleStatusProps) {
  const isBoarded = boardingRecord?.status === "boarded";
  const vehicleLabel = vehicle ? getVehicleLabel(vehicle, allVehicles) : "المركبة";

  // ── No vehicles yet ──────────────────────────────────────────────────
  if (!vehicle) {
    if (tripStatus === "completed") {
      return (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2} />
          <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
            اكتملت رحلة اليوم — كل المركبات وصلت بالسلامة.
          </span>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-card border border-border/60 px-3.5 py-2.5 flex items-center gap-2.5 shadow-2xs">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={2} />
        <span className="text-[13px] font-medium text-muted-foreground">
          التحرك مبدأش لسه — هنبلغك أول ما العربية تتحرك.
        </span>
      </div>
    );
  }

  // ── Completed (ended) Vehicle ───────────────────────────────────────
  if (vehicle.status === "ended") {
    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 flex items-center gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2} />
        <div className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 flex-wrap">
          <span>{vehicleLabel}:</span>
          <span className="font-normal opacity-90">وصل الوجهة الأخيرة بالسلامة 🎉</span>
        </div>
      </div>
    );
  }

  // ── After Boarding ──────────────────────────────────────────────────
  if (isBoarded && boardingRecord?.vehicleId === vehicle.id) {
    if (vehicle.nextStationId === "creativa") {
      return (
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 flex items-center gap-2.5">
          <Navigation className="w-4 h-4 text-primary animate-pulse shrink-0" strokeWidth={2} />
          <div className="text-[13px] font-bold text-primary flex items-center gap-1.5 flex-wrap">
            <span>أنت داخل {vehicleLabel}:</span>
            <span className="font-normal text-primary/80">في الطريق إلى كرياتيفا 🏁</span>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 flex items-center gap-2.5">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.5} />
        <div className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 flex-wrap">
          <span>تم الحضور:</span>
          <span className="font-normal text-emerald-600/90 dark:text-emerald-300/80">
            أنت داخل {vehicleLabel} حاليًا.
          </span>
        </div>
      </div>
    );
  }

  // ── Before Boarding / Vehicle Active ────────────────────────────────

  // Waiting at a station
  if (vehicle.currentStationId) {
    return (
      <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 flex items-center gap-2.5">
        <Navigation className="w-4 h-4 text-primary animate-pulse shrink-0" strokeWidth={2} />
        <div className="text-[13px] font-bold text-primary flex items-center gap-1.5 flex-wrap">
          <span>{vehicleLabel}:</span>
          <span className="font-normal text-primary/80">واصل نقطة التجمع • في انتظار المتدربين</span>
        </div>
      </div>
    );
  }

  // Normal running state
  return (
    <div className="rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 flex items-center gap-2.5">
      <Bus className="w-4 h-4 text-primary animate-pulse shrink-0" strokeWidth={2} />
      <div className="text-[13px] font-bold text-primary flex items-center gap-1.5 flex-wrap">
        <span>{vehicleLabel}:</span>
        <span className="font-normal text-primary/80">في الطريق بين المحطات</span>
      </div>
    </div>
  );
}
