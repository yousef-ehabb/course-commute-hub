import { Users, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { DailyRecord } from "@/hooks/useTodayStatus";

interface TripSummaryProps {
  passengers: DailyRecord[];
  stations: Array<{ id: string; name: string }>;
}

export function TripSummary({ passengers, stations }: TripSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Only consider riding passengers
  const ridingPassengers = passengers.filter((p) => p.status === "riding");

  // Calculate total riding students
  const totalStudents = ridingPassengers.length;

  // Group by station
  const stationCounts: Record<string, number> = {};
  ridingPassengers.forEach((p) => {
    stationCounts[p.station] = (stationCounts[p.station] || 0) + 1;
  });

  // Calculate participating stations (only stations that have >= 1 student)
  const participatingStationsCount = Object.keys(stationCounts).filter(
    (k) => k !== "custom",
  ).length;

  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden transition-all duration-200">
      <div
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="text-lg font-bold text-foreground">ملخص رحلة اليوم</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 flex gap-3">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {totalStudents} ركاب
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {participatingStationsCount} نقاط
            </span>
          </p>
        </div>
        <button className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 text-muted-foreground">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-5 pt-0 border-t border-border/50">
          <h4 className="text-[13px] font-semibold text-muted-foreground mb-3 mt-4">
            النقاط وعدد الركاب:
          </h4>
          <div className="space-y-2.5">
            {stations.map((station, index) => {
              const count = stationCounts[station.id] || 0;
              if (count === 0) return null; // Only show participating stations
              return (
                <div
                  key={station.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{station.name}</span>
                  </div>
                  <div className="text-xs font-bold bg-background shadow-sm px-2.5 py-1 rounded-lg">
                    {count}{" "}
                    {count === 1
                      ? "طالب"
                      : count === 2
                        ? "طالبين"
                        : count <= 10
                          ? "طلاب"
                          : "طالباً"}
                  </div>
                </div>
              );
            })}

            {/* Custom locations if any */}
            {(stationCounts["custom"] || 0) > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-[11px] font-bold">
                    *
                  </div>
                  <span className="text-sm font-semibold text-foreground">مواقع مخصصة</span>
                </div>
                <div className="text-xs font-bold bg-background shadow-sm px-2.5 py-1 rounded-lg">
                  {stationCounts["custom"]} طلاب
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
