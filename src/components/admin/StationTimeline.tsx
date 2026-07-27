import { Check, Clock, MapPin, Flag, Loader2 } from "lucide-react";
import { useStations } from "@/contexts/StationsContext";

interface StationTimelineProps {
  currentStationId: string | null;
  lastStationId?: string | null;
  nextStationId?: string | null;
  status: "pending" | "waiting_at_station" | "moving" | "completed";
}

export function StationTimeline({
  currentStationId,
  lastStationId,
  nextStationId,
  status,
}: StationTimelineProps) {
  const { stations, loading } = useStations();

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-6 shadow-card flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-7 h-7 animate-spin text-primary" strokeWidth={1.8} />
      </div>
    );
  }

  // Add Creativa as the final destination node
  const finalDestinationNode = {
    id: "creativa",
    name: "كرياتيفا",
    detail: "الوجهة النهائية — مركز إبداع مصر الرقمية",
    time: "الوصول النهائي",
  };

  const allNodes = [...stations, finalDestinationNode];
  const totalSteps = Math.max(1, allNodes.length - 1);

  const currentIndex = currentStationId
    ? stations.findIndex((s) => s.id === currentStationId)
    : status === "completed"
      ? allNodes.length - 1
      : -1;

  const lastIndex = lastStationId ? stations.findIndex((s) => s.id === lastStationId) : -1;
  const nextIndex =
    nextStationId === "creativa"
      ? stations.length
      : nextStationId
        ? stations.findIndex((s) => s.id === nextStationId)
        : -1;

  let progressHeight = "0%";
  if (status === "completed") {
    progressHeight = "100%";
  } else if (status === "moving" && lastIndex >= 0) {
    progressHeight = `${((lastIndex + 0.5) / totalSteps) * 100}%`;
  } else if (currentIndex >= 0) {
    progressHeight = `${(currentIndex / totalSteps) * 100}%`;
  }

  return (
    <div className="bg-card rounded-2xl p-5 shadow-card relative overflow-hidden border border-border/50">
      <h3 className="text-[15px] font-semibold mb-5">مسار الرحلة</h3>

      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute right-[18px] top-4 bottom-4 w-0.5 bg-muted rounded-full" />

        {/* Active Progress Line */}
        {(currentIndex >= 0 ||
          (status === "moving" && lastIndex >= 0) ||
          status === "completed") && (
          <div
            className="absolute right-[18px] top-4 w-0.5 bg-primary rounded-full transition-all duration-1000 ease-in-out"
            style={{ height: progressHeight }}
          />
        )}

        <div className="space-y-5 relative z-10">
          {allNodes.map((node, index) => {
            const isFinalDestination = index === allNodes.length - 1;

            const isCompleted =
              status === "completed" ||
              (!isFinalDestination &&
                ((status === "waiting_at_station" && index < currentIndex) ||
                  (status === "moving" && index <= lastIndex)));

            const isCurrent = status === "waiting_at_station" && index === currentIndex;

            const isMovingTowardsThis =
              status === "moving" &&
              (index === nextIndex ||
                (isFinalDestination &&
                  (nextStationId === "creativa" || lastIndex === stations.length - 1)));

            const isPending = !isCompleted && !isCurrent && !isMovingTowardsThis;

            return (
              <div key={node.id} className="flex items-start gap-3 pr-1 relative">
                {/* Timeline Node */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all relative z-10
                  ${
                    isCompleted
                      ? "bg-primary text-white"
                      : isCurrent
                        ? "bg-white ring-4 ring-primary/15 text-primary shadow-sm"
                        : isFinalDestination && isMovingTowardsThis
                          ? "bg-success text-white shadow-sm animate-pulse"
                          : isFinalDestination
                            ? "bg-primary/10 border-2 border-primary/30 text-primary"
                            : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <MapPin className="w-4 h-4" strokeWidth={2} />
                  ) : isFinalDestination ? (
                    <Flag className="w-4 h-4" strokeWidth={2} />
                  ) : (
                    <span className="text-[12px] font-bold">{index + 1}</span>
                  )}
                </div>

                {/* Content */}
                <div className={`pt-1 flex-1 ${isPending ? "opacity-50" : ""}`}>
                  <div className="flex justify-between items-center mb-0.5">
                    <h4
                      className={`text-[14px] font-semibold ${
                        isCurrent || isMovingTowardsThis
                          ? "text-primary"
                          : isFinalDestination
                            ? "text-foreground font-bold"
                            : "text-foreground"
                      }`}
                    >
                      {node.name}
                      {isFinalDestination && (
                        <span className="mr-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          الوجهة النهائية
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.8} />
                      {node.time}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{node.detail}</p>

                  {isCurrent && (
                    <div className="mt-2 px-3 py-2 bg-primary/5 rounded-xl flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      <p className="text-[12px] text-primary font-medium">
                        الباص متواجد هنا حالياً
                      </p>
                    </div>
                  )}

                  {isMovingTowardsThis && (
                    <div className="absolute -top-5 right-5 translate-x-1/2 flex items-center z-20">
                      <div className="bg-card rounded-full p-1 ring-2 ring-primary shadow-elevated animate-bounce">
                        <span className="text-base leading-none block">🚌</span>
                      </div>
                      <div className="mr-2 bg-primary text-white text-[11px] px-2 py-1 rounded-lg font-semibold shadow-sm relative">
                        {isFinalDestination ? "في الطريق إلى كرياتيفا" : "في الطريق"}
                        <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-y-[3px] border-y-transparent border-l-[3px] border-l-primary" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
