/**
 * VehiclePlanning — production-ready responsive planning panel for adding/removing
 * vehicles before the trip day starts.
 *
 * Features:
 * - Mobile-first responsive layout (no horizontal scroll, min 44px touch targets)
 * - Clear RTL Arabic alignment & visual typography hierarchy
 * - Confirmed students vs total capacity tracking bar
 * - Scalable vehicle cards with touch-friendly capacity steppers
 * - Grid-based add vehicle buttons (Bus / Microbus)
 * - Prominent "Start Transportation Day" primary action button
 */

import { useState } from "react";
import { Plus, Trash2, Bus, AlertTriangle, CheckCircle2, Minus, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Vehicle, VehicleType } from "@/types";
import { VEHICLE_DEFAULTS } from "@/types";

interface VehiclePlanningProps {
  vehicles: Vehicle[];
  confirmedStudents?: number;
  confirmedStaff?: number;
  confirmedPassengers?: number;
  onAddVehicle: (type: VehicleType, capacity: number) => Promise<void>;
  onRemoveVehicle: (vehicleId: string) => Promise<void>;
  onUpdateCapacity: (vehicleId: string, capacity: number) => Promise<void>;
  onStartDay?: () => Promise<void>;
  disabled?: boolean;
}

export function VehiclePlanning({
  vehicles,
  confirmedStudents = 0,
  confirmedStaff = 0,
  confirmedPassengers,
  onAddVehicle,
  onRemoveVehicle,
  onUpdateCapacity,
  onStartDay,
  disabled,
}: VehiclePlanningProps) {
  const [addingType, setAddingType] = useState<VehicleType | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingCapacity, setEditingCapacity] = useState<Record<string, string>>({});
  const [isStartingDay, setIsStartingDay] = useState(false);

  const totalPassengers = confirmedPassengers ?? (confirmedStudents + confirmedStaff);
  const totalCapacity = vehicles.reduce((sum, v) => sum + v.capacity, 0);
  const remainingSeats = totalCapacity - totalPassengers;
  const hasEnoughCapacity = remainingSeats >= 0;

  const handleAdd = async (type: VehicleType) => {
    setAddingType(type);
    try {
      await onAddVehicle(type, VEHICLE_DEFAULTS[type].capacity);
    } finally {
      setAddingType(null);
    }
  };

  const handleRemove = async () => {
    if (!removingId) return;
    try {
      await onRemoveVehicle(removingId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleCapacityBlur = async (vehicleId: string, currentCapacity: number) => {
    const rawValue = editingCapacity[vehicleId];
    if (rawValue === undefined) return;

    const newCapacity = parseInt(rawValue, 10);
    if (!isNaN(newCapacity) && newCapacity > 0 && newCapacity !== currentCapacity) {
      await onUpdateCapacity(vehicleId, newCapacity);
    }

    setEditingCapacity((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
  };

  // Number the vehicles by type for Arabic friendly display
  const vehicleLabels = vehicles.map((v, i) => {
    const sameTypeBefore = vehicles.slice(0, i).filter((x) => x.type === v.type).length;
    const sameTypeTotal = vehicles.filter((x) => x.type === v.type).length;
    const defaults = VEHICLE_DEFAULTS[v.type];
    const label = sameTypeTotal > 1 ? `${defaults.labelAr} ${sameTypeBefore + 1}` : defaults.labelAr;
    return { ...v, label, emoji: defaults.emoji };
  });

  return (
    <article className="bg-card shadow-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4 border border-border/80 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">تخطيط المركبات</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            تجهيز عربيات اليوم وتحديد السعات للركاب
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary shrink-0">
          قيد التخطيط
        </span>
      </div>

      {/* Summary Metrics Bar (Responsive Grid) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 bg-muted/30 rounded-xl p-3 border border-border/30">
        {/* Confirmed Passengers */}
        <div className="flex items-center gap-2.5 bg-card/80 p-2.5 rounded-lg border border-border/40">
          <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground truncate">
              الركاب المتوقعين
            </p>
            <p className="text-sm sm:text-base font-bold text-foreground leading-tight">
              {totalPassengers} <span className="text-[11px] font-normal text-muted-foreground">راكب</span>
            </p>
            {confirmedStaff > 0 && (
              <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground truncate">
                {confirmedStudents} طالب • {confirmedStaff} موظف
              </p>
            )}
          </div>
        </div>

        {/* Total Capacity */}
        <div className="flex items-center gap-2.5 bg-card/80 p-2.5 rounded-lg border border-border/40">
          <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
            <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground truncate">
              السعة الإجمالية
            </p>
            <p className="text-sm sm:text-base font-bold text-foreground leading-tight">
              {totalCapacity} <span className="text-[11px] font-normal text-muted-foreground">مقعد</span>
            </p>
          </div>
        </div>

        {/* Status Badge (Full Width) */}
        <div
          className={`col-span-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${vehicles.length === 0
              ? "bg-muted text-muted-foreground border border-border/40"
              : hasEnoughCapacity
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
            }`}
        >
          {vehicles.length === 0 ? (
            "لم تُضف مركبات بعد — أضف مركبة للبدء"
          ) : hasEnoughCapacity ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>سعة كافية ({remainingSeats} مقعد متبقي)</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>نقص في السعة ({Math.abs(remainingSeats)} مقعد مطلوب)</span>
            </>
          )}
        </div>
      </div>

      {/* Vehicle Cards List */}
      {vehicleLabels.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[12px] font-semibold text-muted-foreground">
            المركبات المضافة ({vehicleLabels.length}):
          </p>

          {vehicleLabels.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 rounded-xl border border-border/40 gap-2 transition-colors"
            >
              {/* Vehicle Title & Emoji */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-xl shrink-0">{v.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[13px] sm:text-[14px] font-bold text-foreground truncate leading-tight">
                    {v.label}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                    السعة: {v.capacity} مقعد
                  </p>
                </div>
              </div>

              {/* Stepper & Trash Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Capacity Stepper */}
                <div className="flex items-center gap-0.5 bg-card rounded-lg border border-border/60 p-0.5 shadow-2xs">
                  {/* Decrease Button (Min 36x36px touch target) */}
                  <button
                    type="button"
                    className="w-8 h-8 sm:w-8 sm:h-8 min-w-[32px] min-h-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted transition-colors disabled:opacity-30 touch-manipulation"
                    disabled={disabled || v.status !== "planned"}
                    onClick={() => {
                      const current =
                        editingCapacity[v.id] !== undefined
                          ? parseInt(editingCapacity[v.id], 10)
                          : v.capacity;
                      if (current > 1) {
                        const newVal = current - 1;
                        setEditingCapacity((prev) => ({ ...prev, [v.id]: String(newVal) }));
                        onUpdateCapacity(v.id, newVal);
                      }
                    }}
                    aria-label="إنقاص السعة"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <Input
                    type="number"
                    min={1}
                    value={editingCapacity[v.id] ?? v.capacity}
                    onChange={(e) =>
                      setEditingCapacity((prev) => ({ ...prev, [v.id]: e.target.value }))
                    }
                    onBlur={() => handleCapacityBlur(v.id, v.capacity)}
                    className="w-10 sm:w-11 h-8 text-center text-xs sm:text-sm font-bold border-0 p-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    disabled={disabled || v.status !== "planned"}
                  />

                  {/* Increase Button (Min 36x36px touch target) */}
                  <button
                    type="button"
                    className="w-8 h-8 sm:w-8 sm:h-8 min-w-[32px] min-h-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted transition-colors disabled:opacity-30 touch-manipulation"
                    disabled={disabled || v.status !== "planned"}
                    onClick={() => {
                      const current =
                        editingCapacity[v.id] !== undefined
                          ? parseInt(editingCapacity[v.id], 10)
                          : v.capacity;
                      const newVal = current + 1;
                      setEditingCapacity((prev) => ({ ...prev, [v.id]: String(newVal) }));
                      onUpdateCapacity(v.id, newVal);
                    }}
                    aria-label="زيادة السعة"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Remove Button (Min 36x36px touch target) */}
                <button
                  type="button"
                  className="w-9 h-9 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 border border-transparent hover:border-destructive/20 transition-colors disabled:opacity-30 touch-manipulation"
                  disabled={disabled || v.status !== "planned"}
                  onClick={() => setRemovingId(v.id)}
                  aria-label="حذف المركبة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Vehicle Buttons (Grid-based, 2 equal columns on mobile) */}
      <div className="space-y-1.5">
        <p className="text-[12px] font-semibold text-muted-foreground">إضافة مركبات جديدة:</p>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            Object.entries(VEHICLE_DEFAULTS) as [
              VehicleType,
              (typeof VEHICLE_DEFAULTS)["bus"],
            ][]
          ).map(([type, defaults]) => (
            <Button
              key={type}
              variant="outline"
              className="h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-bold gap-1.5 border-dashed border-2 hover:border-primary/40 active:scale-[0.98] transition-all touch-manipulation px-2"
              disabled={disabled || addingType !== null}
              onClick={() => handleAdd(type)}
            >
              {addingType === type ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-base leading-none">{defaults.emoji}</span>
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{defaults.labelAr}</span>
                </>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Start Transportation Day Primary Action */}
      {onStartDay && (
        <div className="pt-3 border-t border-border/40 mt-1">
          <Button
            className="w-full h-12 rounded-xl text-sm sm:text-base font-bold shadow-md active:scale-[0.98] transition-all touch-manipulation"
            disabled={disabled || vehicles.length === 0 || isStartingDay}
            onClick={async () => {
              setIsStartingDay(true);
              try {
                await onStartDay();
              } finally {
                setIsStartingDay(false);
              }
            }}
          >
            {isStartingDay ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                جاري بدء اليوم...
              </>
            ) : (
              "بدء اليوم (إنهاء التخطيط)"
            )}
          </Button>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!removingId} onOpenChange={() => setRemovingId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">حذف المركبة</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm text-muted-foreground mt-2">
              هل أنت تأكد من حذف هذه المركبة من خطة اليوم؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row-reverse justify-start gap-2 mt-4 sm:space-x-0">
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold min-h-[40px]"
            >
              حذف
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setRemovingId(null)}
              className="mt-0 min-h-[40px]"
            >
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
