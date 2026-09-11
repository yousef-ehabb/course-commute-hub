import { Station } from "@/contexts/StationsContext";

export const STATION_UNSELECTED_MSG = "لم يتم اختيار نقطة التجمع بعد";
export const STATION_DELETED_MSG = "تم حذف نقطة التجمع";
export const STATION_CUSTOM_MSG = "موقع مخصص";
export const STATION_UNKNOWN_MSG = "نقطة غير متوفرة";

export interface OperationalStation extends Station {
  /** All station IDs from different active courses that map to this operational stop */
  matchedIds: string[];
}

/**
 * Checks if a station ID represents a valid selected station or custom location (i.e. not empty/unassigned).
 */
export function isStationSelected(stationId: string | undefined | null): stationId is string {
  if (!stationId) return false;
  const trimmed = stationId.trim();
  if (trimmed === "" || trimmed === "unassigned" || trimmed === "none" || trimmed === "unknown") {
    return false;
  }
  return true;
}

/**
 * Normalizes Arabic station names for robust cross-course matching:
 * - strips diacritics & extra whitespace
 * - unifies alef forms ([أإآ] -> ا)
 * - unifies taa marbuta & haa (ة -> ه)
 * - unifies yaa & alef maksura (ى -> ي)
 */
export function normalizeStationName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

const KNOWN_STATION_KEYWORDS = [
  "محطه",
  "عباس فريد",
  "حكيم",
  "استاد",
  "تامين",
  "رضوان",
  "صفا",
  "شرطه",
];

/**
 * Determines whether two station objects represent the same real-world physical stop.
 */
export function areStationsEquivalent(
  s1: { id?: string; name: string; latitude?: number; longitude?: number },
  s2: { id?: string; name: string; latitude?: number; longitude?: number },
): boolean {
  if (s1.id && s2.id && s1.id === s2.id) return true;

  const n1 = normalizeStationName(s1.name);
  const n2 = normalizeStationName(s2.name);

  if (n1 && n2) {
    if (n1 === n2) return true;
    for (const kw of KNOWN_STATION_KEYWORDS) {
      if (n1.includes(kw) && n2.includes(kw)) return true;
    }
  }

  // If geographic coordinates are very close (< ~150 meters)
  if (s1.latitude && s1.longitude && s2.latitude && s2.longitude) {
    const latDiff = Math.abs(s1.latitude - s2.latitude);
    const lngDiff = Math.abs(s1.longitude - s2.longitude);
    if (latDiff < 0.0015 && lngDiff < 0.0015) return true;
  }

  return false;
}

export interface BuildOperationalStationsParams {
  selectedCourseId: string;
  selectedCourseFilter: string; // "all" | courseId
  activeCourses: { id: string; name: string }[];
  allCourseStations: Record<string, Station[]>;
  primaryStations?: Station[];
}

/**
 * Builds the operational station list for the Trips & Boarding workflow.
 *
 * When courseFilter === "all":
 * - Integrates stations across all ACTIVE courses.
 * - Merges stations representing the same real-world stop so their IDs are aliased in `matchedIds`.
 * - Preserves the base order from the primary course.
 *
 * When courseFilter === specific course:
 * - Exclusively resolves stations for that specific course.
 */
export function buildOperationalStations({
  selectedCourseId,
  selectedCourseFilter,
  activeCourses,
  allCourseStations,
  primaryStations = [],
}: BuildOperationalStationsParams): OperationalStation[] {
  // If specific course is selected in the display filter, show that course's stations
  if (selectedCourseFilter !== "all") {
    const targetStations =
      allCourseStations[selectedCourseFilter] ||
      (selectedCourseFilter === selectedCourseId ? primaryStations : []);
    return targetStations.map((st) => ({
      ...st,
      matchedIds: [st.id],
    }));
  }

  // Cross-course operational route across ALL ACTIVE courses
  const unified: OperationalStation[] = [];

  // 1. Seed with base course stations (preserves route order)
  const baseStations =
    primaryStations && primaryStations.length > 0
      ? primaryStations
      : allCourseStations[selectedCourseId] || [];

  for (const st of baseStations) {
    unified.push({
      ...st,
      matchedIds: [st.id],
    });
  }

  // 2. Iterate through all active courses to unify matching stations and append unique stops
  for (const course of activeCourses) {
    const courseStations = allCourseStations[course.id] || [];
    for (const st of courseStations) {
      const match = unified.find((u) => areStationsEquivalent(u, st));
      if (match) {
        if (!match.matchedIds.includes(st.id)) {
          match.matchedIds.push(st.id);
        }
      } else {
        unified.push({
          ...st,
          matchedIds: [st.id],
        });
      }
    }
  }

  return unified;
}

/**
 * Resolves a station ID to its friendly Arabic name.
 * Supports both standard Station objects and OperationalStation objects with matchedIds.
 */
export function getStationName(
  stationId: string | undefined | null,
  stations: (Station | OperationalStation)[],
  customLocationName?: string | null,
): string {
  if (!isStationSelected(stationId)) return STATION_UNSELECTED_MSG;
  if (stationId === "custom") {
    return customLocationName?.trim()
      ? `موقع مخصص (${customLocationName.trim()})`
      : STATION_CUSTOM_MSG;
  }

  const station = stations.find(
    (s) =>
      s.id === stationId ||
      ("matchedIds" in s && Boolean(s.matchedIds?.includes(stationId))),
  );
  return station ? station.name : STATION_DELETED_MSG;
}

/**
 * Returns the full Station object if it exists.
 */
export function getStation(
  stationId: string | undefined | null,
  stations: (Station | OperationalStation)[],
): (Station | OperationalStation) | undefined {
  if (!isStationSelected(stationId) || stationId === "custom") return undefined;
  return stations.find(
    (s) =>
      s.id === stationId ||
      ("matchedIds" in s && Boolean(s.matchedIds?.includes(stationId))),
  );
}
