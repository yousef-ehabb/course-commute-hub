import { Station } from "@/contexts/StationsContext";

export const STATION_UNSELECTED_MSG = "لم يتم اختيار نقطة التجمع بعد";
export const STATION_DELETED_MSG = "تم حذف نقطة التجمع";
export const STATION_CUSTOM_MSG = "موقع مخصص";
export const STATION_UNKNOWN_MSG = "نقطة غير متوفرة";

/**
 * Checks if a station ID represents a valid selected station or custom location (i.e. not empty/unassigned).
 */
export function isStationSelected(stationId: string | undefined | null): boolean {
  if (!stationId) return false;
  const trimmed = stationId.trim();
  if (trimmed === "" || trimmed === "unassigned" || trimmed === "none" || trimmed === "unknown") {
    return false;
  }
  return true;
}

/**
 * Resolves a station ID to its friendly Arabic name.
 * Differentiates between unselected station vs deleted station.
 */
export function getStationName(
  stationId: string | undefined | null,
  stations: Station[],
  customLocationName?: string | null,
): string {
  if (!isStationSelected(stationId)) return STATION_UNSELECTED_MSG;
  if (stationId === "custom") {
    return customLocationName?.trim() ? `موقع مخصص (${customLocationName.trim()})` : STATION_CUSTOM_MSG;
  }

  const station = stations.find((s) => s.id === stationId);
  return station ? station.name : STATION_DELETED_MSG;
}

/**
 * Returns the full Station object if it exists.
 */
export function getStation(
  stationId: string | undefined | null,
  stations: Station[],
): Station | undefined {
  if (!isStationSelected(stationId) || stationId === "custom") return undefined;
  return stations.find((s) => s.id === stationId);
}
