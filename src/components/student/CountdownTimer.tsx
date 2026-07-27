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
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
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
          تم غلق التسجيل لرحلات اليوم
        </span>
      </div>
    );
  }

  if (!timeLeft) return null;

  return (
    <div className="rounded-2xl bg-card shadow-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-[18px] h-[18px] text-muted-foreground" strokeWidth={1.8} />
          <span className="text-[13px] font-medium text-muted-foreground">غلق التسجيل خلال</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono" dir="ltr">
          <div className="bg-muted rounded-lg px-2 py-1 min-w-[2rem] text-center text-[15px] font-bold text-foreground">
            {String(timeLeft.hours).padStart(2, "0")}
          </div>
          <span className="text-muted-foreground/50 font-bold">:</span>
          <div className="bg-muted rounded-lg px-2 py-1 min-w-[2rem] text-center text-[15px] font-bold text-foreground">
            {String(timeLeft.minutes).padStart(2, "0")}
          </div>
          <span className="text-muted-foreground/50 font-bold">:</span>
          <div className="bg-muted rounded-lg px-2 py-1 min-w-[2rem] text-center text-[15px] font-bold text-foreground">
            {String(timeLeft.seconds).padStart(2, "0")}
          </div>
        </div>
      </div>
    </div>
  );
}
