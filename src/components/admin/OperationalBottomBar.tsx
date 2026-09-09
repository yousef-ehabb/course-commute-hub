import { useState } from "react";
import { Play, MapPin, Flag, AlertTriangle, ShieldAlert, Bus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/LongPressButton";
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
import type { Vehicle } from "@/types";

interface OperationalBottomBarProps {
  vehicle: Vehicle;
  isControlling: boolean;
  currentStationId: string | null;
  currentStationName?: string | null;
  nextStationId?: string | null;
  nextStationName?: string | null;
  isLastStation: boolean;
  isHeadingToCreativa: boolean;
  unboardedCountAtCurrentStation: number;
  onDepartStation: () => Promise<void> | void;
  onArriveAtStation: () => Promise<void> | void;
  isCompleting?: boolean;
  isFull?: boolean;
  onMarkFull?: () => Promise<void> | void;
  isMarkingFull?: boolean;
}

export function OperationalBottomBar({
  vehicle,
  isControlling,
  currentStationId,
  currentStationName,
  nextStationId,
  nextStationName,
  isLastStation,
  isHeadingToCreativa,
  unboardedCountAtCurrentStation,
  onDepartStation,
  onArriveAtStation,
  isCompleting = false,
  isFull = false,
  onMarkFull,
  isMarkingFull = false,
}: OperationalBottomBarProps) {
  const [showDepartConfirm, setShowDepartConfirm] = useState(false);
  const [showFullConfirm, setShowFullConfirm] = useState(false);

  const handleDepartTrigger = () => {
    // If not full and unboarded students remain, confirm first
    if (!isFull && unboardedCountAtCurrentStation > 0) {
      setShowDepartConfirm(true);
    } else {
      onDepartStation();
    }
  };

  const handleConfirmDepart = () => {
    setShowDepartConfirm(false);
    onDepartStation();
  };

  const handleConfirmFull = async () => {
    setShowFullConfirm(false);
    if (onMarkFull) {
      await onMarkFull();
    }
  };

  return (
    <>
      <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:sticky lg:bottom-4 inset-x-0 lg:inset-auto z-40 bg-card/95 backdrop-blur-xl border-t lg:border border-border/80 p-3 sm:p-4 shadow-elevated lg:rounded-2xl transition-all">
        <div className="max-w-5xl mx-auto flex flex-col gap-2">
          {!isControlling ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border/60 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  هذه المركبة تحت متابعة{" "}
                  <strong className="text-foreground font-semibold">
                    {vehicle.assignedCoordinatorName || "منسق آخر"}
                  </strong>
                  . يرجى استلام المتابعة لتفعيل التحكم.
                </span>
              </div>
            </div>
          ) : currentStationId ? (
            // Bus is waiting at a station -> Depart Action (+ optional Bus Full action)
            <div className="space-y-2">
              {!isFull && unboardedCountAtCurrentStation > 0 && (
                <div className="flex items-center justify-between px-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    متبقي {unboardedCountAtCurrentStation} ركاب في هذه النقطة لم يصعدوا
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    سيتم طلب التأكيد عند التحرك
                  </span>
                </div>
              )}

              {isFull && (
                <div className="flex items-center gap-1.5 px-1 text-[11px] text-destructive font-bold">
                  <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span>الباص ممتلئ فعليًا — الخطوة التالية هي التوجه مباشرة إلى Creativa</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                {/* Secondary "Bus Full" action button - only visible if bus is NOT full yet */}
                {!isFull && onMarkFull && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFullConfirm(true)}
                    disabled={isMarkingFull}
                    className="h-12 sm:h-13 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 font-bold shrink-0 text-xs sm:text-sm px-4 order-2 sm:order-1 transition-colors"
                  >
                    {isMarkingFull ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Bus className="w-4 h-4" />
                    )}
                    <span>الباص ممتلئ</span>
                  </Button>
                )}

                {/* Primary Depart Action */}
                <LongPressButton
                  size="lg"
                  className={`flex-1 h-12 sm:h-13 rounded-xl text-sm sm:text-base font-bold shadow-md gap-2 active:scale-[0.99] transition-transform order-1 sm:order-2 ${
                    isFull
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : ""
                  }`}
                  onComplete={handleDepartTrigger}
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  {isFull
                    ? "التحرك مباشرة إلى Creativa 🏁 (اضغط مطولاً)"
                    : isLastStation
                      ? "مغادرة نحو كرياتيفا (الوجهة النهائية) 🏁 (اضغط مطولاً)"
                      : `مغادرة ${currentStationName || "نقطة التجمع"} ➡️ (اضغط مطولاً)`}
                </LongPressButton>
              </div>
            </div>
          ) : (
            // Bus is moving -> Arrive Action
            <div>
              <LongPressButton
                size="lg"
                className={`w-full h-12 sm:h-13 rounded-xl text-sm sm:text-base font-bold shadow-md gap-2 active:scale-[0.99] transition-transform ${
                  isHeadingToCreativa || isFull
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : ""
                }`}
                onComplete={onArriveAtStation}
                disabled={isCompleting}
              >
                {isHeadingToCreativa || isFull ? (
                  <>
                    <Flag className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                    {isCompleting
                      ? "جاري إنهاء الرحلة..."
                      : "الوصول إلى كرياتيفا وإنهاء الرحلة (اضغط مطولاً)"}
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                    الوصول إلى {nextStationName || "النقطة التالية"} (اضغط مطولاً)
                  </>
                )}
              </LongPressButton>
            </div>
          )}
        </div>
      </div>

      {/* Depart Confirmation Dialog when unboarded students remain */}
      <AlertDialog open={showDepartConfirm} onOpenChange={setShowDepartConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">
              تأكيد مغادرة نقطة التجمع
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm sm:text-base text-foreground mt-2">
              هناك <strong className="text-amber-600 font-bold">{unboardedCountAtCurrentStation}</strong> ركاب
              مسجلين في <span className="font-semibold text-primary">{currentStationName}</span> لم يتم تأكيد صعودهم بعد.
              <br />
              هل أنت متأكد من رغبتك في تحريك الباص والمغادرة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row-reverse justify-start gap-2 mt-4 sm:space-x-0">
            <AlertDialogAction
              onClick={handleConfirmDepart}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              نعم، المغادرة الآن
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowDepartConfirm(false)}
              className="mt-0 font-medium"
            >
              إلغاء والتأكد
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Bus Confirmation Dialog */}
      <AlertDialog open={showFullConfirm} onOpenChange={setShowFullConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-destructive flex items-center gap-2">
              <Bus className="w-5 h-5" />
              هل الباص ممتلئ فعليًا؟
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-sm sm:text-base text-foreground mt-2 space-y-2">
              <span>
                سيتم اعتبار الباص ممتلئًا، ولن يتوقف في أي من المحطات المتبقية، وسيتجه مباشرة إلى Creativa.
              </span>
              <span className="block text-destructive font-semibold text-xs sm:text-sm bg-destructive/10 p-2.5 rounded-xl border border-destructive/20 mt-2">
                ⚠️ سيظهر للطلاب أن هذا الباص ممتلئ ولن يتوقف في المحطات القادمة.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row-reverse justify-start gap-2 mt-4 sm:space-x-0">
            <AlertDialogAction
              onClick={handleConfirmFull}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              تأكيد — الباص ممتلئ
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowFullConfirm(false)}
              className="mt-0 font-medium"
            >
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
