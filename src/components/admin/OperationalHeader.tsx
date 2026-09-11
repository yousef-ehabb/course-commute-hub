import { useMemo } from "react";
import { Bus, MapPin, Users, Navigation, Lock } from "lucide-react";
import type { Vehicle } from "@/types";
import { VEHICLE_DEFAULTS } from "@/types";

interface OperationalHeaderProps {
  vehicle: Vehicle;
  vehicles: Vehicle[];
  onSelectVehicle?: (vehicleId: string) => void;
  currentStationName?: string | null;
  nextStationName?: string | null;
  stationProgress?: { current: number; total: number } | null;
  boardedCount: number;
  totalPassengers: number;
  isControlling: boolean;
  isMoving: boolean;
  isHeadingToCreativa: boolean;
  isFull?: boolean;
}

export function OperationalHeader({
  vehicle,
  vehicles,
  onSelectVehicle,
  currentStationName,
  nextStationName,
  stationProgress,
  boardedCount,
  totalPassengers,
  isControlling,
  isMoving,
  isHeadingToCreativa,
  isFull = false,
}: OperationalHeaderProps) {
  const defaults = VEHICLE_DEFAULTS[vehicle.type] || { labelAr: "مركبة" };
  const isVehicleFull = isFull || vehicle.status === "full" || Boolean(vehicle.isFull);

  const vehicleLabel = useMemo(() => {
    const idx = vehicles.findIndex((v) => v.id === vehicle.id);
    const num = idx >= 0 ? idx + 1 : 1;
    return `${defaults.labelAr} ${num}`;
  }, [vehicles, vehicle.id, defaults.labelAr]);

  return (
    <div className="bg-card/95 backdrop-blur-md rounded-2xl p-2.5 sm:p-3.5 border border-border shadow-card space-y-2 sm:space-y-2.5 transition-all">
      {/* Top Row: Vehicle Identity, Coordinator & Live Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                {vehicleLabel}
              </span>
              {vehicle.licensePlate && (
                <span className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50 font-mono">
                  {vehicle.licensePlate}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
              {isControlling ? (
                <span className="text-primary font-semibold flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  أنت القائد
                </span>
              ) : (
                <span className="text-muted-foreground truncate">
                  متابعة: {vehicle.assignedCoordinatorName || "منسق آخر"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="shrink-0">
          {isVehicleFull ? (
            <span className="bg-destructive/15 text-destructive border border-destructive/30 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              ممتلئ فعليًا
            </span>
          ) : isMoving ? (
            <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {isHeadingToCreativa ? "في الطريق لكرياتيفا" : "في الطريق"}
            </span>
          ) : (
            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              صعود الركاب
            </span>
          )}
        </div>
      </div>

      {/* Multi-bus Horizontal Selector Pills (Shown only if multiple vehicles exist) */}
      {vehicles.length > 1 && onSelectVehicle && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-[10px] text-muted-foreground font-semibold shrink-0">المركبة:</span>
          {vehicles.map((v, i) => {
            const vDefs = VEHICLE_DEFAULTS[v.type] || { labelAr: "مركبة" };
            const isSelected = v.id === vehicle.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVehicle(v.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40"
                    : "bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                }`}
              >
                <Bus className="w-3 h-3 shrink-0" />
                <span>{vDefs.labelAr} {i + 1}</span>
                {v.status === "full" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Station Context Banner */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 bg-muted/40 rounded-xl border border-border/50 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground font-medium shrink-0 text-[11px]">
            {isMoving ? "المسار:" : "المحطة الحالية:"}
          </span>
          <span className="font-bold text-foreground truncate text-xs sm:text-sm">
            {isVehicleFull
              ? isMoving
                ? "متجه مباشرة إلى Creativa (تم تخطي باقي المحطات)"
                : `${currentStationName || "نقطة التجمع"} • متجه إلى Creativa`
              : isMoving
                ? isHeadingToCreativa
                  ? "نحو كرياتيفا (الوجهة النهائية)"
                  : `نحو: ${nextStationName || "المحطة التالية"}`
                : currentStationName || "نقطة التجمع"}
          </span>
        </div>

        {stationProgress && !isVehicleFull && (
          <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] shrink-0">
            {stationProgress.current} / {stationProgress.total}
          </span>
        )}
      </div>

      {/* Quick Stats: Boarded + Capacity */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-center gap-1.5 bg-muted/60 px-2 sm:px-2.5 py-1.5 rounded-lg border border-border/40">
          <Users className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground font-medium text-[11px]">صعد:</span>
          <span className="font-bold text-foreground">
            {boardedCount} / {totalPassengers}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 bg-muted/60 px-2 sm:px-2.5 py-1.5 rounded-lg border border-border/40">
          <Bus className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground font-medium text-[11px]">الحمولة:</span>
          <span className="font-bold text-foreground">
            {vehicle.occupiedSeats} / {vehicle.capacity}
          </span>
          {isVehicleFull && (
            <span className="text-[10px] text-destructive font-bold mr-0.5">
              (مكتمل)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
