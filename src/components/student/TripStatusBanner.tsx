import { Bus, MapPin, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface TripStatusBannerProps {
  status: "pending" | "waiting_at_station" | "moving" | "completed";
}

export function TripStatusBanner({ status }: TripStatusBannerProps) {
  if (status === "pending") {
    return (
      <div className="rounded-2xl bg-card shadow-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          <Bus className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">باص اليوم</h3>
          <p className="text-[12px] text-muted-foreground">لم يبدأ التحرك بعد</p>
        </div>
      </div>
    );
  }

  if (status === "moving") {
    return (
      <div className="rounded-2xl bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
            <Bus className="w-5 h-5 animate-pulse" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-primary">الباص يتحرك الآن</h3>
            <p className="text-[12px] text-primary/70">تابع مسار الباص للوصول في الوقت المناسب</p>
          </div>
        </div>
        <Link
          to="/student/track"
          className="w-full h-11 bg-primary text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.97]"
        >
          <MapPin className="w-4 h-4" strokeWidth={1.8} />
          تتبع مسار الباص
        </Link>
      </div>
    );
  }

  if (status === "waiting_at_station") {
    return (
      <div className="rounded-2xl bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary animate-pulse">
            <MapPin className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-primary">الباص متوقف في المحطة</h3>
            <p className="text-[12px] text-primary/70">يتم الآن تسجيل صعود الطلاب</p>
          </div>
        </div>
        <Link
          to="/student/track"
          className="w-full h-11 bg-primary text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.97]"
        >
          <MapPin className="w-4 h-4" strokeWidth={1.8} />
          تتبع مسار الباص
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-success/5 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
        <CheckCircle2 className="w-5 h-5" strokeWidth={1.8} />
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-success">اكتملت الرحلة</h3>
        <p className="text-[12px] text-success/70">وصل الباص إلى وجهته بسلام</p>
      </div>
    </div>
  );
}
