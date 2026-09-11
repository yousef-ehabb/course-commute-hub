export type UserRole = "student" | "admin";

export type CourseStatus = "active" | "archived";

export interface CourseInfo {
  id: string;
  name: string;
  adminUid: string;
  status: CourseStatus;
  startDate: number;
  endDate?: number;
  createdAt: number;
  transportation?: {
    payment: {
      isFree: boolean;
      fee?: number; // legacy — kept for backward compat
      days?: number;
      dailyFee?: number;
    };
  };
  registrationDeadline?: number;
}

export type PaymentStatus = "active" | "pending_payment" | "payment_submitted" | "payment_rejected";

export interface UserProfile {
  uid: string;
  fullName: string;
  phone: string;
  nationalId: string;
  defaultStation: string;
  customLocation?: { lat: number; lng: number; name?: string };
  role: UserRole;
  courseId?: string;
  createdAt: number;
  paymentStatus?: PaymentStatus;
  paymentAmount?: number;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  status: "submitted" | "verified" | "approved" | "approved_cash" | "rejected";
  submittedAt?: number;
  verifiedAt?: number;
  verifiedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;
  paymentMethod?: string;
  createdAt: number;
}

export interface DailyStatus {
  status: "riding" | "cancelled" | "undecided";
  station: string;
  isStaff?: boolean;
  updatedAt: number;
}

// ── Phase 2: Multi-Vehicle Types ────────────────────────────────────────

export type VehicleType = "bus" | "microbus";

export type VehicleStatus = "planned" | "running" | "full" | "ended";

export interface Vehicle {
  id: string;
  type: VehicleType;
  capacity: number;
  occupiedSeats: number;
  status: VehicleStatus;
  assignedCoordinatorId: string | null;
  assignedCoordinatorName?: string | null;
  assignedAt: number | null;
  lastHeartbeatAt: number | null;
  trackingSessionId: string | null;
  currentLocation: { lat: number; lng: number; updatedAt?: number } | null;
  /** Station-level route progress (same fields as the old single-trip model) */
  currentStationId: string | null;
  nextStationId: string | null;
  lastStationId: string | null;
  licensePlate: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  isFull?: boolean;
  markedFullAt?: number | null;
  markedFullBy?: string | null;
  markedFullStationId?: string | null;
}

export interface BoardingRecord {
  id: string;
  studentId: string;
  vehicleId: string;
  status: "boarded" | "undone";
  boardedAt: number;
  boardedByCoordinatorId: string;
  undoneAt: number | null;
}

/** Default capacities for quick vehicle creation */
export const VEHICLE_DEFAULTS: Record<VehicleType, { label: string; labelAr: string; capacity: number; emoji: string }> = {
  bus: { label: "Bus", labelAr: "أتوبيس", capacity: 50, emoji: "🚌" },
  microbus: { label: "Microbus", labelAr: "ميكروباص", capacity: 14, emoji: "🚐" },
};
