/**
 * useVehicleTabState — state machine for the student vehicle tabs.
 *
 * Computes a tab descriptor for each vehicle with one of four states:
 *   - "active"  → vehicle is running, hasn't passed the student's station
 *   - "passed"  → vehicle departed past the student's pickup point (not boarded)
 *   - "boarded" → student is on this vehicle
 *   - "locked"  → another vehicle is "boarded", so this one is disabled
 *   - "ended"   → vehicle has completed its journey
 *
 * Also manages automatic tab selection:
 *   - Auto-selects the first active vehicle on mount
 *   - Auto-switches away from a vehicle that just became "passed"
 *   - Auto-locks to the boarded vehicle when boarding is detected
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Vehicle, BoardingRecord } from "@/types";
import type { Station } from "@/contexts/StationsContext";
import { getVehicleLabel } from "@/utils/vehicleLabels";
import { VEHICLE_DEFAULTS } from "@/types";

// ── Types ───────────────────────────────────────────────────────────────

export type VehicleTabState = "active" | "passed" | "boarded" | "locked" | "ended";

export interface VehicleTab {
  vehicle: Vehicle;
  label: string;
  emoji: string;
  state: VehicleTabState;
  /** Arabic badge text for quick status recognition */
  badge: string;
}

interface UseVehicleTabStateResult {
  /** Ordered array of tab descriptors for every vehicle */
  tabs: VehicleTab[];
  /** The currently selected tab's vehicle ID (or null if none) */
  selectedTabId: string | null;
  /** Switch to a tab (only allowed for active/boarded tabs) */
  setSelectedTabId: (id: string) => void;
  /** True when the student has been boarded — all other tabs are locked */
  isLockedToVehicle: boolean;
  /** The currently selected vehicle object (convenience) */
  selectedVehicle: Vehicle | null;
}

// ── Badge text ──────────────────────────────────────────────────────────

function getBadgeText(state: VehicleTabState, vehicle: Vehicle): string {
  switch (state) {
    case "boarded":
      return "أنت فيه";
    case "passed":
      return "عدّى";
    case "ended":
      return "وصل";
    case "active": {
      if (vehicle.status === "full") return "اكتمل";
      if (vehicle.currentStationId) return "في محطة";
      return "في الطريق";
    }
    case "locked":
      return "";
    default:
      return "";
  }
}

// ── Station index lookup ────────────────────────────────────────────────

function stationIndex(stationId: string | null, stations: Station[]): number {
  if (!stationId) return -1;
  // "creativa" is the final destination, always after all stations
  if (stationId === "creativa") return stations.length;
  return stations.findIndex((s) => s.id === stationId);
}

/**
 * Determine whether a vehicle has passed the student's default station.
 *
 * A vehicle is considered to have "passed" a station if its route progress
 * (lastStationId or currentStationId) is beyond the student's station index.
 *
 * - If the vehicle is currently AT the student's station → NOT passed yet
 *   (they might still board).
 * - If the vehicle's lastStationId is >= the student's station index,
 *   meaning it has departed FROM or BEYOND that station → PASSED.
 */
