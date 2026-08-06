/**
 * Trip lifecycle service — business logic layer.
 * Delegates all Firebase I/O to TripRepository.
 */

import { addDays, format } from "date-fns";
import type { Database } from "firebase/database";
import { TripRepository, FirebaseTripError } from "./TripRepository";
import { logError } from "./logger";
import { AuditService } from "./auditService";

export { FirebaseTripError };

/**
 * Compute the next calendar date key in YYYY-MM-DD format.
 */
export function getNextDateKey(currentDateKey: string): string {
  const [y, m, d] = currentDateKey.split("-").map(Number);
  const current = new Date(y, m - 1, d);
  const next = addDays(current, 1);
  return format(next, "yyyy-MM-dd");
}

function getServerTimestamp(offset: number): number {
  return Date.now() + offset;
}

export interface StartTripParams {
  db: Database;
  tripPath: string;
  dailyPath: string;
  firstStationId: string;
  secondStationId: string | null;
  /** Already-loaded passenger IDs to reset boarding */
  passengerIds: string[];
  serverTimeOffset: number;
  adminUid: string;
  activeDateKey: string;
  licensePlate?: string;
}

export async function startTrip(params: StartTripParams): Promise<void> {
  const {
    db,
    tripPath,
    dailyPath,
    firstStationId,
    secondStationId,
    passengerIds,
    serverTimeOffset,
    adminUid,
    activeDateKey,
    licensePlate,
  } = params;
  const now = getServerTimestamp(serverTimeOffset);
  const updates: Record<string, unknown> = {};

  updates[`${tripPath}/status`] = "waiting_at_station";
  updates[`${tripPath}/currentStationId`] = firstStationId;
  updates[`${tripPath}/nextStationId`] = secondStationId ?? "creativa";
  updates[`${tripPath}/lastStationId`] = null;
  updates[`${tripPath}/startedAt`] = now;
  updates[`${tripPath}/arrivedAt`] = now;
  updates[`${tripPath}/endedAt`] = null;
  updates[`${tripPath}/location`] = null;
  updates[`${tripPath}/licensePlate`] = licensePlate || null;
  updates[`${tripPath}/createdAt`] = now;
  updates[`${tripPath}/createdBy`] = adminUid;
  updates[`${tripPath}/updatedAt`] = now;
  updates[`${tripPath}/updatedBy`] = adminUid;

  // Only reset boarded state for students who actually have a record
  for (const uid of passengerIds) {
    updates[`${dailyPath}/${uid}/boarded`] = false;
  }

  try {
    await TripRepository.atomicUpdate(db, updates, "startTrip", tripPath);

    // Log audit entry
    AuditService.log({
      db,
      adminUid,
      action: "trip_started",
      tripDate: activeDateKey,
      serverTimeOffset,
      metadata: { firstStationId, secondStationId: secondStationId ?? "creativa" },
    });
  } catch (err) {
    if (err instanceof FirebaseTripError) {
      logError({
        operation: err.operation,
        path: err.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    }
    throw err;
  }
}

export interface StartDayParams {
  db: Database;
  activeDateKey: string;
  serverTimeOffset: number;
  adminUid: string;
}

export async function startDay(params: StartDayParams): Promise<void> {
  const { db, activeDateKey, serverTimeOffset, adminUid } = params;
  const now = getServerTimestamp(serverTimeOffset);
  const tripPath = `rakeb/trips/default/${activeDateKey}`;
  const updates: Record<string, unknown> = {};

  updates[`${tripPath}/status`] = "waiting_at_station"; // active phase
  updates[`${tripPath}/startedAt`] = now;
  updates[`${tripPath}/updatedAt`] = now;
  updates[`${tripPath}/updatedBy`] = adminUid;

  try {
    await TripRepository.atomicUpdate(db, updates, "startDay", tripPath);
    
    AuditService.log({
      db,
      adminUid,
      action: "day_started",
      tripDate: activeDateKey,
      serverTimeOffset,
      metadata: {},
    });
  } catch (err) {
    if (err instanceof FirebaseTripError) {
      logError({
        operation: err.operation,
        path: err.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    }
    throw err;
  }
}

export interface CompleteTripParams {
  db: Database;
  activeDateKey: string;
  serverTimeOffset: number;
  tripSnapshot: Record<string, unknown> | null;
  /** Admin UID performing the completion — stored in history for audit */
  adminUid: string;
  /** Daily status snapshot — used to compute passenger metadata */
  dailyStatusSnapshot: Record<string, unknown> | null;
  /** Total number of pickup stations on the route */
  totalStations: number;
}

export interface CompleteTripResult {
  nextDateKey: string;
  /** True if the trip was already completed (by another admin or a retry) */
  alreadyCompleted?: boolean;
}

/**
 * Startup reconciliation service.
 * Performs a single database audit pass:
 * 1. Detects stale completed trips in rakeb/trips/default.
 * 2. Archives them to rakeb/tripHistory/default if missing.
 * 3. Removes orphaned active trip nodes.
 * 4. Leaves the database in a clean, consistent state.
 */
export async function reconcileOnStartup(db: Database, activeDateKey: string): Promise<void> {
  try {
    await TripRepository.cleanStaleTrips(db, activeDateKey);
  } catch (err) {
    console.warn("[TripService] Startup reconciliation pass warning:", err);
  }
}

export async function reconcileStaleTrips(db: Database, activeDateKey: string): Promise<void> {
  await reconcileOnStartup(db, activeDateKey);
}

export async function completeTrip(params: CompleteTripParams): Promise<CompleteTripResult> {
  const {
    db,
    activeDateKey,
    serverTimeOffset,
    tripSnapshot,
    adminUid,
    dailyStatusSnapshot,
    totalStations,
  } = params;

  const nextDateKey = getNextDateKey(activeDateKey);
  const now = getServerTimestamp(serverTimeOffset);

  // ── 1. Idempotency guard ────────────────────────────────────────────
  // Read the current activeDateKey from Firebase. If it no longer matches
  // what the caller believes it to be, another admin (or a retry) has
  // already completed this trip. Clean up any leftover active trip node and return early.
  const currentDateKey = await TripRepository.readActiveDateKey(db);
  if (currentDateKey && currentDateKey !== activeDateKey) {
    // Ensure any leftover active trip for activeDateKey is cleaned up
    await TripRepository.cleanStaleTrips(db, currentDateKey);
    return { nextDateKey: currentDateKey, alreadyCompleted: true };
  }

  // ── 2. Transactional date advance (CAS) ─────────────────────────────
  // Uses runTransaction() to atomically compare-and-swap activeDateKey.
  // If another concurrent admin won the race, the transaction aborts.
  const { committed } = await TripRepository.transactionalAdvanceDate(
    db,
    activeDateKey,
    nextDateKey,
  );

  if (!committed) {
    // Another admin completed the trip between our read and CAS — safe no-op
    return { nextDateKey, alreadyCompleted: true };
  }

  // ── 3. Compute trip history metadata ────────────────────────────────
  const startedAt = (tripSnapshot?.startedAt as number) ?? now;
  const tripDuration = now - startedAt;

  let totalExpectedPassengers = 0;
  let totalCancelledPassengers = 0;
  if (dailyStatusSnapshot) {
    for (const record of Object.values(dailyStatusSnapshot)) {
      const r = record as Record<string, unknown>;
      if (r.status === "riding") totalExpectedPassengers++;
      else if (r.status === "cancelled") totalCancelledPassengers++;
    }
  }

  const historyEntry = {
    ...(tripSnapshot ?? {}),
    startedAt,
    status: "completed",
    endedAt: now,
    completedAt: now,
    completedBy: adminUid,
    tripDuration,
    totalStationsVisited: totalStations,
    totalExpectedPassengers,
    totalCancelledPassengers,
    updatedAt: now,
    updatedBy: adminUid,
  };

  // ── 4. Multi-path atomic update ─────────────────────────────────────
  // activeDateKey was already advanced by the transaction above,
  // so this update only handles archive + cleanup + next-day init.
  const updates: Record<string, unknown> = {};

  // Archive today's trip to history
  updates[`rakeb/tripHistory/default/${activeDateKey}`] = historyEntry;

  // Remove today's active trip
  updates[`rakeb/trips/default/${activeDateKey}`] = null;

  // Initialize next day's trip
  updates[`rakeb/trips/default/${nextDateKey}/status`] = "pending";
  updates[`rakeb/trips/default/${nextDateKey}/createdAt`] = now;
  updates[`rakeb/trips/default/${nextDateKey}/createdBy`] = adminUid;
  updates[`rakeb/trips/default/${nextDateKey}/updatedAt`] = now;
  updates[`rakeb/trips/default/${nextDateKey}/updatedBy`] = adminUid;

  // Sync new cutoff timestamp for nextDateKey
  try {
    const { ref, get } = await import("firebase/database");
    const settingsSnap = await get(ref(db, "rakeb/settings/default"));
    if (settingsSnap.exists()) {
      const settings = settingsSnap.val();
      const cutoffTimeStr = settings.cutoffTime || "13:15";
      const [year, month, day] = nextDateKey.split("-").map(Number);
      const [cutoffHours, cutoffMinutes] = cutoffTimeStr.split(":").map(Number);
      const cutoff = new Date(year, month - 1, day);
      cutoff.setDate(cutoff.getDate() - 1);
      cutoff.setHours(cutoffHours, cutoffMinutes, 0, 0);
      updates[`rakeb/settings/default/cutoffTimestamp`] = cutoff.getTime();
    }
  } catch (e) {
    console.warn("[TripService] Failed to calculate next cutoff timestamp:", e);
  }

  try {
    await TripRepository.atomicUpdate(
      db,
      updates,
      "completeTrip",
      `rakeb/trips/default/${activeDateKey}`,
    );

    // Log audit entry for trip completion & next day registration opened
    AuditService.log({
      db,
      adminUid,
      action: "trip_completed",
      tripDate: activeDateKey,
      serverTimeOffset,
      metadata: {
        nextDateKey,
        tripDuration,
        totalStationsVisited: totalStations,
        totalExpectedPassengers,
        totalCancelledPassengers,
      },
    });

    AuditService.log({
      db,
      adminUid,
      action: "registration_opened_next_day",
      tripDate: nextDateKey,
      serverTimeOffset,
      metadata: { previousDateKey: activeDateKey },
    });
  } catch (err) {
    if (err instanceof FirebaseTripError) {
      logError({
        operation: err.operation,
        path: err.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    }
    throw err;
  }

  return { nextDateKey };
}

export interface DepartStationParams {
  db: Database;
  vehicleId: string;
  currentStationId: string;
  nextStationId: string;
  isFinalPickup: boolean;
  serverTimeOffset: number;
  adminUid: string;
  activeDateKey: string;
}

export async function departStation(params: DepartStationParams): Promise<void> {
  const {
    db,
    vehicleId,
    currentStationId,
    nextStationId,
    isFinalPickup,
    serverTimeOffset,
    adminUid,
    activeDateKey,
  } = params;
  const now = getServerTimestamp(serverTimeOffset);
  const targetNextStation = isFinalPickup ? "creativa" : nextStationId;
  const vehiclePath = `rakeb/vehicles/default/${activeDateKey}/${vehicleId}`;
  
  const updates: Record<string, unknown> = {
    status: "running",
    lastStationId: currentStationId,
    currentStationId: null,
    nextStationId: targetNextStation,
    departedAt: now,
    updatedAt: now,
    updatedBy: adminUid,
  };

  try {
    const updatePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      updatePayload[`${vehiclePath}/${k}`] = v;
    }
    await TripRepository.atomicUpdate(db, updatePayload, "departStation", vehiclePath);

    // Log audit entry
    AuditService.log({
      db,
      adminUid,
      action: "station_departed",
      tripDate: activeDateKey,
      serverTimeOffset,
      metadata: { vehicleId, stationId: currentStationId, nextStationId: targetNextStation, isFinalPickup },
    });
  } catch (err) {
    if (err instanceof FirebaseTripError) {
      logError({
        operation: err.operation,
        path: err.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    }
    throw err;
  }
}

export interface ArriveAtStationParams {
  db: Database;
  vehicleId: string;
  stationId: string;
  nextStationId: string;
  isLastPickup: boolean;
  serverTimeOffset: number;
  adminUid: string;
  activeDateKey: string;
}

export async function arriveAtStation(params: ArriveAtStationParams): Promise<void> {
  const {
    db,
    vehicleId,
    stationId,
    nextStationId,
    isLastPickup,
    serverTimeOffset,
    adminUid,
    activeDateKey,
  } = params;
  const now = getServerTimestamp(serverTimeOffset);
  const targetNextStation = isLastPickup ? "creativa" : nextStationId;
  const vehiclePath = `rakeb/vehicles/default/${activeDateKey}/${vehicleId}`;
  
  const updates: Record<string, unknown> = {
    status: "running",
    currentStationId: stationId,
    lastStationId: null,
    nextStationId: targetNextStation,
    arrivedAt: now,
    updatedAt: now,
    updatedBy: adminUid,
  };

  try {
    const updatePayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      updatePayload[`${vehiclePath}/${k}`] = v;
    }
    await TripRepository.atomicUpdate(db, updatePayload, "arriveAtStation", vehiclePath);

    // Log audit entry
    AuditService.log({
      db,
      adminUid,
      action: "station_arrived",
      tripDate: activeDateKey,
      serverTimeOffset,
      metadata: { vehicleId, stationId, nextStationId: targetNextStation, isLastPickup },
    });
  } catch (err) {
    if (err instanceof FirebaseTripError) {
      logError({
        operation: err.operation,
        path: err.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    }
    throw err;
  }
}

export async function toggleBoarding(
  db: Database,
  dailyPath: string,
  userId: string,
  boarded: boolean,
): Promise<void> {
  const path = `${dailyPath}/${userId}`;
  try {
    await TripRepository.atomicUpdate(db, { [`${path}/boarded`]: boarded }, "toggleBoarding", path);
  } catch (err) {
    if (err instanceof FirebaseTripError) {
      logError({
        operation: err.operation,
        path: err.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      });
    }
    throw err;
  }
}

// Deprecated in favor of TripRepository.readServerTimeOffset but kept for backwards compatibility if needed
export async function getServerTimeOffset(db: Database): Promise<number> {
  return TripRepository.readServerTimeOffset(db);
}
