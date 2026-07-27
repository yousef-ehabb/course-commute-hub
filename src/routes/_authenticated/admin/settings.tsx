import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Save, Clock, Users, MapPin } from "lucide-react";
import { DEFAULT_CUTOFF_TIME } from "@/lib/constants";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [cutoffTime, setCutoffTime] = useState(DEFAULT_CUTOFF_TIME);
  const [cutoffEnabled, setCutoffEnabled] = useState(true);
  const [vehicleLimits, setVehicleLimits] = useState({ micro: 14, mini: 33, bus: 50 });

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
            if (val.vehicleLimits) setVehicleLimits(val.vehicleLimits);
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
      // Use update() instead of set() to merge with existing data.
      // set() was destroying activeDateKey and other fields on every save.
      await update(ref(dbRef, `rakeb/settings/default`), {
        cutoffTime,
        cutoffEnabled,
        vehicleLimits,
        updatedAt: Date.now(),
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الإعدادات</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">إدارة إعدادات النظام والتطبيق</p>
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
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">تفعيل غلق التسجيل التلقائي</p>
                <p className="text-sm text-gray-500">منع الطلاب من تغيير حالتهم بعد وقت محدد</p>
              </div>
              <Switch checked={cutoffEnabled} onCheckedChange={setCutoffEnabled} />
            </div>

            <div className={`space-y-2 ${!cutoffEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <label className="text-sm font-medium">وقت غلق التسجيل يومياً</label>
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-gray-500">الوقت بصيغة 24 ساعة (مثال: 22:00 = 10 مساءً)</p>
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
              <span className="font-medium w-1/3">ميكروباص</span>
              <input
                type="number"
                value={vehicleLimits.micro}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, micro: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-center"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3">ميني باص</span>
              <input
                type="number"
                value={vehicleLimits.mini}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, mini: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-center"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium w-1/3">أتوبيس كبير</span>
              <input
                type="number"
                value={vehicleLimits.bus}
                onChange={(e) =>
                  setVehicleLimits((prev) => ({ ...prev, bus: parseInt(e.target.value) || 0 }))
                }
                className="w-2/3 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-center"
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
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 border border-dashed border-gray-300 dark:border-gray-700 text-center">
              <p className="text-gray-500">واجهة إدارة نقاط التجمع قيد التطوير...</p>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Mobile Save Floating Button */}
      <div className="md:hidden fixed bottom-16 ltr:right-4 rtl:left-4 z-40">
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
