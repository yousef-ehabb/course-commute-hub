import { createLazyFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { VehicleControls } from "@/components/admin/VehicleControls";
import { StationTimeline } from "@/components/admin/StationTimeline";
import { BoardingList } from "@/components/admin/BoardingList";
import { TripSummary } from "@/components/admin/TripSummary";
import { VehiclePlanning } from "@/components/admin/VehiclePlanning";
import { ActiveVehicles } from "@/components/admin/ActiveVehicles";
import { useStations } from "@/contexts/StationsContext";
import { useTripStatus } from "@/hooks/useTripStatus";
import { useTodayStatus, type DailyRecord } from "@/hooks/useTodayStatus";
import { useVehicles } from "@/hooks/useVehicles";
import { useBoardingRecords } from "@/hooks/useBoardingRecords";
import { useActiveDate } from "@/contexts/ActiveDateContext";
import { useCourse } from "@/contexts/CourseContext";
import { getAllStudents } from "@/utils/courseFilter";
import { getVehicleLabelById } from "@/utils/vehicleLabels";
import { isStationSelected, buildOperationalStations, type OperationalStation } from "@/utils/stationResolver";
import { OperationalHeader } from "@/components/admin/OperationalHeader";
import { OperationalBottomBar } from "@/components/admin/OperationalBottomBar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Flag, CheckCircle2, ChevronDown, Bus, MapPin, GraduationCap, Navigation, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/LongPressButton";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  startTrip,
  completeTrip,
  departStation,
  arriveAtStation,
  startDay,
  markVehicleFull,
  FirebaseTripError,
  getNextDateKey,
} from "@/lib/tripService";
import { TripRepository } from "@/lib/TripRepository";
import { useAuth } from "@/contexts/AuthContext";
import type { VehicleType } from "@/types";
import AdminStationsMap from "@/components/admin/AdminStationsMap";

export const Route = createLazyFileRoute("/_authenticated/admin/trips")({
  component: TripsPage,
});

// ---------------------------------------------------------------------------
// Structured error handler — surfaces real error info
// ---------------------------------------------------------------------------

