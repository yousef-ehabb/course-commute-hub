import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  cutoffTime: string; // HH:mm format (24h) e.g., "22:00"
  activeDateKey: string;
  getServerTime: () => number;
  onExpire?: () => void;
}

export function CountdownTimer({
  cutoffTime,
  activeDateKey,
  getServerTime,
  onExpire,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    if (!cutoffTime || !activeDateKey) return;

    const [year, month, day] = activeDateKey.split("-").map(Number);
    const [cutoffHours, cutoffMinutes] = cutoffTime.split(":").map(Number);

    const timer = setInterval(() => {
      const nowMs = getServerTime();

      const cutoff = new Date(year, month - 1, day);
      cutoff.setDate(cutoff.getDate() - 1); // Deadline is the day before
      cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);

      const diff = cutoff.getTime() - nowMs;

      if (diff <= 0) {
        setIsClosed(true);
        setTimeLeft(null);
        clearInterval(timer);
        onExpire?.();
      } else {
        setIsClosed(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cutoffTime, activeDateKey, getServerTime, onExpire]);

  if (isClosed) {
    return (
      <div className="rounded-2xl bg-destructive/6 px-4 py-3 flex items-center justify-center gap-2.5">
        <Clock className="w-[18px] h-[18px] text-destructive" strokeWidth={1.8} />
        <span className="text-[13px] font-semibold text-destructive">
          اتقفل التسجيل لباص بكره شكرا علي التزامكم        </span>
      </div>
    );
  }

  if (!timeLeft) return null;

  const isUrgent = timeLeft.hours === 0 && timeLeft.minutes < 10;

  return (
    <div className={`rounded-2xl shadow-card px-4 py-3 transition-colors duration-500 ${isUrgent ? "bg-destructive/10 animate-[pulse_2s_ease-in-out_infinite]" : "bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className={`w-[18px] h-[18px] ${isUrgent ? "text-destructive" : "text-muted-foreground"}`} strokeWidth={1.8} />
          <span className={`text-[13px] font-medium ${isUrgent ? "text-destructive font-bold" : "text-muted-foreground"}`}>
            {isUrgent ? "ينتهي التسجيل قريباً" : "غلق التسجيل خلال"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono" dir="ltr">
          <div className={`rounded-lg px-2 py-1 min-w-[2rem] text-center text-[15px] font-bold ${isUrgent ? "bg-destructive/20 text-destructive" : "bg-muted text-foreground"}`}>
            {String(timeLeft.hours).padStart(2, "0")}
          </div>
          <span className={`${isUrgent ? "text-destructive/50" : "text-muted-foreground/50"} font-bold`}>:</span>
          <div className={`rounded-lg px-2 py-1 min-w-[2rem] text-center text-[15px] font-bold ${isUrgent ? "bg-destructive/20 text-destructive" : "bg-muted text-foreground"}`}>
            {String(timeLeft.minutes).padStart(2, "0")}
          </div>
          <span className={`${isUrgent ? "text-destructive/50" : "text-muted-foreground/50"} font-bold`}>:</span>
          <div className={`rounded-lg px-2 py-1 min-w-[2rem] text-center text-[15px] font-bold ${isUrgent ? "bg-destructive/20 text-destructive" : "bg-muted text-foreground"}`}>
            {String(timeLeft.seconds).padStart(2, "0")}
          </div>
        </div>
      </div>
    </div>
  );
}
