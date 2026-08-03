import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, Clock, Users, MapPin } from "lucide-react";
import { DEFAULT_CUTOFF_TIME } from "@/lib/constants";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [cutoffTime, setCutoffTime] = useState(DEFAULT_CUTOFF_TIME);
  const [cutoffEnabled, setCutoffEnabled] = useState(true);
  const [forceLock, setForceLock] = useState(false);
  const [vehicleLimits, setVehicleLimits] = useState({ micro: 14, mini: 33, bus: 50 });
  const [activeDateKey, setActiveDateKey] = useState<string>("");

  const [dbRef, setDbRef] = useState<any>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");

      const db = getFirebaseDb();
      setDbRef(db);

      const path = `rakeb/settings/default`;
      unsub = onValue(
        ref(db, path),
        (snap) => {
          const val = snap.val();
          if (val) {
            if (val.cutoffTime !== undefined) setCutoffTime(val.cutoffTime);
            if (val.cutoffEnabled !== undefined) setCutoffEnabled(val.cutoffEnabled);
            if (val.forceLock !== undefined) setForceLock(val.forceLock);
            if (val.vehicleLimits) setVehicleLimits(val.vehicleLimits);
            if (val.activeDateKey) setActiveDateKey(val.activeDateKey);
          }
        },
        (error) => {
          console.error("[Settings] Failed to load settings:", error);
        },
      );
    })().catch((err) => {
      console.error("[Settings] Initialization failed:", err);
    });
    return () => unsub?.();
  }, []);

  const handleSave = async () => {
    if (!dbRef) return;
    try {
      const { ref, update } = await import("firebase/database");
      
      let cutoffTimestamp = null;
      if (activeDateKey && cutoffTime) {
        const [year, month, day] = activeDateKey.split("-").map(Number);
        const [cutoffHours, cutoffMinutes] = cutoffTime.split(":").map(Number);
        const cutoff = new Date(year, month - 1, day);
        cutoff.setDate(cutoff.getDate() - 1);
        cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);
        cutoffTimestamp = cutoff.getTime();
      }

      // Use update() instead of set() to merge with existing data.
      // set() was destroying activeDateKey and other fields on every save.
      await update(ref(dbRef, `rakeb/settings/default`), {
        cutoffTime,
        cutoffEnabled,
        forceLock,
        ...(cutoffTimestamp ? { cutoffTimestamp } : {}),
        vehicleLimits,
        updatedAt: Date.now(),
        updatedBy: user?.uid || "unknown",
      });
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (e) {
      console.error("[Settings] Save failed:", e);
      toast.error("حدث خطأ أثناء الحفظ");
    }
  };

  return (
    <div className="space-y-6 pt-4 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
          <p className="text-muted-foreground mt-1">إدارة إعدادات النظام والتطبيق</p>
        </div>
        <Button className="hidden md:flex gap-2 bg-primary" onClick={handleSave}>
          <Save className="w-4 h-4" />
          حفظ التعديلات
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Registration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              إعدادات التسجيل
            </CardTitle>
            <CardDescription>تحكم في أوقات غلق التسجيل للطلاب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div>
                <label className="text-sm font-medium text-foreground">إغلاق التسجيل يدوياً</label>
                <p className="text-xs text-muted-foreground">منع الطلاب من تغيير حالتهم فوراً وبشكل دائم</p>
              </div>
              <Switch
                checked={forceLock}
                onCheckedChange={setForceLock}
                className={forceLock ? "bg-red-500" : ""}
              />
            </div>

            <div className={`flex items-center justify-between pb-4 border-b border-border/50 ${forceLock ? "opacity-50 pointer-events-none" : ""}`}>
              <div>
                <label className="text-sm font-medium text-foreground">تفعيل غلق التسجيل التلقائي</label>
                <p className="text-xs text-muted-foreground">منع الطلاب من تغيير حالتهم بعد وقت محدد</p>
              </div>
              <Switch checked={cutoffEnabled} onCheckedChange={setCutoffEnabled} />
            </div>

            <div className={`space-y-2 ${(!cutoffEnabled || forceLock) ? "opacity-50 pointer-events-none" : ""}`}>
              <label className="text-sm font-medium text-foreground">وقت غلق التسجيل يومياً</label>
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full p-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">الوقت بصيغة 24 ساعة (مثال: 22:00 = 10 مساءً)</p>
            </div>

            <div className="pt-4 border-t border-border/50">
              <label className="text-sm font-medium text-foreground">تاريخ الرحلة القادمة (اليوم الفعال)</label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="date"
                  value={activeDateKey || ""}
                  onChange={async (e) => {
                    const newDate = e.target.value;
                    if (!newDate || !dbRef) return;
                    try {
                      const { ref, update } = await import("firebase/database");
                      await update(ref(dbRef, `rakeb/settings/default`), { activeDateKey: newDate });
                      setActiveDateKey(newDate);
                      toast.success("تم تحديث تاريخ الرحلة القادمة بنجاح");
                    } catch(err) {
                      toast.error("فشل في تحديث تاريخ الرحلة");
                    }
                  }}
                  className="w-full p-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                هذا هو تاريخ الرحلة التي سيتم التسجيل لها. موعد غلق التسجيل سيكون <b>اليوم الذي يسبق هذا التاريخ</b> في الوقت المحدد أعلاه.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              سعات المركبات
            </CardTitle>
            <CardDescription>تحديد أقصى عدد لركاب كل نوع</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3 text-foreground">ميكروباص</span>
              <input
                type="number"
                value={vehicleLimits.micro}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, micro: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-border rounded-lg bg-card text-foreground text-center"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3 text-foreground">ميني باص</span>
              <input
                type="number"
                value={vehicleLimits.mini}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, mini: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-border rounded-lg bg-card text-foreground text-center"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3 text-foreground">أتوبيس كبير</span>
              <input
                type="number"
                value={vehicleLimits.bus}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, bus: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-border rounded-lg bg-card text-foreground text-center"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pickup Points Config */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  إدارة نقاط التجمع
                </CardTitle>
                <CardDescription>إضافة وتعديل وترتيب نقاط التجمع</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                إضافة نقطة جديدة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-xl p-8 border border-dashed border-border text-center">
              <p className="text-muted-foreground">واجهة إدارة نقاط التجمع قيد التطوير...</p>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Mobile Save Floating Button */}
      <div className="md:hidden fixed bottom-20 ltr:right-4 rtl:left-4 z-40">
        <Button
          onClick={handleSave}
          className="rounded-full w-14 h-14 shadow-lg bg-primary text-white flex items-center justify-center p-0"
        >
          <Save className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