function handleTripError(err: unknown, fallbackMessage: string) {
  if (err instanceof FirebaseTripError) {
    console.error(
      `[TripError] operation=${err.operation} code=${err.code} path=${err.path}`,
      err.cause,
    );

    // Show detailed message in development, friendly message in production
    const isDev = import.meta.env.DEV;
    if (isDev) {
      toast.error(`${fallbackMessage}\n[${err.code}] ${err.operation} @ ${err.path}`, {
        duration: 8000,
      });
    } else {
      toast.error(fallbackMessage);
    }
  } else {
    console.error("[TripError] Unexpected error:", err);
    toast.error(fallbackMessage);
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function TripsPage() {
  const { stations: currentCourseStations, allCourseStations, loading: stationsLoading } = useStations();
  const {
    status: tripStatus,
    currentStationId,
    nextStationId,
    lastStationId,
    raw,
  } = useTripStatus();
  const { getAllStudentsStatus } = useTodayStatus();
  const { vehicles, totalCapacity, loaded: vehiclesLoaded } = useVehicles();
  const { recordsByStudent } = useBoardingRecords();
  const { activeDateKey, serverTimeOffset, loaded: activeDateLoaded } = useActiveDate();
  const { courseId, courses } = useCourse();
  const { user, profile } = useAuth();

  const activeCourses = useMemo(() => courses.filter(c => c.status === "active"), [courses]);

  const { vehicleId: searchVehicleId } = Route.useSearch();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(searchVehicleId || null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");

  useEffect(() => {
    if (searchVehicleId) {
      setSelectedVehicleId(searchVehicleId);
    }
  }, [searchVehicleId]);

  const stations = useMemo<OperationalStation[]>(() => {
    return buildOperationalStations({
      selectedCourseId: courseId,
      selectedCourseFilter,
      activeCourses,
      allCourseStations: allCourseStations || {},
      primaryStations: currentCourseStations,
    });
  }, [courseId, selectedCourseFilter, activeCourses, allCourseStations, currentCourseStations]);

  const myVehicles = vehicles.filter((v) => v.assignedCoordinatorId === user?.uid);
  const myVehicle = myVehicles[0];

  const displayedVehicle = selectedVehicleId
    ? vehicles.find(v => v.id === selectedVehicleId)
    : (myVehicle || vehicles[0] || null);

  const isControllingDisplayed = displayedVehicle?.assignedCoordinatorId === user?.uid;

  const [dbRefs, setDbRefs] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"trip" | "passengers">("trip");
  const [mounted, setMounted] = useState(false);
  const [showEndTripDialog, setShowEndTripDialog] = useState(false);

  useEffect(() => {
    setMounted(true);
    let unsubUsers: (() => void) | undefined;
    (async () => {
      const { getFirebaseDb } = await import("@/lib/firebase");
      const { ref, onValue } = await import("firebase/database");
      const db = getFirebaseDb();
      setDbRefs({
        db,
        tripPath: `rakeb/trips/${courseId}/${activeDateKey}`,
        dailyPath: `rakeb/dailyStatus/${courseId}/${activeDateKey}`,
      });

      unsubUsers = onValue(ref(db, "rakeb/users"), (snap) => {
        const val = snap.val();
        if (val) {
          const allUsers = Object.entries(val).map(([uid, u]: [string, any]) => ({ uid, ...u }));
          // Cross-course boarding: include all students across all courses
          setUsers(getAllStudents(allUsers));
        } else {
          setUsers([]);
        }
      });
    })().catch((err) => {
      console.error("[Trips] Initialization failed:", err);
    });

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (unsubUsers) unsubUsers();
    };
  }, [activeDateKey, courseId]);

  const activeUsers = useMemo(() => {
    const activeCourseIds = new Set(activeCourses.map(c => c.id));
    return users.filter(u => {
      const cId = u.courseId || "default";
      if (!activeCourseIds.has(cId)) return false;
      // Exclude students who are not active in payment (pending, submitted, or rejected)
      if (u.role === "student" && u.paymentStatus && u.paymentStatus !== "active") return false;
      return true;
    });
  }, [users, activeCourses]);

  const passengers = useMemo<DailyRecord[]>(() => {
    return getAllStudentsStatus(activeUsers);
  }, [getAllStudentsStatus, activeUsers]);

  const confirmedPassengers = useMemo(
    () => passengers.filter((p) => p.status === "riding" && isStationSelected(p.station)),
    [passengers],
  );

  const confirmedStudentsCount = useMemo(
    () => confirmedPassengers.filter((p) => !p.isStaff).length,
    [confirmedPassengers],
  );

  const confirmedStaffCount = useMemo(
    () => confirmedPassengers.filter((p) => p.isStaff).length,
    [confirmedPassengers],
  );

  // ── Vehicle Planning Handlers ───────────────────────────────────────────

  const handleAddVehicle = async (type: VehicleType, capacity: number) => {
    if (!dbRefs) return;
    try {
      await TripRepository.createVehicle(dbRefs.db, activeDateKey, {
        type,
        capacity,
        createdBy: user?.uid ?? "unknown",
      });
      toast.success(`تمت إضافة ${type === "bus" ? "أتوبيس" : "ميكروباص"}`);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إضافة المركبة");
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (!dbRefs) return;
    try {
      await TripRepository.removeVehicle(dbRefs.db, activeDateKey, vehicleId);
      toast.success("تم حذف المركبة");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء حذف المركبة");
    }
  };

  const handleUpdateCapacity = async (vehicleId: string, capacity: number) => {
    if (!dbRefs) return;
    try {
      await TripRepository.updateVehicleCapacity(dbRefs.db, activeDateKey, vehicleId, capacity);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء تحديث السعة");
    }
  };

  const handleTakeControl = async (vehicleId: string) => {
    if (!dbRefs || !user) return { success: false, error: "Not initialized" };
    try {
      const adminName = profile?.fullName || user.displayName || user.email?.split("@")[0] || "منسق";
      console.log(`[handleTakeControl] Initiating takeControl for vehicleId=${vehicleId}, user.uid=${user.uid}, adminName=${adminName}`);
      const res = await TripRepository.takeControl(dbRefs.db, activeDateKey, vehicleId, user.uid, adminName);
      console.log(`[handleTakeControl] takeControl completed. Result:`, res);
      if (!res.success) {
        toast.error(res.error);
      }
      return res;
    } catch (e: any) {
      console.error("[handleTakeControl] Exception caught:", e);
      if (e instanceof FirebaseTripError) {
        console.error(`[handleTakeControl] FirebaseTripError code=${e.code} path=${e.path}`, e.cause);
      }
      toast.error(`حدث خطأ: ${e?.message || 'Unknown error'}`);
      return { success: false, error: e?.message };
    }
  };

  const handleReleaseControl = async (vehicleId: string) => {
    if (!dbRefs || !user) return { success: false, error: "Not initialized" };
    try {
      const res = await TripRepository.releaseControl(dbRefs.db, activeDateKey, vehicleId, user.uid);
      if (!res.success) {
        toast.error(res.error);
      }
      return res;
    } catch (e: any) {
      toast.error("حدث خطأ أثناء التخلي عن المسؤولية");
      return { success: false, error: e.message };
    }
  };

  // ── Existing Trip Handlers (kept for Phase 2a compatibility) ────────────

  const handleStartTrip = async (licensePlate: string) => {
    // Phase 2c: start vehicle trip
    if (!dbRefs || !displayedVehicle || !isControllingDisplayed) return;
    try {
      // Always ask for location when starting the trip
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });
      }
      
      const { ref, update } = await import("firebase/database");
      const vehiclePath = `rakeb/vehicles/${activeDateKey}/${displayedVehicle.id}`;
      await update(ref(dbRefs.db, vehiclePath), {
        status: "running",
        licensePlate,
        currentStationId: stations[0]?.id ?? null,
      });
      toast.success("تم بدء الرحلة للمركبة");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء بدء الرحلة");
    }
  };

  const handleEndTrip = async () => {
    if (!dbRefs || isCompleting || !displayedVehicle || !isControllingDisplayed) return;
    setIsCompleting(true);
    try {
      const { ref, update } = await import("firebase/database");
      const vehiclePath = `rakeb/vehicles/${activeDateKey}/${displayedVehicle.id}`;
      await update(ref(dbRefs.db, vehiclePath), {
        status: "ended",
        currentStationId: null,
        nextStationId: null,
      });

      toast.success(`تم إنهاء مسار المركبة بنجاح`);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إنهاء مسار المركبة");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleEndDay = async () => {
    if (!dbRefs || isCompleting) return;
    setIsCompleting(true);
    try {
      const nextDate = getNextDateKey(activeDateKey);
      const [year, month, day] = nextDate.split("-").map(Number);
      const { ref, get } = await import("firebase/database");
      const settingsSnap = await get(ref(dbRefs.db, `rakeb/settings/${courseId}`));

      let cutoffTimeStr = "13:15";
      let isCutoffEnabled = false;
      if (settingsSnap.exists()) {
        const s = settingsSnap.val();
        if (s.cutoffTime) cutoffTimeStr = s.cutoffTime;
        if (s.cutoffEnabled === true) isCutoffEnabled = true;
      }

      if (isCutoffEnabled) {
        const [cutoffHours, cutoffMinutes] = cutoffTimeStr.split(":").map(Number);
        const cutoff = new Date(year, month - 1, day);
        cutoff.setDate(cutoff.getDate() - 1);
        cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);

        const now = Date.now() + serverTimeOffset;
        if (now > cutoff.getTime()) {
          const proceed = window.confirm(
            `تحذير: موعد غلق التسجيل لرحلة الغد (${cutoffTimeStr}) قد انقضى بالفعل!\nإذا قمت بإنهاء هذه الرحلة الآن، فلن يتمكن الطلاب من التسجيل لرحلة الغد.\n\nهل أنت متأكد من رغبتك في إنهاء الرحلة الآن؟`
          );
          if (!proceed) {
            setIsCompleting(false);
            return;
          }
        }
      }

      // Read daily status for metadata enrichment
      const dailyStatusSnapshot = await TripRepository.readDailyStatusSnapshot(
        dbRefs.db,
        activeDateKey,
        courseId,
      );

      const result = await completeTrip({
        db: dbRefs.db,
        activeDateKey,
        serverTimeOffset,
        tripSnapshot: raw,
        adminUid: user?.uid ?? "unknown",
        dailyStatusSnapshot,
        totalStations: stations.length,
        courseId,
      });

      if (result.alreadyCompleted) {
        toast.info("تم إنهاء اليوم بالفعل — لم يتم إجراء أي تغييرات.");
      } else {
        toast.success(`تم إنهاء اليوم بنجاح! اليوم التالي: ${result.nextDateKey}`);
      }
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء إنهاء اليوم");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleStartDay = async () => {
    if (!dbRefs || !user) return;
    try {
      await Promise.all(
        activeCourses.map((c) =>
          startDay({
            db: dbRefs.db,
            activeDateKey,
            serverTimeOffset,
            adminUid: user.uid,
            courseId: c.id,
          }),
        ),
      );
      toast.success("تم بدء اليوم وتفعيل النظام للطلاب!");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء بدء اليوم");
    }
  };



  const [isMarkingFull, setIsMarkingFull] = useState(false);

  const handleMarkFull = async () => {
    if (!dbRefs || !displayedVehicle) return;

    if (!isControllingDisplayed) {
      toast.error("يرجى استلام المركبة أولاً لتتمكن من تغيير حالتها");
      return;
    }

    if (!displayedVehicle.currentStationId) {
      toast.error("يمكن تحديد امتلاء الباص فقط أثناء التواجد في محطة");
      return;
    }

    setIsMarkingFull(true);
    try {
      await markVehicleFull({
        db: dbRefs.db,
        vehicleId: displayedVehicle.id,
        currentStationId: displayedVehicle.currentStationId,
        adminUid: user?.uid ?? "unknown",
        serverTimeOffset,
        activeDateKey,
        courseId,
      });

      toast.warning("تم تأكيد امتلاء الباص — التوجه مباشرة إلى كرياتيفا");
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء تسجيل امتلاء الباص");
    } finally {
      setIsMarkingFull(false);
    }
  };

  const handleDepartStation = async () => {
    if (!dbRefs || !displayedVehicle) return;

    if (!isControllingDisplayed) {
      toast.error("يرجى استلام المركبة أولاً لتتمكن من تحريكها");
      return;
    }

    if (!displayedVehicle.currentStationId) {
      toast.error("المركبة في حالة حركة بالفعل");
      return;
    }

    const isVehicleFull =
      displayedVehicle.status === "full" || Boolean(displayedVehicle.isFull);
    const currentIndex = stations.findIndex(
      (s) =>
        s.id === displayedVehicle.currentStationId ||
        s.matchedIds?.includes(displayedVehicle.currentStationId!),
    );
    const isLastPickupStation = isVehicleFull || currentIndex === stations.length - 1;

    try {
      await departStation({
        db: dbRefs.db,
        vehicleId: displayedVehicle.id,
        currentStationId: displayedVehicle.currentStationId,
        nextStationId: isLastPickupStation
          ? "creativa"
          : (stations[currentIndex + 1]?.id ?? "creativa"),
        isFinalPickup: isLastPickupStation,
        serverTimeOffset,
        adminUid: user?.uid ?? "unknown",
        activeDateKey,
        isFull: isVehicleFull,
      });

      toast.success(
        isVehicleFull
          ? "الباص ممتلئ — يتحرك الآن مباشرة نحو كرياتيفا!"
          : isLastPickupStation
            ? "الباص يتحرك الآن نحو كرياتيفا (الوجهة النهائية)!"
            : "الباص يتحرك الآن للنقطة التالية!",
      );
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء مغادرة النقطة");
    }
  };

  const handleArriveAtStation = async () => {
    if (!dbRefs || stations.length === 0 || !displayedVehicle || !isControllingDisplayed) return;

    const isVehicleFull =
      displayedVehicle.status === "full" || Boolean(displayedVehicle.isFull);

    // Arriving at final destination Creativa (including when marked full)
    if (
      isVehicleFull ||
      displayedVehicle.nextStationId === "creativa" ||
      (displayedVehicle.lastStationId === stations[stations.length - 1]?.id && !displayedVehicle.currentStationId)
    ) {
      setShowEndTripDialog(true);
      return;
    }

    if (!displayedVehicle.nextStationId) return;

    try {
      const nextIndex = stations.findIndex(
        (s) =>
          s.id === displayedVehicle.nextStationId ||
          s.matchedIds?.includes(displayedVehicle.nextStationId!),
      );
      const isNextStationLastPickup = nextIndex === stations.length - 1;

      await arriveAtStation({
        db: dbRefs.db,
        vehicleId: displayedVehicle.id,
        stationId: displayedVehicle.nextStationId,
        nextStationId: isNextStationLastPickup ? "creativa" : stations[nextIndex + 1].id,
        isLastPickup: isNextStationLastPickup,
        serverTimeOffset,
        adminUid: user?.uid ?? "unknown",
        activeDateKey,
      });

      toast.success(`تم الوصول إلى نقطة ${stations[nextIndex].name}`);
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء الوصول للنقطة");
    }
  };

  const coursesMap = useMemo(() => {
    const map: Record<string, string> = { default: "الكورس الأساسي" };
    courses.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [courses]);

  const handleToggleBoarding = async (userId: string, currentBoardedState: boolean) => {
    if (!dbRefs || !displayedVehicle || !isControllingDisplayed) return;
    try {
      const studentUser = users.find((u) => u.uid === userId || u.id === userId);
      if (studentUser?.role === "student" && studentUser.paymentStatus && studentUser.paymentStatus !== "active") {
        toast.error("لا يمكن تسجيل ركوب طالب لم يتم تفعيل اشتراكه بعد");
        return;
      }
      const studentCourseId = studentUser?.courseId || "default";

      if (currentBoardedState) {
        // They are boarded, so we unboard them
        await TripRepository.unboardStudent(
          dbRefs.db,
          activeDateKey,
          userId,
          displayedVehicle.id,
          user?.uid ?? "unknown",
          studentCourseId,
        );
      } else {
        // They are NOT boarded, so we board them
        await TripRepository.boardStudent(
          dbRefs.db,
          activeDateKey,
          userId,
          displayedVehicle.id,
          user?.uid ?? "unknown",
          studentCourseId,
        );
      }
    } catch (e) {
      handleTripError(e, "حدث خطأ أثناء تحديث حالة الطالب");
    }
  };

  const isVehicleFull = Boolean(
    displayedVehicle &&
      (displayedVehicle.status === "full" || displayedVehicle.isFull),
  );

  const isHeadingToCreativa =
    isVehicleFull ||
    nextStationId === "creativa" ||
    lastStationId === stations[stations.length - 1]?.id;

  // Filter passengers by station for Live Boarding with optional course filter
  const getStationPassengers = (stationOrId: OperationalStation | string) => {
    let matchedIds: Set<string>;
    if (typeof stationOrId === "string") {
      const foundStation = stations.find(
        (s) => s.id === stationOrId || s.matchedIds?.includes(stationOrId),
      );
      matchedIds = new Set(foundStation?.matchedIds || [stationOrId]);
    } else {
      matchedIds = new Set(stationOrId.matchedIds || [stationOrId.id]);
    }

    return passengers
      .filter((p: DailyRecord) => {
        if (p.status !== "riding" || !matchedIds.has(p.station)) return false;
        if (selectedCourseFilter !== "all") {
          const studentCourse =
            p.courseId ||
            users.find((u) => u.uid === p.id || u.id === p.id)?.courseId ||
            "default";
          return studentCourse === selectedCourseFilter;
        }
        return true;
      })
      .map((p: DailyRecord) => {
        const record = recordsByStudent[p.id];
        const isBoarded = record?.status === "boarded";
        const vehicleName = isBoarded && record?.vehicleId
          ? getVehicleLabelById(record.vehicleId, vehicles)
          : undefined;
        const studentCourse = p.courseId || users.find((u) => u.uid === p.id || u.id === p.id)?.courseId || "default";
        const courseName = coursesMap[studentCourse] || studentCourse;
        return {
          id: p.id,
          name: p.fullName || (p.isStaff ? "موظف" : "طالب"),
          phone: p.phone || "---",
          boarded: isBoarded,
          isStaff: p.isStaff,
          courseId: studentCourse,
          courseName,
          vehicleName,
          locationLink: p.customLocation
            ? `https://maps.google.com/?q=${p.customLocation.lat},${p.customLocation.lng}`
            : undefined,
        };
      });
  };

  const customLocationPassengers = passengers
    .filter((p: any) => {
      if (p.status !== "riding" || p.station !== "custom") return false;
      if (selectedCourseFilter !== "all") {
        const studentCourse = p.courseId || users.find((u) => u.uid === p.id || u.id === p.id)?.courseId || "default";
        return studentCourse === selectedCourseFilter;
      }
      return true;
    })
    .map((p: any) => {
      const record = recordsByStudent[p.id];
      const isBoarded = record?.status === "boarded";
      const vehicleName = isBoarded && record?.vehicleId
        ? getVehicleLabelById(record.vehicleId, vehicles)
        : undefined;
      const studentCourse = p.courseId || users.find((u) => u.uid === p.id || u.id === p.id)?.courseId || "default";
      const courseName = coursesMap[studentCourse] || studentCourse;
      return {
        id: p.id,
        name: p.fullName || (p.isStaff ? "موظف" : "طالب"),
        phone: p.phone || "---",
        boarded: isBoarded,
        isStaff: p.isStaff,
        courseId: studentCourse,
        courseName,
        vehicleName,
        customLocationName: p.customLocation?.name,
        locationLink: p.customLocation
          ? `https://maps.google.com/?q=${p.customLocation.lat},${p.customLocation.lng}`
          : undefined,
      };
    });

  // Course distribution statistics for boarded passengers
  const courseStats = useMemo(() => {
    const stats: Record<string, { total: number; boarded: number; name: string }> = {};

    activeCourses.forEach((c) => {
      stats[c.id] = { total: 0, boarded: 0, name: c.name };
    });

    let totalBoarded = 0;
    let totalRiding = 0;

    passengers.forEach((p) => {
      if (p.status === "riding" && isStationSelected(p.station)) {
        totalRiding++;
        const cId = p.courseId || users.find((u) => u.uid === p.id || u.id === p.id)?.courseId || "default";
        
        const record = recordsByStudent[p.id];
        const isBoarded = record?.status === "boarded" || p.boarded;

        if (isBoarded) {
          totalBoarded++;
        }

        if (stats[cId]) {
          stats[cId].total++;
          if (isBoarded) {
            stats[cId].boarded++;
          }
        }
      }
    });

    return {
      totalRiding,
      totalBoarded,
      byCourse: Object.entries(stats)
        .filter(([_, data]) => data.total > 0 || data.boarded > 0)
        .map(([id, data]) => ({
          courseId: id,
          courseName: data.name,
          total: data.total,
          boarded: data.boarded,
        })),
    };
  }, [passengers, users, recordsByStudent, activeCourses, coursesMap]);

  const customStudentMarkers = useMemo(() => {
    return passengers
      .filter((p: any) => p.status === "riding" && p.station === "custom" && p.customLocation?.lat && p.customLocation?.lng)
      .map((p: any) => ({
        id: p.id,
        studentName: p.fullName || (p.isStaff ? "موظف" : "طالب"),
        locationName: p.customLocation.name || "موقع مخصص",
        lat: Number(p.customLocation.lat),
        lng: Number(p.customLocation.lng),
      }));
  }, [passengers]);

  // Show trip is in pre-planning (pending) mode — "planning" is only relevant before trip starts
  const showPlanningPanel = tripStatus === "pending";

  const isOperationalMode = Boolean(
    displayedVehicle &&
      !showPlanningPanel &&
      (displayedVehicle.status === "running" || displayedVehicle.status === "full"),
  );

  const currentStation = displayedVehicle?.currentStationId
    ? stations.find(
        (s) =>
          s.id === displayedVehicle.currentStationId ||
          s.matchedIds?.includes(displayedVehicle.currentStationId!),
      )
    : null;
  const currentStationName = currentStation?.name || null;

  const nextStation = displayedVehicle?.nextStationId
    ? displayedVehicle.nextStationId === "creativa"
      ? { id: "creativa", name: "كرياتيفا" }
      : stations.find(
          (s) =>
            s.id === displayedVehicle.nextStationId ||
            s.matchedIds?.includes(displayedVehicle.nextStationId!),
        )
    : null;
  const nextStationName = nextStation?.name || null;

  const currentStationIndex = displayedVehicle?.currentStationId
    ? stations.findIndex(
        (s) =>
          s.id === displayedVehicle.currentStationId ||
          s.matchedIds?.includes(displayedVehicle.currentStationId!),
      )
    : -1;

  const isLastStation = Boolean(
    displayedVehicle?.currentStationId &&
      currentStationIndex === stations.length - 1,
  );

  const stationProgress = useMemo(() => {
    if (stations.length === 0) return null;
    if (currentStationIndex >= 0) {
      return { current: currentStationIndex + 1, total: stations.length };
    }
    if (displayedVehicle?.nextStationId) {
      const nIdx = stations.findIndex(
        (s) =>
          s.id === displayedVehicle.nextStationId ||
          s.matchedIds?.includes(displayedVehicle.nextStationId!),
      );
      if (nIdx >= 0) {
        return { current: nIdx + 1, total: stations.length };
      }
    }
    return null;
  }, [stations, currentStationIndex, displayedVehicle?.nextStationId]);

  const activeStationPassengers = useMemo(() => {
    if (!displayedVehicle?.currentStationId) return [];
    return getStationPassengers(displayedVehicle.currentStationId);
  }, [displayedVehicle?.currentStationId, passengers, selectedCourseFilter, recordsByStudent, coursesMap, getStationPassengers]);

  const unboardedAtCurrentStation = useMemo(() => {
    return activeStationPassengers.filter((p) => !p.boarded).length;
  }, [activeStationPassengers]);

  const otherStationsWithPassengers = useMemo(() => {
    if (!displayedVehicle?.currentStationId) return [];
    return stations.filter((s) => {
      const isCurrent =
        s.id === displayedVehicle.currentStationId ||
        s.matchedIds?.includes(displayedVehicle.currentStationId!);
      if (isCurrent) return false;
      const sp = getStationPassengers(s);
      return sp.length > 0;
    });
  }, [stations, displayedVehicle?.currentStationId, getStationPassengers]);

  if (stationsLoading) {
    return (
      <div className="space-y-5 pt-2 pb-20">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 lg:space-y-5 pt-2 relative ${isOperationalMode ? "pb-60 sm:pb-52 lg:pb-20" : "pb-20"}`}>
      <div className={`px-1 ${isOperationalMode ? "hidden sm:block" : ""}`}>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">إدارة الرحلة والتخطيط</h1>
        <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-0.5">
          التحكم في المركبات ومتابعةالطلاب
        </p>
      </div>

      {/* Persistent Operational Header for Live Trip */}
      {isOperationalMode && displayedVehicle && (
        <div className="sticky top-14 z-20">
          <OperationalHeader
            vehicle={displayedVehicle}
            vehicles={vehicles}
            onSelectVehicle={setSelectedVehicleId}
            currentStationName={currentStationName}
            nextStationName={nextStationName}
            stationProgress={stationProgress}
            boardedCount={courseStats.totalBoarded}
            totalPassengers={courseStats.totalRiding}
            isControlling={isControllingDisplayed}
            isMoving={!displayedVehicle.currentStationId}
            isHeadingToCreativa={isHeadingToCreativa}
            isFull={isVehicleFull}
          />
        </div>
      )}

      {/* Segmented Control for Mobile (Non-operational mode only) */}
      {displayedVehicle && !showPlanningPanel && !isOperationalMode && (
        <div className="flex mb-5 border-b border-border/50 sticky top-16 z-30 bg-background/95 backdrop-blur-sm lg:hidden mx-[-16px] px-4 w-[calc(100%+32px)]">
          <button
            className={`flex-1 py-3.5 text-center font-bold text-sm relative transition-colors ${activeTab === "trip" ? "text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
            onClick={() => setActiveTab("trip")}
          >
            حالة المركبة
            {activeTab === "trip" && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-sm" />
            )}
          </button>
          <button
            className={`flex-1 py-3.5 text-center font-bold text-sm relative transition-colors ${activeTab === "passengers" ? "text-primary" : "text-muted-foreground hover:bg-muted/30"}`}
            onClick={() => setActiveTab("passengers")}
          >
            الركاب
            {activeTab === "passengers" && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-sm" />
            )}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        <div
          className={`lg:col-span-4 space-y-5 ${isOperationalMode ? "hidden lg:block" : (activeTab !== "trip" ? "hidden lg:block" : "block")}`}
        >
          {/* Vehicle Planning Panel — shown before trip starts */}
          {showPlanningPanel && (
            <VehiclePlanning
              vehicles={vehicles}
              confirmedPassengers={confirmedPassengers.length}
              confirmedStudents={confirmedStudentsCount}
              confirmedStaff={confirmedStaffCount}
              onAddVehicle={handleAddVehicle}
              onRemoveVehicle={handleRemoveVehicle}
              onUpdateCapacity={handleUpdateCapacity}
              onStartDay={handleStartDay}
            />
          )}

          {/* Active Vehicles Panel — shown once trip starts. Keep visible always */}
          {!showPlanningPanel && (
            <>
              <ActiveVehicles
                vehicles={vehicles}
                adminUid={user?.uid ?? "unknown"}
                onTakeControl={handleTakeControl}
                onReleaseControl={handleReleaseControl}
                onSelectVehicle={setSelectedVehicleId}
                selectedVehicleId={displayedVehicle?.id}
              />
              {vehicles.length > 0 && vehicles.every(v => v.status === "ended") && (
                <div className="bg-card shadow-card rounded-2xl p-4 border border-border mt-5 flex flex-col items-center justify-center text-center">
                  <h3 className="text-lg font-bold text-foreground mb-2">اكتملت جميع رحلات اليوم</h3>
                  <p className="text-[13px] text-muted-foreground mb-4">
                    تم إنهاء جميع المركبات بنجاح. يمكنك الآن إنهاء اليوم والانتقال لليوم التالي.
                  </p>
                  <Button
                    size="lg"
                    onClick={handleEndDay}
                    disabled={isCompleting}
                    className="w-full sm:w-auto px-8 gap-2 font-semibold shadow-sm"
                  >
                    {isCompleting ? "جاري الإنهاء..." : "إنهاء اليوم والانتقال لليوم التالي"}
                  </Button>
                </div>
              )}
            </>
          )}

          {displayedVehicle && !showPlanningPanel && (
            <>
              <VehicleControls
                vehicle={displayedVehicle}
                onTakeControl={handleStartTrip}
                onReleaseControl={() => handleReleaseControl(displayedVehicle.id)}
                onDepartStation={(displayedVehicle.currentStationId && isControllingDisplayed && !isOperationalMode) ? handleDepartStation : undefined}
                onEndVehicle={handleEndTrip}
                endVehicleDisabled={isCompleting || !isControllingDisplayed}
                endVehicleLoading={isCompleting}
                canTakeControl={isControllingDisplayed}
              />

              <div className="h-[250px] rounded-2xl overflow-hidden border border-border/50 shadow-sm relative z-0">
                <AdminStationsMap
                  stations={stations}
                  customLocationMarkers={customStudentMarkers}
                  activeStationId={displayedVehicle.currentStationId || displayedVehicle.nextStationId}
                />
              </div>

              <StationTimeline
                status={
                  displayedVehicle.status === "running" || displayedVehicle.status === "full"
                    ? displayedVehicle.currentStationId
                      ? "waiting_at_station"
                      : "moving"
                    : displayedVehicle.status === "planned"
                      ? "pending"
                      : "completed"
                }
                currentStationId={displayedVehicle.currentStationId || null}
                lastStationId={displayedVehicle.lastStationId || null}
                nextStationId={displayedVehicle.nextStationId || null}
                isFull={isVehicleFull}
                markedFullStationId={displayedVehicle.markedFullStationId || null}
              />
            </>
          )}
        </div>

        <div
          className={`lg:col-span-8 space-y-5 ${isOperationalMode ? "block" : (activeTab !== "passengers" ? "hidden lg:block" : "block")}`}
        >
          {!displayedVehicle || showPlanningPanel ? (
            <TripSummary passengers={passengers} stations={stations} courses={activeCourses} allCourseStations={allCourseStations} />
          ) : displayedVehicle.status === "running" || displayedVehicle.status === "full" ? (
            <motion.div
              className="space-y-4 sm:space-y-5"
              initial={mounted ? false : "hidden"}
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 }
                }
              }}
            >
              {/* 1. COURSE FILTER BAR (Directly above boarding list, clean & integrated) */}
              <motion.div
                initial={mounted ? false : "hidden"}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="bg-card rounded-2xl p-3 sm:p-4 shadow-card border border-border/60 space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-bold text-foreground">ركاب الحافلة</span>
                    <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      صعد {courseStats.totalBoarded} من {courseStats.totalRiding}
                    </span>
                  </div>

                  {/* Course Filter Dropdown */}
                  <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
                    <label htmlFor="course-filter-select" className="text-muted-foreground font-semibold shrink-0">
                      تصفية الكورس:
                    </label>
                    <select
                      id="course-filter-select"
                      value={selectedCourseFilter}
                      onChange={(e) => setSelectedCourseFilter(e.target.value)}
                      className="bg-muted border border-border/80 text-foreground rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                    >
                      <option value="all">جميع الكورسات النشطة (افتراضي)</option>
                      {activeCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Course Distribution Pills (Quick Tap) */}
                {courseStats.byCourse.length > 1 && (
                  <div className="flex gap-1.5 pt-2 border-t border-border/40 items-center overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedCourseFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                        selectedCourseFilter === "all"
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : "bg-muted/60 hover:bg-muted text-foreground border border-border/40"
                      }`}
                    >
                      <Users className="w-3 h-3 shrink-0" />
                      <span>الكل</span>
                    </button>
                    {courseStats.byCourse.map((c) => (
                      <button
                        key={c.courseId}
                        type="button"
                        onClick={() =>
                          setSelectedCourseFilter(
                            selectedCourseFilter === c.courseId ? "all" : c.courseId,
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                          selectedCourseFilter === c.courseId
                            ? "bg-primary text-primary-foreground font-bold shadow-sm"
                            : "bg-muted/60 hover:bg-muted text-foreground border border-border/40"
                        }`}
                      >
                        <GraduationCap className="w-3 h-3 shrink-0" />
                        <span>{c.courseName}:</span>
                        <span className={selectedCourseFilter === c.courseId ? "text-primary-foreground font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                          {c.boarded}
                        </span>
                        <span className={selectedCourseFilter === c.courseId ? "text-primary-foreground/80 text-[11px]" : "text-muted-foreground text-[11px]"}>
                          / {c.total}
                        </span>
                      </button>
                    ))}
                    {selectedCourseFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setSelectedCourseFilter("all")}
                        className="text-[11px] text-primary hover:underline font-semibold mr-1 shrink-0"
                      >
                        إعادة ضبط (عرض الكل)
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* 2. WHEN WAITING AT STATION: HERO BOARDING LIST FOR CURRENT STATION */}
              {displayedVehicle.currentStationId && currentStation && (
                <motion.div
                  key={currentStation.id}
                  initial={mounted ? false : "hidden"}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  className="ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl bg-card shadow-lg"
                >
                  <BoardingList
                    stationName={currentStation.name}
                    passengers={activeStationPassengers}
                    onConfirmBoarding={(id) => {
                      const p = activeStationPassengers.find((x) => x.id === id);
                      if (p) return handleToggleBoarding(p.id, p.boarded);
                    }}
                    onDepartStation={(isControllingDisplayed && !isOperationalMode) ? handleDepartStation : undefined}
                    isLastStation={isLastStation}
                    isFull={isVehicleFull}
                    isCurrentStation={true}
                  />
                </motion.div>
              )}

              {/* 3. WHEN MOVING: MOVING BANNER + NEXT STATION PASSENGERS PREVIEW */}
              {!displayedVehicle.currentStationId && (
                <motion.div
                  initial={mounted ? false : "hidden"}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  className="space-y-4"
                >
                  <div className="bg-card rounded-2xl p-5 sm:p-7 shadow-card flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-2.5">
                      <Bus className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">
                      {isHeadingToCreativa ? "الباص في طريقه إلى كرياتيفا" : "الباص يتحرك الآن"}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-muted-foreground mb-4 max-w-sm">
                      {isHeadingToCreativa
                        ? "الباص في طريقه إلى الوجهة النهائية (مركز كرياتيفا). عند الوصول، اضغط لإنهاء الرحلة."
                        : `الباص في طريقه نحو ${nextStationName || "المحطة التالية"}. اضغط لتأكيد التوقف وبدء صعود الركاب.`}
                    </p>

                    <LongPressButton
                      size="lg"
                      onComplete={handleArriveAtStation}
                      className="w-full sm:w-auto px-6 sm:px-8 gap-2 font-semibold shadow-sm text-xs sm:text-sm h-11 sm:h-12 rounded-xl"
                    >
                      {isHeadingToCreativa ? (
                        <>
                          <Flag className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                          الوصول إلى كرياتيفا وإنهاء الرحلة (اضغط مطولاً)
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                          الوصول إلى {nextStationName || "المحطة التالية"} (اضغط مطولاً)
                        </>
                      )}
                    </LongPressButton>
                  </div>

                  {/* Next Station Passengers Waiting to Board */}
                  {nextStation && nextStation.id !== "creativa" && (
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-bold text-muted-foreground px-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>الركاب في انتظار الوصول إلى: {nextStation.name}</span>
                      </div>
                      <BoardingList
                        stationName={nextStation.name}
                        passengers={getStationPassengers(nextStation)}
                        onConfirmBoarding={(id) => {
                          const sp = getStationPassengers(nextStation);
                          const p = sp.find((x) => x.id === id);
                          if (p) return handleToggleBoarding(p.id, p.boarded);
                        }}
                        isLastStation={nextStation.id === stations[stations.length - 1]?.id}
                        isFull={isVehicleFull}
                        isCurrentStation={false}
                      />
                    </div>
                  )}
                </motion.div>
              )}

              {/* 4. OTHER STATIONS WITH REGISTERED PASSENGERS */}
              {displayedVehicle.currentStationId && otherStationsWithPassengers.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-muted-foreground px-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>محطات أخرى في المسار ({otherStationsWithPassengers.length})</span>
                  </div>
                  {otherStationsWithPassengers.map((station) => {
                    const sp = getStationPassengers(station);
                    return (
                      <motion.div
                        key={station.id}
                        initial={mounted ? false : "hidden"}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        className="opacity-90 hover:opacity-100 transition-opacity"
                      >
                        <BoardingList
                          stationName={station.name}
                          passengers={sp}
                          onConfirmBoarding={(id) => {
                            const p = sp.find((x) => x.id === id);
                            if (p) return handleToggleBoarding(p.id, p.boarded);
                          }}
                          isLastStation={station.id === stations[stations.length - 1]?.id}
                          isFull={isVehicleFull}
                          isCurrentStation={false}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* 5. CUSTOM LOCATION PASSENGERS */}
              {customLocationPassengers.length > 0 && (
                <motion.div initial={mounted ? false : "hidden"} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-2 opacity-90 hover:opacity-100 transition-opacity">
                  <BoardingList
                    stationName="ركاب في مواقع مخصصة"
                    passengers={customLocationPassengers}
                    onConfirmBoarding={(id) => {
                      const p = customLocationPassengers.find((x) => x.id === id);
                      if (p) return handleToggleBoarding(p.id, p.boarded);
                    }}
                    onDepartStation={undefined}
                    isLastStation={false}
                    isFull={isVehicleFull}
                    isCurrentStation={false}
                  />
                </motion.div>
              )}

              {/* 6. MOBILE MAP & TIMELINE COLLAPSIBLE (Placed at bottom, collapsed by default) */}
              {isOperationalMode && displayedVehicle && (
                <div className="lg:hidden pt-2">
                  <Collapsible defaultOpen={false} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/40 transition-colors text-right cursor-pointer"
                      >
                        <span className="text-xs font-bold text-foreground flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-primary shrink-0" />
                          <span>خريطة ومسار الرحلة (عرض الخريطة والمحطات)</span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3.5 space-y-3 border-t border-border/40">
                      <div className="h-[200px] rounded-xl overflow-hidden border border-border/50 relative z-0">
                        <AdminStationsMap
                          stations={stations}
                          customLocationMarkers={customStudentMarkers}
                          activeStationId={displayedVehicle.currentStationId || displayedVehicle.nextStationId}
                        />
                      </div>
                      <StationTimeline
                        status={
                          displayedVehicle.status === "running" || displayedVehicle.status === "full"
                            ? displayedVehicle.currentStationId
                              ? "waiting_at_station"
                              : "moving"
                            : displayedVehicle.status === "planned"
                              ? "pending"
                              : "completed"
                        }
                        currentStationId={displayedVehicle.currentStationId || null}
                        lastStationId={displayedVehicle.lastStationId || null}
                        nextStationId={displayedVehicle.nextStationId || null}
                        isFull={isVehicleFull}
                        markedFullStationId={displayedVehicle.markedFullStationId || null}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </motion.div>
          ) : displayedVehicle.status === "ended" ? (
            <div className="bg-card rounded-2xl p-8 shadow-card flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center text-success">
                <CheckCircle2 className="w-8 h-8" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">اكتملت الرحلة بنجاح</h3>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
                  وصل الباص إلى الوجهة النهائية (مركز كرياتيفا). جاري الانتقال لليوم التالي...
                </p>
              </div>
            </div>
          ) : (
            <TripSummary passengers={passengers} stations={stations} courses={activeCourses} allCourseStations={allCourseStations} />
          )}
        </div>
      </div>

      {/* Persistent Operational Bottom Action Bar */}
      {isOperationalMode && displayedVehicle && (
        <OperationalBottomBar
          vehicle={displayedVehicle}
          isControlling={isControllingDisplayed}
          currentStationId={displayedVehicle.currentStationId || null}
          currentStationName={currentStationName}
          nextStationId={displayedVehicle.nextStationId || null}
          nextStationName={nextStationName}
          isLastStation={isLastStation}
          isHeadingToCreativa={isHeadingToCreativa}
          unboardedCountAtCurrentStation={unboardedAtCurrentStation}
          onDepartStation={handleDepartStation}
          onArriveAtStation={handleArriveAtStation}
          isCompleting={isCompleting}
          isFull={isVehicleFull}
          onMarkFull={handleMarkFull}
          isMarkingFull={isMarkingFull}
        />
      )}

      <AlertDialog open={showEndTripDialog} onOpenChange={setShowEndTripDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من رغبتك في إنهاء الرحلة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيؤدي هذا الإجراء إلى إنهاء مسار المركبة الحالي وإعلام جميع الطلاب بأنه تم اكتمال الرحلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEndTripDialog(false);
                handleEndTrip();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              إنهاء الرحلة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