function hasVehiclePassed(
  vehicle: Vehicle,
  studentStationId: string | undefined,
  stations: Station[],
): boolean {
  if (!studentStationId) return false;
  if (vehicle.status !== "running" && vehicle.status !== "full") return false;

  const studentIdx = stationIndex(studentStationId, stations);
  if (studentIdx < 0) return false;

  // If the vehicle has a lastStationId (it departed from somewhere),
  // check if that departure point is at or past the student's station
  const lastIdx = stationIndex(vehicle.lastStationId, stations);
  if (lastIdx >= 0 && lastIdx >= studentIdx) return true;

  // If the vehicle is currently at a station beyond the student's station
  const currentIdx = stationIndex(vehicle.currentStationId, stations);
  if (currentIdx >= 0 && currentIdx > studentIdx) return true;

  return false;
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useVehicleTabState(
  vehicles: Vehicle[],
  boardingRecord: BoardingRecord | null,
  stations: Station[],
  studentDefaultStation: string | undefined,
): UseVehicleTabStateResult {
  const [selectedTabId, setSelectedTabIdRaw] = useState<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);

  // ── Boarding state ──────────────────────────────────────────────────

  const isBoarded = boardingRecord?.status === "boarded";
  const boardedVehicleId = isBoarded ? boardingRecord?.vehicleId ?? null : null;

  // ── Compute tab states ──────────────────────────────────────────────

  const tabs = useMemo<VehicleTab[]>(() => {
    // Sort vehicles by creation order for stable ordering
    const sorted = [...vehicles].sort((a, b) => a.createdAt - b.createdAt);

    return sorted.map((vehicle) => {
      const defaults = VEHICLE_DEFAULTS[vehicle.type] || { emoji: "🚐" };
      const label = getVehicleLabel(vehicle, vehicles);

      let state: VehicleTabState;

      if (isBoarded && vehicle.id === boardedVehicleId) {
        state = "boarded";
      } else if (isBoarded) {
        // Student is on another vehicle — this one is locked
        state = "locked";
      } else if (vehicle.status === "ended") {
        state = "ended";
      } else if (
        hasVehiclePassed(vehicle, studentDefaultStation, stations)
      ) {
        state = "passed";
      } else if (vehicle.status === "running" || vehicle.status === "full") {
        state = "active";
      } else if (vehicle.status === "planned") {
        state = "active";
      } else {
        state = "ended";
      }

      return {
        vehicle,
        label,
        emoji: defaults.emoji,
        state,
        badge: getBadgeText(state, vehicle),
      };
    });
  }, [vehicles, isBoarded, boardedVehicleId, studentDefaultStation, stations]);

  // ── Auto-select logic ───────────────────────────────────────────────

  useEffect(() => {
    // Priority 1: If boarded, force-select the boarded vehicle
    if (isBoarded && boardedVehicleId) {
      setSelectedTabIdRaw(boardedVehicleId);
      return;
    }

    // Priority 2: If current selection is still active, keep it
    const currentTab = tabs.find((t) => t.vehicle.id === selectedTabId);
    if (currentTab && currentTab.state === "active") {
      return; // selection is still valid
    }

    // Priority 3: Current selection became "passed" or invalid — auto-switch
    const firstActive = tabs.find((t) => t.state === "active");
    if (firstActive) {
      setSelectedTabIdRaw(firstActive.vehicle.id);
      return;
    }

    // Priority 4: No active vehicles — select first non-locked tab
    const firstAvailable = tabs.find(
      (t) => t.state !== "locked"
    );
    if (firstAvailable) {
      setSelectedTabIdRaw(firstAvailable.vehicle.id);
      return;
    }

    // Priority 5: Nothing available — keep whatever we had, or first tab
    if (!selectedTabId && tabs.length > 0) {
      setSelectedTabIdRaw(tabs[0].vehicle.id);
    }
  }, [tabs, isBoarded, boardedVehicleId]);

  // Track previous selection for detecting auto-switches
  useEffect(() => {
    prevSelectedRef.current = selectedTabId;
  }, [selectedTabId]);

  // ── Controlled setter (prevents switching to locked/passed tabs) ────

  const setSelectedTabId = useCallback(
    (id: string) => {
      if (isBoarded) return; // locked to boarded vehicle
      const tab = tabs.find((t) => t.vehicle.id === id);
      if (!tab) return;
      // Allow selecting active, passed (to see the explanation), and ended tabs
      if (tab.state === "locked") return;
      setSelectedTabIdRaw(id);
    },
    [tabs, isBoarded],
  );

  // ── Selected vehicle convenience ────────────────────────────────────

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedTabId) ?? null,
    [vehicles, selectedTabId],
  );

  return {
    tabs,
    selectedTabId,
    setSelectedTabId,
    isLockedToVehicle: isBoarded,
    selectedVehicle,
  };
}
