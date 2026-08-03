import { useState, useEffect } from "react";
import { Vehicle, VEHICLE_DEFAULTS } from "../../types";
import { Button } from "../ui/button";
import { Loader2, Navigation, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ActiveVehiclesProps {
  vehicles: Vehicle[];
  adminUid: string;
  onTakeControl: (vehicleId: string) => Promise<{ success: boolean; error?: string }>;
  onReleaseControl: (vehicleId: string) => Promise<{ success: boolean; error?: string }>;
  onSelectVehicle?: (vehicleId: string) => void;
  selectedVehicleId?: string | null;
}

export function ActiveVehicles({
  vehicles,
  adminUid,
  onTakeControl,
  onReleaseControl,
  onSelectVehicle,
  selectedVehicleId,
}: ActiveVehiclesProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [vehicleToSteal, setVehicleToSteal] = useState<string | null>(null);

  // Force re-render every second to keep "Xs ago" fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentlyControlledVehicleId = vehicles.find(
    (v) => v.assignedCoordinatorId === adminUid
  )?.id;

  const handleTakeControl = async (e: React.MouseEvent, vehicleId: string) => {
    e.stopPropagation();
    setLoadingAction(`take-${vehicleId}`);
    try {
      await onTakeControl(vehicleId);
    } finally {
      setLoadingAction(null);
      setVehicleToSteal(null);
    }
  };

  const handleStealControlConfirm = async () => {
    if (!vehicleToSteal) return;
    setLoadingAction(`take-${vehicleToSteal}`);
    try {
      await onTakeControl(vehicleToSteal);
    } finally {
      setLoadingAction(null);
      setVehicleToSteal(null);
    }
  };

  const handleReleaseControl = async (e: React.MouseEvent, vehicleId: string) => {
    e.stopPropagation();
    setLoadingAction(`release-${vehicleId}`);
    try {
      await onReleaseControl(vehicleId);
    } finally {
      setLoadingAction(null);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 60) return `منذ ${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return `منذ دقيقة واحدة`;
    if (minutes === 2) return `منذ دقيقتين`;
    if (minutes >= 3 && minutes <= 10) return `منذ ${minutes} دقائق`;
    return `منذ ${minutes} دقيقة`;
  };

  const stealedVehicle = vehicles.find((v) => v.id === vehicleToSteal);

  return (
    <>
      <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          المركبات النشطة
        </h2>
        <div className="space-y-4">
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مركبات في هذه الرحلة.</p>
          ) : (
            vehicles.map((vehicle) => {
              const isControlledByMe = vehicle.assignedCoordinatorId === adminUid;
              const isControlledByOther =
                vehicle.assignedCoordinatorId && !isControlledByMe;
              
              const defaults = VEHICLE_DEFAULTS[vehicle.type] || { emoji: "🚐", labelAr: "مركبة" };
              
              const isLoading =
                loadingAction === `take-${vehicle.id}` ||
                loadingAction === `release-${vehicle.id}`;

              const canTakeControl = !currentlyControlledVehicleId;
              const isSelected = selectedVehicleId === vehicle.id;
              
              return (
                <div
                  key={vehicle.id}
                  onClick={() => onSelectVehicle?.(vehicle.id)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${onSelectVehicle ? "cursor-pointer hover:border-primary/50" : ""} ${
                    isSelected ? "ring-2 ring-primary ring-offset-1 border-primary/50 bg-primary/10" :
                    isControlledByMe
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 bg-background"
                  } gap-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
                      {defaults.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {defaults.labelAr}
                        {vehicle.licensePlate && (
                          <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                            {vehicle.licensePlate}
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                        <span className="shrink-0">الركاب: {vehicle.occupiedSeats}/{vehicle.capacity}</span>
                        {isControlledByOther && (
                          <span className="flex items-center gap-1 text-orange-500 font-medium break-words">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              متابعة بواسطة <strong>{vehicle.assignedCoordinatorName || "منسق آخر"}</strong> — تم التحديث{" "}
                              {formatTimeAgo(vehicle.lastHeartbeatAt || vehicle.assignedAt || 0)}
                            </span>
                          </span>
                        )}
                        {isControlledByMe && (
                          <span className="flex items-center gap-1 text-primary font-medium break-words">
                            <Navigation className="w-3.5 h-3.5 shrink-0" />
                            <span>أنت المسؤول عن متابعة المركبة</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {isControlledByMe ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleReleaseControl(e, vehicle.id)}
                        disabled={isLoading}
                      >
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        إنهاء المتابعة
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-1 items-end">
                        <Button
                          variant={isControlledByOther ? "outline" : "default"}
                          size="sm"
                          onClick={(e) => {
                            if (isControlledByOther) {
                              e.stopPropagation();
                              setVehicleToSteal(vehicle.id);
                            } else {
                              handleTakeControl(e, vehicle.id);
                            }
                          }}
                          disabled={isLoading || !canTakeControl}
                          className={isControlledByOther ? "border-orange-500/50 text-orange-600 hover:bg-orange-50" : ""}
                        >
                          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {isControlledByOther ? "استلام المتابعة" : "استلم المتابعة"}
                        </Button>
                        {!canTakeControl && (
                          <span className="text-[10px] text-muted-foreground">
                            أنهِ متابعة المركبة الحالية أولًا
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AlertDialog open={!!vehicleToSteal} onOpenChange={(open) => !open && setVehicleToSteal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استلام متابعة المركبة</AlertDialogTitle>
            <AlertDialogDescription>
              هذه المركبة تتم متابعتها حاليًا بواسطة المنسق <strong>{stealedVehicle?.assignedCoordinatorName || "آخر"}</strong>.
              هل تريد استلام المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleStealControlConfirm}>استلام المتابعة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
