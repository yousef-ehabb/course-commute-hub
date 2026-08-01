/**
 * VehicleTabStrip — horizontal scrollable tab bar for the student tracking page.
 *
 * Designed for mobile-first high-density layout (~50px tall):
 *   - Sleek tab pills with clear active/inactive visual feedback
 *   - Displays vehicle emoji, friendly label, and status badge in an inline layout
 *   - Auto-scrolls selected tab into view
 */

import { useRef, useEffect } from "react";
import { Check, AlertTriangle, Navigation, Lock } from "lucide-react";
import type { VehicleTab, VehicleTabState } from "@/hooks/useVehicleTabState";

interface VehicleTabStripProps {
  tabs: VehicleTab[];
  selectedTabId: string | null;
  onTabSelect: (vehicleId: string) => void;
  isLocked: boolean;
}

const BADGE_CONFIG: Record<
  VehicleTabState,
  { bg: string; text: string; icon: typeof Check | null }
> = {
  active: {
    bg: "bg-primary/10",
    text: "text-primary",
    icon: Navigation,
  },
  passed: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  boarded: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: Check,
  },
  locked: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Lock,
  },
  ended: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: Check,
  },
};

function getTabStyles(state: VehicleTabState, isSelected: boolean): string {
  const base =
    "relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-150 shrink-0 cursor-pointer select-none text-right";

  if (state === "boarded") {
    return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs ring-1 ring-emerald-500/30`;
  }

  if (state === "locked") {
    return `${base} border-border/30 bg-muted/20 opacity-40 cursor-not-allowed text-muted-foreground`;
  }

  if (state === "passed") {
    return `${base} border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 opacity-70 ${
      isSelected ? "ring-1 ring-amber-500/40 border-amber-500/40" : ""
    }`;
  }

  if (state === "ended") {
    return `${base} border-border/30 bg-muted/30 text-muted-foreground opacity-60 ${
      isSelected ? "ring-1 ring-border" : ""
    }`;
  }

  // Active state
  if (isSelected) {
    return `${base} border-primary/40 bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary/20`;
  }

  return `${base} border-border/60 bg-card hover:bg-accent/50 text-foreground font-medium`;
}

export function VehicleTabStrip({
  tabs,
  selectedTabId,
  onTabSelect,
}: VehicleTabStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedTabId]);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-1 pt-0.5 snap-x scrollbar-hide shrink-0"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {tabs.map((tab) => {
        const isSelected = tab.vehicle.id === selectedTabId;
        const isDisabled = tab.state === "locked";
        const badgeConfig = BADGE_CONFIG[tab.state];
        const BadgeIcon = badgeConfig.icon;

        return (
          <button
            key={tab.vehicle.id}
            ref={isSelected ? selectedRef : null}
            onClick={() => !isDisabled && onTabSelect(tab.vehicle.id)}
            disabled={isDisabled}
            className={getTabStyles(tab.state, isSelected)}
            aria-selected={isSelected}
            role="tab"
          >
            {/* Vehicle Emoji */}
            <span className="text-lg leading-none shrink-0">{tab.emoji}</span>

            {/* Label + Optional Plate */}
            <div className="flex flex-col text-right">
              <span className="text-[13px] leading-tight whitespace-nowrap">
                {tab.label}
              </span>
              {tab.vehicle.licensePlate && (
                <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                  {tab.vehicle.licensePlate}
                </span>
              )}
            </div>

            {/* Compact Status Badge */}
            {tab.badge && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${badgeConfig.bg} ${badgeConfig.text}`}
              >
                {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5" strokeWidth={2.2} />}
                <span>{tab.badge}</span>
              </span>
            )}

            {/* Boarded Pulse Dot */}
            {tab.state === "boarded" && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
