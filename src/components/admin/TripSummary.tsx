import { Users, MapPin, ChevronDown, ChevronUp, User } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DailyRecord } from "@/hooks/useTodayStatus";
import { isStationSelected } from "@/utils/stationResolver";
import { cn } from "@/lib/utils";

interface TripSummaryProps {
  passengers: DailyRecord[];
  stations: Array<{ id: string; name: string }>;
  courses?: Array<{ id: string; name: string }>;
}

export function TripSummary({ passengers, stations, courses }: TripSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedStations, setExpandedStations] = useState<Record<string, boolean>>({});

  const toggleStation = (stationId: string) => {
    setExpandedStations((prev) => ({
      ...prev,
      [stationId]: !prev[stationId],
    }));
  };

  // Only consider riding passengers who have selected a valid station
  const ridingPassengers = useMemo(
    () => passengers.filter((p) => p.status === "riding" && isStationSelected(p.station)),
    [passengers],
  );

  // Calculate total riding passengers
  const totalPassengers = ridingPassengers.length;

  // Group passengers by station
  const stationPassengers = useMemo(() => {
    const grouped: Record<string, DailyRecord[]> = {};
    ridingPassengers.forEach((p) => {
      const sId = p.station;
      if (!grouped[sId]) {
        grouped[sId] = [];
      }
      grouped[sId].push(p);
    });
    // Sort students alphabetically within each station for clean UX
    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || "", "ar"));
    });
    return grouped;
  }, [ridingPassengers]);

  // Group by course
  const courseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ridingPassengers.forEach((p) => {
      const cId = p.courseId || "default";
      counts[cId] = (counts[cId] || 0) + 1;
    });
    return counts;
  }, [ridingPassengers]);

  const getCourseName = (cId: string) => {
    if (courses) {
      const found = courses.find((c) => c.id === cId);
      if (found) return found.name;
    }
    if (cId === "default") return "الكورس الأساسي";
    return cId;
  };

  // Calculate participating stations (only stations that have >= 1 passenger)
  const participatingStationsCount = Object.keys(stationPassengers).filter(
    (k) => k !== "custom",
  ).length;

  const getPassengerCountLabel = (count: number) => {
    if (count === 0) return "0 ركاب";
    if (count === 1) return "1 راكب";
    if (count === 2) return "راكبين";
    if (count <= 10) return `${count} ركاب`;
    return `${count} راكباً`;
  };

  const customStudents = stationPassengers["custom"] || [];
  const hasMultipleCourses = (courses && courses.length > 1) || Object.keys(courseCounts).length > 1;

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
              <Users className="w-4 h-4" /> {totalPassengers} ركاب
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {participatingStationsCount} نقاط
            </span>
          </p>
        </div>
        <button
          type="button"
          aria-label={isExpanded ? "طي ملخص الرحلة" : "توسيع ملخص الرحلة"}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 text-muted-foreground"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-5 pt-0 border-t border-border/50">
          {/* Distribution by course */}
          {Object.keys(courseCounts).length > 0 && (
            <div className="mb-4 mt-3">
              <h4 className="text-[12px] font-semibold text-muted-foreground mb-2">
                توزيع الركاب حسب الكورس:
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(courseCounts).map(([cId, count]) => (
                  <span
                    key={cId}
                    className="inline-flex items-center gap-1.5 bg-muted/50 border border-border/60 text-foreground px-2.5 py-1 rounded-lg text-xs font-semibold"
                  >
                    <span>📚 {getCourseName(cId)}:</span>
                    <strong className="text-primary">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <h4 className="text-[13px] font-semibold text-muted-foreground mb-3 mt-4">
            النقاط وعدد الركاب:
          </h4>
          <div className="space-y-2.5">
            {stations.map((station, index) => {
              const students = stationPassengers[station.id] || [];
              const count = students.length;
              const isStationExpanded = !!expandedStations[station.id];

              return (
                <div
                  key={station.id}
                  className="bg-muted/30 border border-border/40 rounded-xl overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleStation(station.id)}
                    className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors text-start select-none"
                    aria-expanded={isStationExpanded}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors",
                          count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-foreground truncate">
                        {station.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div
                        className={cn(
                          "text-xs font-bold px-2.5 py-1 rounded-lg transition-colors",
                          count > 0 ? "bg-background shadow-xs text-foreground" : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {getPassengerCountLabel(count)}
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform duration-200",
                          isStationExpanded && "rotate-180 text-foreground",
                        )}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isStationExpanded && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 pt-0 border-t border-border/40">
                          {count === 0 ? (
                            <div className="py-2.5 px-3 text-center text-xs text-muted-foreground font-medium bg-muted/20 rounded-lg mt-2">
                              لا يوجد طلاب مسجلون لهذه المحطة
                            </div>
                          ) : (
                            <div className="max-h-56 overflow-y-auto space-y-1.5 pt-2 pr-0.5">
                              {students.map((student) => (
                                <div
                                  key={student.id}
                                  className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-background/70 hover:bg-background transition-colors text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                      <User className="w-3 h-3" />
                                    </div>
                                    <span className="font-medium text-foreground truncate">
                                      {student.fullName || "طالب بدون اسم"}
                                    </span>
                                    {student.isStaff && (
                                      <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 rounded font-medium shrink-0">
                                        مشرف
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {student.phone && (
                                      <span className="text-[11px] text-muted-foreground font-mono dir-ltr">
                                        {student.phone}
                                      </span>
                                    )}
                                    {hasMultipleCourses && student.courseId && (
                                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                                        {getCourseName(student.courseId)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Custom locations if any */}
            {customStudents.length > 0 && (
              <div className="bg-muted/30 border border-border/40 rounded-xl overflow-hidden transition-all duration-200 mt-2">
                <button
                  type="button"
                  onClick={() => toggleStation("custom")}
                  className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors text-start select-none"
                  aria-expanded={!!expandedStations["custom"]}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                      *
                    </div>
                    <span className="text-sm font-semibold text-foreground truncate">
                      مواقع مخصصة
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-xs font-bold bg-background shadow-xs text-foreground px-2.5 py-1 rounded-lg">
                      {getPassengerCountLabel(customStudents.length)}
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform duration-200",
                        expandedStations["custom"] && "rotate-180 text-foreground",
                      )}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {expandedStations["custom"] && (
                    <motion.div
                      key="custom-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 border-t border-border/40">
                        <div className="max-h-56 overflow-y-auto space-y-1.5 pt-2 pr-0.5">
                          {customStudents.map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-background/70 hover:bg-background transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                  <User className="w-3 h-3" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium text-foreground truncate">
                                    {student.fullName || "طالب بدون اسم"}
                                  </span>
                                  {student.customLocation?.name && (
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      📍 {student.customLocation.name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {student.phone && (
                                  <span className="text-[11px] text-muted-foreground font-mono dir-ltr">
                                    {student.phone}
                                  </span>
                                )}
                                {hasMultipleCourses && student.courseId && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                                    {getCourseName(student.courseId)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
