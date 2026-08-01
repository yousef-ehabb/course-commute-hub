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
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-amber-500/5 border border-amber-500/15 p-6 space-y-5">
        {/* Warning icon and message */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle
              className="w-7 h-7 text-amber-600 dark:text-amber-400"
              strokeWidth={1.8}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-[16px] font-bold text-amber-700 dark:text-amber-400">
              {passedTab.label} عدّى نقطة التجمع الخاصة بيك
            </h3>
            <p className="text-[13px] text-amber-600/80 dark:text-amber-400/70 leading-relaxed">
              المركبة دي عدّت المحطة بتاعتك ومش هتعدي عليها تاني.
              {nextAvailableTab
                ? ` تابع ${nextAvailableTab.label} — لسه مروحتش.`
                : " مفيش مركبات تانية متاحة حاليًا."}
            </p>
          </div>
        </div>

        {/* Switch button */}
        {nextAvailableTab && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 gap-2 font-semibold text-[14px]"
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
