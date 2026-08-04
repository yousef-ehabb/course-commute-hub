import { Bus, MapPin, Play, Square, UserMinus, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/LongPressButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { Vehicle } from "@/types";

interface VehicleControlsProps {
  vehicle: Vehicle;
  onTakeControl: (licensePlate: string) => void;
  onReleaseControl: () => void;
  onDepartStation?: () => void;
  onEndVehicle?: () => void;
  isLocationEnabled: boolean;
  canTakeControl: boolean;
  endVehicleLoading?: boolean;
  endVehicleDisabled?: boolean;
}

export function VehicleControls({
  vehicle,
  onTakeControl,
  onReleaseControl,
  onDepartStation,
  onEndVehicle,
  isLocationEnabled,
  canTakeControl,
  endVehicleLoading,
  endVehicleDisabled,
}: VehicleControlsProps) {
  const [licensePlate, setLicensePlate] = useState(vehicle.licensePlate || "");

  const occupancyPercentage =
    vehicle.capacity > 0 ? Math.round((vehicle.occupiedSeats / vehicle.capacity) * 100) : 0;

  const status = vehicle.status;

  let statusChip = null;
  if (status === "planned") {
    statusChip = (
      <span className="bg-secondary/10 text-secondary-foreground px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        في الانتظار
      </span>
    );
  } else if (status === "running") {
    if (vehicle.currentStationId) {
      statusChip = (
        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span> صعود الركاب
        </span>
      );
    } else {
      statusChip = (
        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> في الطريق
        </span>
      );
    }
  } else if (status === "full") {
    statusChip = (
      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        ممتلئ
      </span>
    );
  } else if (status === "ended") {
    statusChip = (
      <span className="bg-success/10 text-success px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3" /> مكتملة
      </span>
    );
  }

  return (
    <article className="bg-card shadow-card rounded-2xl p-4 flex flex-col gap-4 border border-border">
      {/* Header & Status */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">
            إدارة {vehicle.type === "bus" ? "الأتوبيس" : "الميكروباص"}
          </h2>
          <p className="text-[12px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {isLocationEnabled ? "GPS مفعل" : "GPS غير مفعل"}
          </p>
        </div>
        {statusChip}
      </div>

      {/* Metrics Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 bg-muted/30 rounded-xl px-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              الحالة
            </p>
            <p className="text-sm font-bold text-foreground">
              {status === "planned"
                ? "لم تبدأ"
                : status === "running"
                  ? (vehicle.currentStationId ? "بالنقطة" : "جارية")
                  : status === "full"
                    ? "ممتلئة"
                    : "اكتملت"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-r border-border/50 pt-2.5 sm:pt-0 sm:pr-4 sm:mr-4">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              الحضور
            </p>
            <p className="text-sm font-bold text-foreground">
              {vehicle.occupiedSeats} / {vehicle.capacity}{" "}
              <span className="text-muted-foreground font-normal text-xs">
                ({occupancyPercentage}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-1">
        {status === "planned" && (
          <div className="space-y-3 mb-2">
            <div className="space-y-1">
              <Label htmlFor="licensePlate" className="text-sm">رقم لوحة المركبة (اختياري)</Label>
              <Input
                id="licensePlate"
                placeholder="أدخل رقم اللوحة (مثال: أ ب ج 123)"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {status === "planned" && (
            <Button
              size="lg"
              className="flex-1 h-12 rounded-xl text-base gap-2 font-bold shadow-md active:scale-95 transition-transform"
              onClick={() => onTakeControl(licensePlate.trim())}
              disabled={!canTakeControl}
            >
              <Play className="w-5 h-5 fill-current" />
              {canTakeControl ? "استلام المركبة" : "يرجى تسليم مركبتك الحالية أولاً"}
            </Button>
          )}

          {(status === "running" || status === "full") && (
            <>
              {onDepartStation && (
                <LongPressButton
                  size="lg"
                  className="flex-1 h-12 rounded-xl text-base gap-2 font-bold shadow-md"
                  onComplete={onDepartStation}
                >
                  <Play className="w-5 h-5 fill-current" />
                  تحرك (اضغط مطولاً)
                </LongPressButton>
              )}
              {/* Manual End Trip button removed to enforce happy path (ends automatically upon arrival at final station). */}
            </>
          )}

          {status === "ended" && (
            <Button
              size="lg"
              className="flex-1 h-12 rounded-xl text-base gap-2 font-bold shadow-md active:scale-95 transition-transform"
              disabled
            >
              <CheckCircle2 className="w-5 h-5" />
              تم إنهاء هذه المركبة
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
