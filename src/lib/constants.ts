// Stations are now loaded dynamically from Firebase via StationsContext

export const VEHICLE_LIMITS = { microbus: 14, minibus: 33, bus: 50 } as const;
export const DEFAULT_CUTOFF_TIME = "22:00";

export function suggestVehicle(count: number): "microbus" | "minibus" | "bus" {
  if (count <= VEHICLE_LIMITS.microbus) return "microbus";
  if (count <= VEHICLE_LIMITS.minibus) return "minibus";
  return "bus";
}

export const VEHICLE_LABEL: Record<string, string> = {
  microbus: "ميكروباص",
  minibus: "ميني باص",
  bus: "أتوبيس",
};
