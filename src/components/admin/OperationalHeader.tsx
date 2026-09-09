import { useMemo } from "react";
import { Bus, MapPin, Users, Navigation, ChevronDown } from "lucide-react";
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
  const defaults = VEHICLE_DEFAULTS[vehicle.type] || { emoji: "🚐", labelAr: "مركبة" };
  const isVehicleFull = isFull || vehicle.status === "full" || Boolean(vehicle.isFull);

  const vehicleLabel = useMemo(() => {
    const idx = vehicles.findIndex((v) => v.id === vehicle.id);
    const num = idx >= 0 ? idx + 1 : 1;
    return `${defaults.labelAr} ${num}`;
  }, [vehicles, vehicle.id, defaults.labelAr]);

  return (
    <div className="bg-card/95 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-border shadow-card space-y-2.5">
      {/* Top Row: Vehicle Info & Switcher + Live Status */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0">
            {defaults.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground truncate">
                {vehicleLabel}
              </span>
              {vehicle.licensePlate && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50 font-mono">
                  {vehicle.licensePlate}
                </span>
              )}
              {/* Vehicle switcher dropdown if multiple vehicles exist */}
              {vehicles.length > 1 && onSelectVehicle && (
                <div className="relative inline-block">
                  <select
                    value={vehicle.id}
                    onChange={(e) => onSelectVehicle(e.target.value)}
                    className="bg-muted/80 hover:bg-muted border border-border/80 text-foreground text-[11px] font-semibold rounded-lg px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                    title="تبديل المركبة المعروضة"
                  >
                    {vehicles.map((v, i) => {
                      const vDefs = VEHICLE_DEFAULTS[v.type] || { labelAr: "مركبة" };
                      return (
                        <option key={v.id} value={v.id}>
                          {vDefs.labelAr} {i + 1} {v.licensePlate ? `(${v.licensePlate})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              {isControlling ? (
                <span className="text-primary font-semibold flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  أنت القائد
                </span>
              ) : (
                <span className="text-muted-foreground">
                  متابعة: {vehicle.assignedCoordinatorName || "منسق آخر"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2 shrink-0">
          {isVehicleFull ? (
            <span className="bg-destructive/15 text-destructive border border-destructive/30 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
              🔴 ممتلئ فعليًا
            </span>
          ) : isMoving ? (
            <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {isHeadingToCreativa ? "في الطريق لكرياتيفا" : "في الطريق"}
            </span>
          ) : (
            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              صعود الركاب بالنقطة
            </span>
          )}
        </div>
      </div>

      {/* Bottom Row: Current Station & Station Progress + Passenger Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
        {/* Station Indicator */}
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground font-medium shrink-0">الموقع الحالي:</span>
          <span className="font-bold text-foreground truncate">
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
          {stationProgress && !isVehicleFull && (
            <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-md text-[11px] shrink-0 mr-1">
              {stationProgress.current} / {stationProgress.total}
            </span>
          )}
        </div>

        {/* Boarding Counts & Capacity */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium text-[11px]">صعد:</span>
            <span className="font-bold text-foreground">
              {boardedCount} / {totalPassengers}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg">
            <Bus className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium text-[11px]">الحمولة:</span>
            <span className="font-bold text-foreground">
              {vehicle.occupiedSeats} / {vehicle.capacity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
