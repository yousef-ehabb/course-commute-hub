import { Users, UserX, UserCheck, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  totalRiders: number;
  totalCancelled: number;
  totalBoarded: number;
  occupancyRate: number; // percentage
}

export function StatsCards({
  totalRiders,
  totalCancelled,
  totalBoarded,
  occupancyRate,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-muted-foreground">إجمالي الركاب</p>
              <p className="text-2xl font-bold text-foreground">{totalRiders}</p>
            </div>
            <div className="w-11 h-11 bg-primary/8 rounded-2xl flex items-center justify-center text-primary">
              <Users className="w-5 h-5" strokeWidth={1.8} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-muted-foreground">تم الإلغاء</p>
              <p className="text-2xl font-bold text-destructive">{totalCancelled}</p>
            </div>
            <div className="w-11 h-11 bg-destructive/8 rounded-2xl flex items-center justify-center text-destructive">
              <UserX className="w-5 h-5" strokeWidth={1.8} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-muted-foreground">صعدوا الباص</p>
              <p className="text-2xl font-bold text-success">{totalBoarded}</p>
            </div>
            <div className="w-11 h-11 bg-success/8 rounded-2xl flex items-center justify-center text-success">
              <UserCheck className="w-5 h-5" strokeWidth={1.8} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-muted-foreground">نسبة الإشغال</p>
              <p className="text-2xl font-bold text-primary">{occupancyRate}%</p>
            </div>
            <div className="w-11 h-11 bg-primary/8 rounded-2xl flex items-center justify-center text-primary">
              <TrendingUp className="w-5 h-5" strokeWidth={1.8} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
