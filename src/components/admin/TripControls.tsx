import { Bus, MapPin, Play, Square, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface TripControlsProps {
  status: "pending" | "waiting_at_station" | "moving" | "completed" | "completing";
  onStartTrip: (licensePlate: string) => void;
  onEndTrip: () => void;
  isLocationEnabled: boolean;
  endTripDisabled?: boolean;
  endTripLoading?: boolean;
  totalPassengers?: number;
  boardedPassengers?: number;
}

export function TripControls({
  status,
  onStartTrip,
  onEndTrip,
  isLocationEnabled,
  endTripDisabled,
  endTripLoading,
  totalPassengers = 0,
  boardedPassengers = 0,
}: TripControlsProps) {
  const [licensePlate, setLicensePlate] = useState("");

  const occupancyPercentage =
    totalPassengers > 0 ? Math.round((boardedPassengers / totalPassengers) * 100) : 0;

  let statusChip = null;
  if (status === "completing") {
    statusChip = (
      <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" /> جاري الإنهاء
      </span>
    );
  } else if (status === "pending") {
    statusChip = (
      <span className="bg-secondary/10 text-secondary-foreground px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        في الانتظار
      </span>
    );
  } else if (status === "waiting_at_station") {
    statusChip = (
      <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span> صعود الركاب
      </span>
    );
  } else if (status === "moving") {
    statusChip = (
      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> في الطريق
      </span>
    );
  } else if (status === "completed") {
    statusChip = (
      <span className="bg-success/10 text-success px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1.5">
        <CheckCircle2 className="w-3 h-3" /> مكتملة
      </span>
    );
  }

  return (
    <article className="bg-card shadow-card rounded-2xl p-4 flex flex-col gap-4 border border-border">
      {/* Header & Status */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">رحلة اليوم</h2>
          <p className="text-[12px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {isLocationEnabled ? "GPS مفعل" : "GPS غير مفعل"}
          </p>
        </div>
        {statusChip}
      </div>

      {/* Metrics Row */}
      <div className="flex items-center justify-between py-3 bg-muted/30 rounded-xl px-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              الحالة
            </p>
            <p className="text-sm font-bold text-foreground">
              {status === "completing"
                ? "جاري الحفظ"
                : status === "pending"
                  ? "لم تبدأ"
                  : status === "waiting_at_station"
                    ? "بالنقطة"
                    : status === "moving"
                      ? "جارية"
                      : "اكتملت"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-r border-border/50 pr-4 mr-4">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              الحضور
            </p>
            <p className="text-sm font-bold text-foreground">
              {boardedPassengers} / {totalPassengers}{" "}
              <span className="text-muted-foreground font-normal text-xs">
                ({occupancyPercentage}%)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-1">
        {status === "pending" && (
          <div className="space-y-3 mb-2">
            <div className="space-y-1">
              <Label htmlFor="licensePlate" className="text-sm">رقم لوحة الباص (اختياري)</Label>
              <Input
                id="licensePlate"
                placeholder="أدخل رقم اللوحة (مثال: أ ب ج 123)"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {status === "completing" && (
            <Button
              size="lg"
              disabled
              className="flex-1 h-12 bg-amber-600 text-white rounded-xl text-base gap-2"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري إنهاء الرحلة...
            </Button>
          )}

          {status === "pending" && (
            <Button
              size="lg"
              className="flex-1 h-12 rounded-xl text-base gap-2 font-bold shadow-md active:scale-95 transition-transform"
              onClick={() => onStartTrip(licensePlate.trim())}
            >
              <Play className="w-5 h-5 fill-current" />
              بدء الرحلة
            </Button>
          )}

        {(status === "waiting_at_station" || status === "moving") && (
          <Button
            size="lg"
            variant="destructive"
            className="flex-1 h-12 rounded-xl text-base gap-2 font-bold shadow-md active:scale-95 transition-transform"
            onClick={onEndTrip}
            disabled={endTripDisabled || endTripLoading}
          >
            {endTripLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الإنهاء...
              </>
            ) : (
              <>
                <Square className="w-5 h-5 fill-current" />
                إنهاء الرحلة
              </>
            )}
          </Button>
        )}

        {status === "completed" && (
          <Button
            size="lg"
            className="flex-1 h-12 rounded-xl text-base gap-2 font-bold shadow-md active:scale-95 transition-transform"
            onClick={() => {
              setLicensePlate("");
              onStartTrip("");
            }}
          >
            <RotateCcw className="w-5 h-5" strokeWidth={2} />
            بدء رحلة جديدة
          </Button>
        )}
        </div>
      </div>
    </article>
  );
}
