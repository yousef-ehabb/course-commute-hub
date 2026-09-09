/**
 * VehiclePassedCard — displayed instead of the map when a "passed" tab is selected.
 *
 * Explains why the vehicle is no longer available and guides the student
 * to the next available vehicle with a one-tap switch button.
 */

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VehicleTab } from "@/hooks/useVehicleTabState";

interface VehiclePassedCardProps {
  /** The tab that represents the passed vehicle */
  passedTab: VehicleTab;
  /** The next available tab to suggest, if any */
  nextAvailableTab: VehicleTab | null;
  /** Callback to switch to another vehicle's tab */
  onSwitchToVehicle: (vehicleId: string) => void;
}

export function VehiclePassedCard({
  passedTab,
  nextAvailableTab,
  onSwitchToVehicle,
}: VehiclePassedCardProps) {
  const isVehicleFull =
    passedTab.vehicle.status === "full" || Boolean(passedTab.vehicle.isFull);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-sm rounded-2xl p-6 space-y-5 ${
          isVehicleFull
            ? "bg-destructive/5 border border-destructive/20"
            : "bg-amber-500/5 border border-amber-500/15"
        }`}
      >
        {/* Warning icon and message */}
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isVehicleFull ? "bg-destructive/10" : "bg-amber-500/10"
            }`}
          >
            <AlertTriangle
              className={`w-7 h-7 ${
                isVehicleFull
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-400"
              }`}
              strokeWidth={1.8}
            />
          </div>

          <div className="space-y-2">
            <h3
              className={`text-[16px] font-bold ${
                isVehicleFull
                  ? "text-destructive"
                  : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {isVehicleFull
                ? `🔴 ${passedTab.label} ممتلئ فعليًا`
                : `${passedTab.label} عدّى نقطة التجمع الخاصة بيك`}
            </h3>
            <p
              className={`text-[13px] leading-relaxed ${
                isVehicleFull
                  ? "text-destructive/80"
                  : "text-amber-600/80 dark:text-amber-400/70"
              }`}
            >
              {isVehicleFull ? (
                <>
                  الباص ممتلئ — لن يتوقف في هذه المحطة.
                  <br />
                  يرجى انتظار باص آخر.
                  {nextAvailableTab
                    ? ` تابع ${nextAvailableTab.label} المتاح حالياً.`
                    : " لا توجد باصات أخرى متاحة حاليًا."}
                </>
              ) : (
                <>
                  المركبة دي عدّت المحطة بتاعتك ومش هتعدي عليها تاني.
                  {nextAvailableTab
                    ? ` تابع ${nextAvailableTab.label} — لسه مروحتش.`
                    : " مفيش مركبات تانية متاحة حاليًا."}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Switch button */}
        {nextAvailableTab && (
          <Button
            variant="outline"
            className={`w-full h-12 rounded-xl gap-2 font-semibold text-[14px] ${
              isVehicleFull
                ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                : "border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            }`}
            onClick={() => onSwitchToVehicle(nextAvailableTab.vehicle.id)}
          >
            <span className="text-lg">{nextAvailableTab.emoji}</span>
            تابع {nextAvailableTab.label}
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          </Button>
        )}
      </div>
    </div>
  );
}
