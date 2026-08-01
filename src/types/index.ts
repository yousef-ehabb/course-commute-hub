export type UserRole = "student" | "admin";

export interface UserProfile {
  uid: string;
  fullName: string;
  phone: string;
  nationalId: string;
  defaultStation: string;
  role: UserRole;
  courseId?: string;
  createdAt: number;
}

export interface DailyStatus {
  status: "riding" | "cancelled";
  station: string;
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
