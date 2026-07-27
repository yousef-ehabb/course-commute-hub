import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
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
  locationLink?: string;
}

interface BoardingListProps {
  stationName: string;
  passengers: Passenger[];
  onConfirmBoarding: (passengerId: string) => void;
  onDepartStation?: () => void;
  isLastStation?: boolean;
}

export function BoardingList({
  stationName,
  passengers,
  onConfirmBoarding,
  onDepartStation,
  isLastStation,
}: BoardingListProps) {
  const [showDepartConfirm, setShowDepartConfirm] = useState(false);

  const handleToggle = (passenger: Passenger) => {
    if (passenger.boarded) return;
    onConfirmBoarding(passenger.id);
  };

  const boardedCount = passengers.filter((p) => p.boarded).length;
  const expectedCount = passengers.length;
  const remainingCount = expectedCount - boardedCount;

  const handleDepartClick = () => {
    if (remainingCount > 0) {
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
    <div className="bg-card rounded-2xl p-5 shadow-card space-y-4 border border-border/50">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">ركاب محطة: {stationName}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">تأكيد صعود الطلاب للباص</p>
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

      <div className="space-y-2">
        {passengers.map((passenger) => (
          <div
            key={passenger.id}
            className={`flex items-center justify-between p-4 rounded-xl transition-all duration-150 ${
              passenger.boarded
                ? "bg-emerald-500/10 ring-1 ring-emerald-500/25 border border-emerald-500/20 cursor-default select-none"
                : "bg-muted/50 hover:bg-muted cursor-pointer active:scale-[0.98]"
            }`}
            onClick={() => handleToggle(passenger)}
          >
            <div>
              <div className="text-[14px] font-semibold text-foreground flex items-center gap-2 flex-wrap">
                <span>{passenger.name}</span>
                {passenger.boarded && (
                  <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    ✓ تم الصعود
                  </span>
                )}
                {passenger.locationLink && (
                  <a
                    href={passenger.locationLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    موقعه الفعلي
                  </a>
                )}
              </div>
              <div
                className="text-[12px] text-muted-foreground dir-ltr text-right mt-0.5"
                dir="ltr"
              >
                {passenger.phone}
              </div>
            </div>

            <button
              disabled={passenger.boarded}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                passenger.boarded
                  ? "text-emerald-600 dark:text-emerald-400 cursor-default"
                  : "text-muted-foreground/40 hover:text-muted-foreground bg-background shadow-sm border border-border"
              }`}
            >
              {passenger.boarded ? (
                <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
              ) : (
                <Circle className="w-6 h-6" strokeWidth={2} />
              )}
            </button>
          </div>
        ))}

        {passengers.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground bg-muted/30 rounded-xl">
            لا يوجد ركاب مسجلين في هذه المحطة اليوم
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
            {isLastStation ? "مغادرة نحو كرياتيفا (الوجهة النهائية) 🏁" : "مغادرة المحطة"}
          </Button>

          <AlertDialog open={showDepartConfirm} onOpenChange={setShowDepartConfirm}>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-right">تأكيد مغادرة المحطة</AlertDialogTitle>
                <AlertDialogDescription className="text-right text-base text-foreground mt-2">
                  هناك <strong className="text-amber-600 font-bold">{remainingCount}</strong> طلاب
                  لم يتم تأكيد صعودهم، هل تريد مغادرة المحطة؟
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
