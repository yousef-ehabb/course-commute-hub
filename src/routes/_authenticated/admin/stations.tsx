import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStations, Station } from "@/contexts/StationsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, GripVertical, Plus, Save, AlertTriangle } from "lucide-react";
import ClientAdminStationsMap from "@/components/admin/ClientAdminStationsMap";
import { useTripStatus } from "@/hooks/useTripStatus";
import { getStationName } from "@/utils/stationResolver";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_authenticated/admin/stations")({
  component: StationsManagementPage,
});

function StationsManagementPage() {
  const { user } = useAuth();
  const { stations: remoteStations, saveStations, loading } = useStations();
  const [localStations, setLocalStations] = useState<Station[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  // Modal state for adding a new station
  const [newStationDialog, setNewStationDialog] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [newName, setNewName] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const [saving, setSaving] = useState(false);

  // Modal state for deleting a station
  const [deletionDialog, setDeletionDialog] = useState<{
    stationId: string;
    stationName: string;
    affectedUsers: string[];
    isTripActive: boolean;
  } | null>(null);
  const [reassignStationId, setReassignStationId] = useState<string>("");
  const {
    status: tripStatus,
    currentStationId: tripCurrentStation,
    nextStationId: tripNextStation,
  } = useTripStatus();

  useEffect(() => {
    if (!isDirty && !loading) {
      setLocalStations(remoteStations);
    }
  }, [remoteStations, isDirty, loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStations(localStations);
      setIsDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddClick = (lat: number, lng: number) => {
    setNewStationDialog({ lat, lng });
    setNewName("");
    setNewDetail("");
    setNewTime("08:00");
  };

  const confirmAdd = () => {
    if (!newStationDialog || !newName) return;
    const newStation: Station = {
      id: "st_" + Date.now(),
      name: newName,
      detail: newDetail,
      time: newTime,
      latitude: newStationDialog.lat,
      longitude: newStationDialog.lng,
    };
    setLocalStations([...localStations, newStation]);
    setIsDirty(true);
    setNewStationDialog(null);
  };

  const updateStationTime = (id: string, newTime: string) => {
    setLocalStations(localStations.map((s) => (s.id === id ? { ...s, time: newTime } : s)));
    setIsDirty(true);
  };

  const removeStation = async (id: string) => {
    try {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, get } = await import("firebase/database");
      const db = getFirebaseDb();

      const usersSnap = await get(ref(db, "rakeb/users"));
      const affectedUsers: string[] = [];
      if (usersSnap.exists()) {
        const users = usersSnap.val();
        for (const [uid, user] of Object.entries(users)) {
          if ((user as any).defaultStation === id) {
            affectedUsers.push(uid);
          }
        }
      }

      const isTripActive =
        tripStatus !== "pending" &&
        tripStatus !== "completed" &&
        (tripCurrentStation === id || tripNextStation === id);

      const stationName = getStationName(id, localStations);

      if (affectedUsers.length > 0 || isTripActive) {
        setDeletionDialog({ stationId: id, stationName, affectedUsers, isTripActive });
        setReassignStationId(localStations.find((s) => s.id !== id)?.id || "");
      } else {
        // Safe to delete immediately
        executeDelete(id, null);
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء التحقق من النقطة.");
    }
  };

  const executeDelete = async (id: string, reassignTo: string | null) => {
    setSaving(true);
    try {
      if (reassignTo !== null || (deletionDialog && deletionDialog.affectedUsers.length > 0)) {
        const { getFirebaseDb } = await import("@/lib/firebase");
        const { ref, update } = await import("firebase/database");
        const db = getFirebaseDb();
        const updates: Record<string, any> = {};

        const targetStation = reassignTo === null ? "" : reassignTo; // Option 2 means ""

        // If we are passing through the dialog, use its state
        const usersToUpdate = deletionDialog?.affectedUsers || [];
        const now = Date.now();
        for (const uid of usersToUpdate) {
          updates[`rakeb/users/${uid}/defaultStation`] = targetStation;
          updates[`rakeb/users/${uid}/updatedAt`] = now;
          updates[`rakeb/users/${uid}/updatedBy`] = user?.uid || "unknown";
        }

        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }

      // Local state update
      const updatedStations = localStations.filter((s) => s.id !== id);
      setLocalStations(updatedStations);

      // Save globally
      await saveStations(updatedStations);
      setIsDirty(false);
      setDeletionDialog(null);
      toast.success("تم حذف النقطة بنجاح.");
    } catch (e) {
      toast.error("فشل في حذف النقطة.");
    } finally {
      setSaving(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newArr = [...localStations];
    const temp = newArr[index];
    newArr[index] = newArr[index - 1];
    newArr[index - 1] = temp;
    setLocalStations(newArr);
    setIsDirty(true);
  };

  const moveDown = (index: number) => {
    if (index === localStations.length - 1) return;
    const newArr = [...localStations];
    const temp = newArr[index];
    newArr[index] = newArr[index + 1];
    newArr[index + 1] = temp;
    setLocalStations(newArr);
    setIsDirty(true);
  };

  if (loading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6 pt-4 h-[calc(100dvh-8rem)] md:h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">إدارة نقاط التجمع</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            انقر على الخريطة لإضافة نقطة جديدة. يمكنك إعادة الترتيب للحفظ.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Mobile view toggle */}
          <div className="flex md:hidden bg-muted p-1 rounded-lg w-full">
            <button
              onClick={() => setMobileView("list")}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mobileView === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              القائمة
            </button>
            <button
              onClick={() => setMobileView("map")}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mobileView === "map" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              الخريطة
            </button>
          </div>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="hidden sm:flex items-center gap-2 bg-primary text-white shrink-0"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Sidebar */}
        <Card
          className={`w-full md:w-1/3 flex-col overflow-hidden md:shrink-0 ${mobileView === "list" ? "flex flex-1 min-h-0" : "hidden md:flex"}`}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <h3 className="font-bold text-lg">ترتيب النقاط ({localStations.length})</h3>
          </div>
          <CardContent className="p-0 flex-1 overflow-y-auto relative">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 pb-28 md:pb-0">
              {localStations.map((station, idx) => (
                <li
                  key={station.id}
                  className={`p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${activeId === station.id ? "bg-primary/5 dark:bg-primary/10" : ""
                    }`}
                  onMouseEnter={() => setActiveId(station.id)}
                  onMouseLeave={() => setActiveId(null)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-primary disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === localStations.length - 1}
                      className="p-1 text-gray-400 hover:text-primary disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold text-sm">{station.name}</div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <Label htmlFor={`time-${station.id}`} className="sr-only">
                        وقت الوصول
                      </Label>
                      <Input
                        id={`time-${station.id}`}
                        type="time"
                        value={station.time}
                        onChange={(e) => updateStationTime(station.id, e.target.value)}
                        className="h-7 text-xs w-28 px-2 py-1"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => removeStation(station.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Map Area */}
        <div
          className={`w-full md:w-2/3 flex-1 relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm min-h-[50vh] md:min-h-0 ${mobileView === "map" ? "flex flex-col" : "hidden md:flex flex-col"}`}
        >
          <ClientAdminStationsMap
            stations={localStations}
            onAddStation={handleAddClick}
            activeStationId={activeId}
          />
        </div>
      </div>

      {/* Global Modals */}
      {newStationDialog && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-bold">إضافة نقطة جديدة</h3>

              <div className="space-y-2">
                <Label>اسم النقطة</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: محطة الكورنيش"
                />
              </div>

              <div className="space-y-2">
                <Label>التفاصيل (اختياري)</Label>
                <Input
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  placeholder="مثال: بجوار البنك الأهلي"
                />
              </div>

              <div className="space-y-2">
                <Label>وقت الوصول المتوقع</Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button className="flex-1" onClick={confirmAdd} disabled={!newName}>
                  إضافة
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setNewStationDialog(null)}
                >
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {deletionDialog && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-md border-destructive/20 shadow-xl my-8">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 text-destructive">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">تنبيه: نقطة مستخدمة</h3>
                  <p className="text-sm opacity-90 font-medium">
                    أنت تحاول حذف نقطة ({deletionDialog.stationName})
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm border">
                {deletionDialog.affectedUsers.length > 0 && (
                  <p className="font-medium text-foreground">
                    هذه النقطة مخصصة حالياً لـ{" "}
                    <span className="font-bold text-destructive">
                      {deletionDialog.affectedUsers.length} طلاب
                    </span>{" "}
                    كنقطة تجمع افتراضية.
                  </p>
                )}
                {deletionDialog.isTripActive && (
                  <p className="font-medium text-amber-600 dark:text-amber-500">
                    الرحلة النشطة حالياً تمر بهذه النقطة! يُفضل عدم الحذف أثناء الرحلة.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                  <Label className="text-sm font-bold mb-2 block cursor-pointer">
                    الخيار الأول: نقل الطلاب لنقطة أخرى
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    سيتم تحديث ملفات الطلاب لتصبح النقطة الجديدة هي الافتراضية.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={reassignStationId}
                      onChange={(e) => setReassignStationId(e.target.value)}
                    >
                      <option value="" disabled>
                        اختر نقطة بديلة...
                      </option>
                      {localStations
                        .filter((s) => s.id !== deletionDialog.stationId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      onClick={() => executeDelete(deletionDialog.stationId, reassignStationId)}
                      disabled={!reassignStationId || saving}
                      className="shrink-0"
                    >
                      تطبيق النقل والحذف
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors">
                  <Label className="text-sm font-bold text-destructive mb-2 block">
                    الخيار الثاني: إزالة التخصيص
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    لن يتم تعيين نقطة بديلة. سيُطلب من الطلاب اختيار نقطة جديدة عند الدخول
                    للتطبيق.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => executeDelete(deletionDialog.stationId, null)}
                    disabled={saving}
                    className="w-full"
                  >
                    حذف وإزالة التخصيص
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDeletionDialog(null)}
                  disabled={saving}
                >
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile Save Floating Button */}
      <div className="md:hidden fixed bottom-20 ltr:right-4 rtl:left-4 z-40">
        <Button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="rounded-full w-14 h-14 shadow-lg bg-primary text-white flex items-center justify-center p-0"
        >
          <Save className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
