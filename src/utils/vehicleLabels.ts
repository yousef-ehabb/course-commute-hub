import type { Vehicle, VehicleType } from "@/types";

/**
 * Arabic ordinals for vehicle numbering (1-10).
 * Uses masculine form matching أتوبيس / ميكروباص.
 */
const ORDINALS: Record<number, string> = {
  1: "الأول",
  2: "الثاني",
  3: "الثالث",
  4: "الرابع",
  5: "الخامس",
  6: "السادس",
  7: "السابع",
  8: "الثامن",
  9: "التاسع",
  10: "العاشر",
};

/** Singular friendly labels (when only one of this type exists) */
const SINGULAR_LABELS: Record<VehicleType, string> = {
  bus: "الأتوبيس",
  microbus: "الميكروباص",
};

/** Base name used with ordinal numbering (when multiple of the same type) */
const PLURAL_BASE: Record<VehicleType, string> = {
  bus: "الأتوبيس",
  microbus: "الميكروباص",
};

/**
 * Generate a friendly Arabic label for a vehicle.
 *
 * - If there is only one vehicle of this type → "الأتوبيس" / "الميكروباص"
 * - If there are multiple of the same type → "الأتوبيس الأول", "الأتوبيس الثاني", etc.
 *
 * Vehicles are sorted by `createdAt` to keep ordering stable.
 */
export function getVehicleLabel(vehicle: Vehicle, allVehicles: Vehicle[]): string {
  const sameType = allVehicles
    .filter((v) => v.type === vehicle.type)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (sameType.length <= 1) {
    return SINGULAR_LABELS[vehicle.type] ?? "المركبة";
  }

  const index = sameType.findIndex((v) => v.id === vehicle.id);
  const ordinal = ORDINALS[index + 1] ?? `رقم ${index + 1}`;
  return `${PLURAL_BASE[vehicle.type]} ${ordinal}`;
}

/**
 * Convenience wrapper: look up a vehicle by ID, then return its label.
 * Returns an empty string if the vehicle is not found.
 */
export function getVehicleLabelById(vehicleId: string, allVehicles: Vehicle[]): string {
  const vehicle = allVehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return "";
  return getVehicleLabel(vehicle, allVehicles);
}

/**
 * Returns a generic "next vehicle" label for the banner when the current one is full.
 */
export function getNextVehicleLabel(fullVehicle: Vehicle, allVehicles: Vehicle[]): string {
  const sameType = allVehicles
    .filter((v) => v.type === fullVehicle.type)
    .sort((a, b) => a.createdAt - b.createdAt);

  const fullIndex = sameType.findIndex((v) => v.id === fullVehicle.id);

  // Check if there is a next vehicle of the same type
  if (fullIndex >= 0 && fullIndex < sameType.length - 1) {
    return getVehicleLabel(sameType[fullIndex + 1], allVehicles);
  }

  // Otherwise, check for any other available vehicle
  const otherAvailable = allVehicles.find(
    (v) => v.id !== fullVehicle.id && v.status === "running" && v.occupiedSeats < v.capacity
  );

  if (otherAvailable) {
    return getVehicleLabel(otherAvailable, allVehicles);
  }

  return "المركبة التالية";
}

/**
 * Arabic dual/plural for vehicle counts used in natural sentences.
 */
export function getVehicleCountText(count: number): string {
  if (count === 1) return "مركبة واحدة";
  if (count === 2) return "مركبتين";
  if (count >= 3 && count <= 10) return `${count} مركبات`;
  return `${count} مركبة`;
}
