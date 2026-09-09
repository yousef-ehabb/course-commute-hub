import { useState, useMemo } from "react";
import { CheckCircle2, Circle, Loader2, RotateCcw, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface Passenger {
  id: string;
  name: string;
  phone: string;
  boarded: boolean;
  isStaff?: boolean;
  courseName?: string;
  courseId?: string;
  vehicleName?: string;
  locationLink?: string;
  customLocationName?: string;
}

interface BoardingListProps {
  stationName: string;
  passengers: Passenger[];
  onConfirmBoarding: (passengerId: string) => Promise<void> | void;
  onDepartStation?: () => void;
  isLastStation?: boolean;
  isFull?: boolean;
}

export function BoardingList({
  stationName,
  passengers,
  onConfirmBoarding,
  onDepartStation,
  isLastStation,
  isFull = false,
}: BoardingListProps) {
  const [showDepartConfirm, setShowDepartConfirm] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [justBoardedId, setJustBoardedId] = useState<string | null>(null);
  const [showBoarded, setShowBoarded] = useState(true);

  // Split passengers into unboarded and boarded
  const unboardedPassengers = useMemo(
    () => passengers.filter((p) => !p.boarded),
    [passengers]
  );
  const boardedPassengers = useMemo(
    () => passengers.filter((p) => p.boarded),
    [passengers]
  );

  const boardedCount = boardedPassengers.length;
  const expectedCount = passengers.length;
  const remainingCount = unboardedPassengers.length;

  const handleToggle = async (passenger: Passenger) => {
    if (isFull) return;
    // Prevent double taps for the same student while processing
    if (processingIds.has(passenger.id)) return;

    setProcessingIds((prev) => new Set(prev).add(passenger.id));
    try {
      await onConfirmBoarding(passenger.id);
      if (!passenger.boarded) {
        // Just boarded successfully! Show visual feedback
        setJustBoardedId(passenger.id);
        setTimeout(() => {
          setJustBoardedId((curr) => (curr === passenger.id ? null : curr));
        }, 2500);
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(passenger.id);
        return next;
      });
    }
  };

  const handleDepartClick = () => {
    if (!isFull && remainingCount > 0) {
      setShowDepartConfirm(true);
    } else if (onDepartStation) {
      onDepartStation();
    }
  };

  const handleConfirmDepart = () => {
    setShowDepartConfirm(false);
    if (onDepartStation) {
      onDepartStation();
    }
  };

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-5 shadow-card space-y-4 border border-border/50">
      {/* Header with counts */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">الركاب في نقطة التجمع: {stationName}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">تأكيد صعود الركاب للباص</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-xs font-bold">
            صعد: {boardedCount} / المتوقع: {expectedCount}
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground">
            متبقي: {remainingCount}
          </div>
        </div>
      </div>

      {isFull && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
          <Lock className="w-4 h-4 shrink-0" />
          <span>تم تأكيد امتلاء الباص — الصعود مغلق (للمراجعة فقط)</span>
        </div>
      )}

      {/* Internal Independent Scroll Area */}
      <div className="overflow-y-auto overscroll-contain max-h-[calc(100dvh-20rem)] sm:max-h-[calc(100dvh-18rem)] lg:max-h-[540px] space-y-5 pe-1 [scrollbar-width:thin]">
        {/* =================================================== */}
        {/* SECTION 1: UNBOARDED PASSENGERS (HIGH PRIORITY)     */}
        {/* =================================================== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <Users className="w-4 h-4" />
              لم يصعد بعد
            </span>
            <span className="bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {unboardedPassengers.length} طلاب
            </span>
          </div>

          {unboardedPassengers.map((passenger) => {
            const isProcessing = processingIds.has(passenger.id);
            return (
              <div
                key={passenger.id}
                className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-150 ${
                  isFull
                    ? "bg-muted/40 border-border/60 opacity-75 cursor-not-allowed"
                    : isProcessing
                      ? "bg-muted/80 border-primary/40 pointer-events-none opacity-80"
                      : "bg-card hover:bg-muted/40 border-border/80 cursor-pointer active:scale-[0.99] shadow-sm"
                }`}
                onClick={() => !isFull && !isProcessing && handleToggle(passenger)}
              >
                <div className="min-w-0 flex-1 pl-2">
                  <div className="text-[14px] font-semibold text-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="truncate">{passenger.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {passenger.courseName && (
                        <span className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-500/25">
                          📚 {passenger.courseName}
                        </span>
                      )}
                      {passenger.isStaff && (
                        <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/25">
                          موظف / مدرب
                        </span>
                      )}
                      {passenger.customLocationName && (
                        <span className="bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/20">
                          📍 موقع مخصص: {passenger.customLocationName}
                        </span>
                      )}
                      {passenger.locationLink && (
                        <a
                          href={passenger.locationLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🗺️ فتح الخريطة
                        </a>
                      )}
                    </div>
                  </div>
                  <div
                    className="text-[12px] text-muted-foreground dir-ltr text-right mt-0.5"
                    dir="ltr"
                  >
                    {passenger.phone}
                  </div>
                </div>

                {isFull ? (
                  <span className="text-[11px] font-bold text-muted-foreground/90 flex items-center gap-1 bg-muted/80 px-2.5 py-1.5 rounded-lg border border-border/60 shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                    الصعود غير متاح
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isProcessing}
                    aria-label={`تأكيد صعود ${passenger.name}`}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors shrink-0 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 bg-muted/40 border border-border active:scale-95"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <Circle className="w-6 h-6" strokeWidth={1.8} />
                    )}
                  </button>
                )}
              </div>
            );
          })}

          {/* Empty state when all students have boarded */}
          {unboardedPassengers.length === 0 && boardedPassengers.length > 0 && (
            <div className="text-center py-5 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
              <span className="text-2xl">🎉</span>
              <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300">
                تم تسجيل صعود جميع الركاب في هذه النقطة!
              </p>
              <p className="text-[11px] text-muted-foreground">
                صعد {boardedPassengers.length} من أصل {expectedCount} ركاب. الباص جاهز للمغادرة عند الاستعداد.
              </p>
            </div>
          )}

          {/* Empty state when no passengers exist */}
          {passengers.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground bg-muted/30 rounded-xl">
              لا يوجد ركاب مسجلين في هذه النقطة اليوم
            </div>
          )}
        </div>

        {/* =================================================== */}
        {/* SECTION 2: BOARDED PASSENGERS                       */}
        {/* =================================================== */}
        {boardedPassengers.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                صعد بالفعل
              </span>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                  {boardedPassengers.length} ركاب
                </span>
                <button
                  type="button"
                  onClick={() => setShowBoarded(!showBoarded)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline font-medium"
                >
                  {showBoarded ? "إخفاء القائمة" : "عرض القائمة"}
                </button>
              </div>
            </div>

            {showBoarded &&
              boardedPassengers.map((passenger) => {
                const isProcessing = processingIds.has(passenger.id);
                const isJustBoarded = justBoardedId === passenger.id;
                return (
                  <div
                    key={passenger.id}
                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-150 ${
                      isJustBoarded
                        ? "bg-emerald-500/15 ring-2 ring-emerald-500 border-emerald-500/30"
                        : "bg-emerald-500/5 border-emerald-500/15"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pl-2">
                      <div className="text-[14px] font-semibold text-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="truncate">{passenger.name}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isJustBoarded && (
                            <span className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                              ✓ تم الصعود للتو
                            </span>
                          )}
                          {passenger.courseName && (
                            <span className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-500/25">
                              📚 {passenger.courseName}
                            </span>
                          )}
                          {passenger.isStaff && (
                            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/25">
                              موظف / مدرب
                            </span>
                          )}
                          <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                            ✓ تم الصعود {passenger.vehicleName ? `• ${passenger.vehicleName}` : ""}
                          </span>
                        </div>
                      </div>
                      <div
                        className="text-[12px] text-muted-foreground dir-ltr text-right mt-0.5"
                        dir="ltr"
                      >
                        {passenger.phone}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Safe Undo button for accidental clicks */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isProcessing || isFull}
                        onClick={() => handleToggle(passenger)}
                        className="h-8 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 rounded-lg"
                        title="إلغاء تسجيل الصعود في حال الخطأ"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>تراجع</span>
                      </Button>

                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-6 h-6" strokeWidth={2.2} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {onDepartStation && (
        <>
          <Button
            className="w-full mt-2 font-bold h-12 rounded-xl text-base"
            size="lg"
            variant="default"
            onClick={handleDepartClick}
          >
            {isFull
              ? "التحرك مباشرة إلى Creativa 🏁"
              : isLastStation
                ? "مغادرة نحو كرياتيفا (الوجهة النهائية) 🏁"
                : "مغادرة نقطة التجمع"}
          </Button>

          <AlertDialog open={showDepartConfirm} onOpenChange={setShowDepartConfirm}>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-right">تأكيد مغادرة نقطة التجمع</AlertDialogTitle>
                <AlertDialogDescription className="text-right text-base text-foreground mt-2">
                  هناك <strong className="text-amber-600 font-bold">{remainingCount}</strong> ركاب
                  لم يتم تأكيد صعودهم، هل تريد مغادرة نقطة التجمع؟
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex flex-row-reverse justify-start gap-2 mt-4 sm:space-x-0">
                <AlertDialogAction
                  onClick={handleConfirmDepart}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                >
                  متابعة
                </AlertDialogAction>
                <AlertDialogCancel onClick={() => setShowDepartConfirm(false)} className="mt-0">
                  إلغاء
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

