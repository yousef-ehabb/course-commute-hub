export const STATIONS = [
  { id: "kornish", name: "الكورنيش المحطة", detail: "قدام مبنى المحافظة", time: "09:00" },
  { id: "abbas", name: "عباس فريد", detail: "الكورنيش قدام شركة اتصالات", time: "09:05" },
  { id: "hakim", name: "مول الحكيم", detail: "", time: "09:10" },
  { id: "stadium", name: "الاستاد", detail: "", time: "09:15" },
  { id: "taameen", name: "التأمين", detail: "بجوار بنزينة الوطنية قدام مستشفى التأمين", time: "09:20" },
] as const;

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