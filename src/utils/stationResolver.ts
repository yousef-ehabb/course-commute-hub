import { Station } from "@/contexts/StationsContext";

export const STATION_DELETED_MSG = "تم حذف نقطة التجمع";
export const STATION_CUSTOM_MSG = "موقع مخصص";
export const STATION_UNKNOWN_MSG = "نقطة غير متوفرة";

/**
 * Resolves a station ID to its friendly Arabic name.
 * Prevents raw IDs from being displayed in the UI.
 */
export function getStationName(stationId: string | undefined | null, stations: Station[]): string {
  if (!stationId) return STATION_UNKNOWN_MSG;
  if (stationId === "custom") return STATION_CUSTOM_MSG;

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
  if (!stationId || stationId === "custom") return undefined;
  return stations.find((s) => s.id === stationId);
}
