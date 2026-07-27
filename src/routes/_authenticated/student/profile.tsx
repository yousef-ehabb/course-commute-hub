import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useStations } from "@/contexts/StationsContext";
import { Phone, MapPin, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStationName } from "@/utils/stationResolver";

export const Route = createFileRoute("/_authenticated/student/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, signOutUser } = useAuth();
  const { stations } = useStations();

  if (!profile) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">حسابي</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">البيانات الشخصية</p>
      </div>

      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        {/* Avatar Header */}
        <div className="px-5 py-6 bg-primary/4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-xl font-bold">
            {profile.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{profile.fullName}</h2>
            <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-lg font-medium mt-1 inline-block">
              طالب
            </span>
          </div>
        </div>

        {/* Info Rows */}
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-muted-foreground" strokeWidth={1.8} />
            <div>
              <div className="text-[12px] text-muted-foreground">رقم الموبايل</div>
              <div className="text-[14px] font-medium dir-ltr" dir="ltr">
                {profile.phone}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-muted-foreground" strokeWidth={1.8} />
            <div>
              <div className="text-[12px] text-muted-foreground">الرقم القومي</div>
              <div className="text-[14px] font-medium dir-ltr" dir="ltr">
                {profile.nationalId}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground" strokeWidth={1.8} />
            <div>
              <div className="text-[12px] text-muted-foreground">المحطة الافتراضية</div>
              <div className="text-[14px] font-medium">
                {getStationName(profile.defaultStation, stations)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="destructive"
        className="w-full gap-2"
        size="lg"
        onClick={() => signOutUser()}
      >
        <LogOut className="w-5 h-5" strokeWidth={1.8} />
        تسجيل الخروج
      </Button>
    </div>
  );
}
