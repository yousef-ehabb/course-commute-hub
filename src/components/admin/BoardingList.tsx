import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Users,
  Lock,
  MapPin,
  ExternalLink,
  GraduationCap,
  Shield,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Check,
  Sparkles,
} from "lucide-react";
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
  isCurrentStation?: boolean;
}

export function BoardingList({
  stationName,
  passengers,
  onConfirmBoarding,
  onDepartStation,
  isLastStation,
  isFull = false,
  isCurrentStation = true,
}: BoardingListProps) {
  const [showDepartConfirm, setShowDepartConfirm] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [justBoardedId, setJustBoardedId] = useState<string | null>(null);

  // Split passengers into unboarded and boarded
  const unboardedPassengers = useMemo(
    () => passengers.filter((p) => !p.boarded),
    [passengers]
  );
  const boardedPassengers = useMemo(
    () => passengers.filter((p) => p.boarded),
    [passengers]
  );

  const [showBoarded, setShowBoarded] = useState(unboardedPassengers.length === 0);

  const boardedCount = boardedPassengers.length;
  const expectedCount = passengers.length;
  const remainingCount = unboardedPassengers.length;

  const handleToggle = async (passenger: Passenger) => {
    if (isFull) return;
    // Prevent duplicate clicks while processing this specific student
    if (processingIds.has(passenger.id)) return;

    setProcessingIds((prev) => new Set(prev).add(passenger.id));
    try {
      await onConfirmBoarding(passenger.id);
      if (!passenger.boarded) {
        // Just boarded successfully - trigger visual highlight
        setJustBoardedId(passenger.id);
        setTimeout(() => {
          setJustBoardedId((curr) => (curr === passenger.id ? null : curr));
        }, 2200);
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
    <div className="bg-card rounded-2xl p-3 sm:p-5 shadow-card space-y-4 border border-border/60">
      {/* Station Prominent Operational Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/30 rounded-xl border border-border/40">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <MapPin className={`w-3.5 h-3.5 shrink-0 ${isCurrentStation ? "text-primary" : "text-muted-foreground"}`} />
            <span className={isCurrentStation ? "text-primary font-bold" : "text-muted-foreground"}>
              {isCurrentStation ? "المحطة الحالية" : "نقطة تجمع"}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
            {stationName}
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <div className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg text-xs font-bold">
            صعد: {boardedCount} / {expectedCount}
          </div>
          {remainingCount > 0 ? (
            <div className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded-lg text-xs font-bold">
              في الانتظار: {remainingCount}
            </div>
          ) : expectedCount > 0 ? (
            <div className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              اكتمل الصعود
            </div>
          ) : null}
        </div>
      </div>

      {/* Full Bus Warning Banner */}
      {isFull && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
          <Lock className="w-4 h-4 shrink-0" />
          <span>تم تأكيد امتلاء الباص — تم إغلاق الصعود ويتم الانتقال مباشرة إلى Creativa</span>
        </div>
      )}

      {/* Passenger List Container - Clean touch-friendly scrolling without locking */}
      <div className="space-y-5">
        {/* =================================================== */}
        {/* SECTION 1: UNBOARDED PASSENGERS (HIGH PRIORITY)     */}
        {/* =================================================== */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <Users className="w-4 h-4" />
              لم يصعد بعد
            </span>
            <span className="bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
              {unboardedPassengers.length} طلاب
            </span>
          </div>

          {unboardedPassengers.map((passenger) => {
            const isProcessing = processingIds.has(passenger.id);
            return (
              <div
                key={passenger.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border gap-3 transition-all duration-150 ${
                  isFull
                    ? "bg-muted/30 border-border/50 opacity-70"
                    : isProcessing
                      ? "bg-muted/60 border-primary/40 opacity-80"
                      : "bg-card hover:bg-muted/30 border-border/80 shadow-sm"
                }`}
              >
                {/* Student Info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-bold text-foreground leading-tight">
                      {passenger.name}
                    </span>
                    {passenger.isStaff && (
                      <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-500/25">
                        <Shield className="w-3 h-3" />
                        موظف / مدرب
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {passenger.courseName && (
                      <span className="bg-primary/10 text-primary font-bold text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/20">
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span>{passenger.courseName}</span>
                      </span>
                    )}

                    {passenger.customLocationName && (
                      <span className="bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-500/20">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>موقع: {passenger.customLocationName}</span>
                      </span>
                    )}

                    {passenger.locationLink && (
                      <a
                        href={passenger.locationLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span>الخريطة</span>
                      </a>
                    )}
                  </div>

                  <div className="text-[11px] sm:text-xs text-muted-foreground font-mono" dir="ltr">
                    {passenger.phone}
                  </div>
                </div>

                {/* Board Action Button with minimum 44px touch target */}
                <div className="shrink-0 pt-1 sm:pt-0">
                  {isFull ? (
                    <div className="h-11 px-4 rounded-xl bg-muted/80 text-muted-foreground font-semibold text-xs flex items-center justify-center gap-1.5 border border-border/60">
                      <Lock className="w-3.5 h-3.5" />
                      الصعود مغلق
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      disabled={isProcessing}
                      onClick={() => handleToggle(passenger)}
                      className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs sm:text-sm font-bold gap-2 shadow-sm transition-transform active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري التسجيل...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>تسجيل صعود</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state: all students boarded */}
          {unboardedPassengers.length === 0 && boardedPassengers.length > 0 && (
            <div className="text-center py-6 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                تم صعود جميع الطلاب في هذه النقطة!
              </p>
              <p className="text-xs text-muted-foreground">
                صعد {boardedPassengers.length} من أصل {expectedCount} ركاب. الباص جاهز للمغادرة عند الاستعداد.
              </p>
            </div>
          )}

          {/* Empty state: zero passengers registered for this station */}
          {passengers.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-foreground bg-muted/30 border border-border/40 rounded-xl space-y-1">
              <Users className="w-6 h-6 mx-auto text-muted-foreground/60 mb-1" />
              <p className="font-semibold">لا يوجد طلاب في انتظار الركوب في هذه المحطة اليوم</p>
            </div>
          )}
        </div>

        {/* =================================================== */}
        {/* SECTION 2: BOARDED PASSENGERS                       */}
        {/* =================================================== */}
        {boardedPassengers.length > 0 && (
          <div className="space-y-2.5 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                صعد بالفعل
              </span>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {boardedPassengers.length} ركاب
                </span>
                <button
                  type="button"
                  onClick={() => setShowBoarded(!showBoarded)}
                  className="text-xs text-muted-foreground hover:text-foreground underline font-semibold flex items-center gap-0.5"
                >
                  {showBoarded ? (
                    <>
                      <span>إخفاء</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>عرض</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {showBoarded && (
              <div className="space-y-2">
                {boardedPassengers.map((passenger) => {
                  const isProcessing = processingIds.has(passenger.id);
                  const isJustBoarded = justBoardedId === passenger.id;
                  return (
                    <div
                      key={passenger.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border gap-3 transition-all duration-150 ${
                        isJustBoarded
                          ? "bg-emerald-500/20 ring-2 ring-emerald-500 border-emerald-500/40"
                          : "bg-emerald-500/5 border-emerald-500/20"
                      }`}
                    >
                      {/* Passenger Details */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-foreground leading-tight">
                            {passenger.name}
                          </span>
                          {isJustBoarded && (
                            <span className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <Sparkles className="w-3 h-3" />
                              تم الصعود للتو
                            </span>
                          )}
                          {passenger.isStaff && (
                            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-500/25">
                              <Shield className="w-3 h-3" />
                              موظف / مدرب
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {passenger.courseName && (
                            <span className="bg-primary/10 text-primary font-bold text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/20">
                              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                              <span>{passenger.courseName}</span>
                            </span>
                          )}

                          <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-500/25">
                            <Check className="w-3.5 h-3.5" />
                            <span>تم الصعود {passenger.vehicleName ? `• ${passenger.vehicleName}` : ""}</span>
                          </span>
                        </div>

                        <div className="text-[11px] sm:text-xs text-muted-foreground font-mono" dir="ltr">
                          {passenger.phone}
                        </div>
                      </div>

                      {/* Undo Action Button */}
                      <div className="shrink-0 flex items-center justify-end sm:justify-start gap-2 pt-1 sm:pt-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isProcessing || isFull}
                          onClick={() => handleToggle(passenger)}
                          className="h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 gap-1.5 rounded-xl border-border/70"
                          title="إلغاء تسجيل الصعود في حال الخطأ"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>تراجع</span>
                        </Button>

                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Non-operational Depart Button & Confirmation Modal */}
      {onDepartStation && (
        <>
          <Button
            className="w-full mt-2 font-bold h-12 rounded-xl text-base"
            size="lg"
            variant="default"
            onClick={handleDepartClick}
          >
            {isFull
              ? "التحرك مباشرة إلى Creativa"
              : isLastStation
                ? "مغادرة نحو كرياتيفا (الوجهة النهائية)"
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
