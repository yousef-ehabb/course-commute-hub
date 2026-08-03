import { Vehicle, VEHICLE_DEFAULTS } from "@/types";

/**
 * Returns a human-readable label for a vehicle (e.g., "🚌 أتوبيس 1", "🚐 ميكروباص 2", "🚌 أتوبيس").
 * Numbering is calculated relative to all vehicles of the same type.
 */
export function getVehicleLabel(vehicleId: string, vehicles: Vehicle[]): string {
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return "";

  const defaults = VEHICLE_DEFAULTS[vehicle.type] || { emoji: "🚐", labelAr: "مركبة" };
  const sameTypeVehicles = vehicles.filter((v) => v.type === vehicle.type);

  let label = defaults.labelAr;
  if (sameTypeVehicles.length > 1) {
    const index = sameTypeVehicles.findIndex((v) => v.id === vehicle.id);
    if (index !== -1) {
      label = `${defaults.labelAr} ${index + 1}`;
    }
  }

  return `${defaults.emoji} ${label}`;
}
