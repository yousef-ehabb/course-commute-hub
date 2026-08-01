import type { Database } from "firebase/database";

export interface TripErrorContext {
  /** Firebase error code, e.g. "PERMISSION_DENIED" */
  code: string;
  /** Database path that was being written */
  path: string;
  /** Human-readable description of the operation */
  operation: string;
  /** Original error object */
  cause: unknown;
}

export class FirebaseTripError extends Error {
  readonly code: string;
  readonly path: string;
  readonly operation: string;

  constructor(ctx: TripErrorContext) {
    const msg = `[TripService] ${ctx.operation} failed — code: ${ctx.code}, path: ${ctx.path}`;
    super(msg, { cause: ctx.cause });
    this.name = "FirebaseTripError";
    this.code = ctx.code;
    this.path = ctx.path;
    this.operation = ctx.operation;
  }
}

export function extractFirebaseCode(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.code === "string") return e.code;
    if (typeof e.message === "string") {
      const m = e.message.match(/\(([^)]+)\)/);
      if (m) return m[1];
    }
  }
  return "UNKNOWN";
}

export class TripRepository {
  static async atomicUpdate(
    db: Database,
    updates: Record<string, unknown>,
    operation: string,
    errorPathContext: string,
  ): Promise<void> {
    const { ref, update } = await import("firebase/database");

    try {
      await update(ref(db), updates);
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: errorPathContext,
        operation,
        cause: err,
      });
    }
  }

  static async readTripSnapshot(
    db: Database,
    path: string,
  ): Promise<Record<string, unknown> | null> {
    const { ref, get } = await import("firebase/database");

    try {
      const snapshot = await get(ref(db, path));
      return snapshot.exists() ? (snapshot.val() as Record<string, unknown>) : null;
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path,
        operation: "readTripSnapshot",
        cause: err,
      });
    }
  }

  static async readServerTimeOffset(db: Database): Promise<number> {
    const { ref, get } = await import("firebase/database");

    try {
      const snapshot = await get(ref(db, ".info/serverTimeOffset"));
      return snapshot.exists() ? (snapshot.val() as number) : 0;
    } catch (err) {
      // Offset read failures shouldn't crash the app, fallback to 0
      console.warn("[TripRepository] Failed to read server time offset, falling back to 0", err);
      return 0;
    }
  }

  /**
   * Read the current activeDateKey from Firebase settings.
   * Used for idempotency checks before completing a trip.
   */
  static async readActiveDateKey(db: Database): Promise<string | null> {
    const { ref, get } = await import("firebase/database");

    try {
      const snap = await get(ref(db, "rakeb/settings/default/activeDateKey"));
      return snap.exists() ? (snap.val() as string) : null;
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: "rakeb/settings/default/activeDateKey",
        operation: "readActiveDateKey",
        cause: err,
      });
    }
  }

  /**
   * Atomically advance activeDateKey using compare-and-swap.
   * Returns { committed: true } only if the current value matched expectedKey.
   * If another admin already advanced it, the transaction aborts safely.
   */
  static async transactionalAdvanceDate(
    db: Database,
    expectedKey: string,
    nextKey: string,
  ): Promise<{ committed: boolean }> {
    const { ref, runTransaction } = await import("firebase/database");

    try {
      const result = await runTransaction(
        ref(db, "rakeb/settings/default/activeDateKey"),
        (currentValue) => {
          if (currentValue === expectedKey) {
            return nextKey;
          }
          // Abort — another admin already advanced or value is unexpected
          return undefined;
        },
      );
      return { committed: result.committed };
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: "rakeb/settings/default/activeDateKey",
        operation: "transactionalAdvanceDate",
        cause: err,
      });
    }
  }

  /**
   * Update the live GPS location for an active trip.
   * Scoped to a specific vehicle.
   */
  static async updateLocation(
    db: Database,
    dateKey: string,
    vehicleId: string,
    adminUid: string,
    location: { lat: number; lng: number; updatedAt: number },
  ): Promise<void> {
    const vehiclePath = `rakeb/vehicles/default/${dateKey}/${vehicleId}`;
    try {
      const { serverTimestamp } = await import("firebase/database");
      await TripRepository.atomicUpdate(
        db,
        { 
          [`${vehiclePath}/currentLocation`]: location,
          [`${vehiclePath}/lastHeartbeatAt`]: serverTimestamp()
        },
        "updateLocation",
        vehiclePath,
      );
    } catch (err) {
      if (err instanceof FirebaseTripError) throw err;
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: vehiclePath,
        operation: "updateLocation",
        cause: err,
      });
    }
  }

  /**
   * Read the daily status snapshot for a given date.
   * Used to compute passenger metadata when completing a trip.
   */
  static async readDailyStatusSnapshot(
    db: Database,
    dateKey: string,
  ): Promise<Record<string, unknown> | null> {
    const { ref, get } = await import("firebase/database");

    try {
      const snap = await get(ref(db, `rakeb/dailyStatus/default/${dateKey}`));
      return snap.exists() ? (snap.val() as Record<string, unknown>) : null;
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: `rakeb/dailyStatus/default/${dateKey}`,
        operation: "readDailyStatusSnapshot",
        cause: err,
      });
    }
  }

  /**
   * Write an audit log entry under rakeb/auditLog/default using push().
   */
  static async writeAuditEntry(
    db: Database,
    entry: {
      timestamp: number;
      adminUid: string;
      action: string;
      tripDate: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const { ref, push, set } = await import("firebase/database");
    const path = "rakeb/auditLog/default";

    try {
      const logRef = push(ref(db, path));
      await set(logRef, entry);
    } catch (err) {
      // Audit log failures should log to console without crashing user operations
      console.warn("[TripRepository] Failed to write audit entry:", err);
    }
  }

  /**
   * Automatically detect and clean up stale or orphaned completed trips in rakeb/trips/default.
   * If a trip is completed or older than activeDateKey, archives it if missing from history and deletes it from active trips node.
   */
  static async cleanStaleTrips(db: Database, currentActiveDateKey: string): Promise<void> {
    const { ref, get } = await import("firebase/database");
    const updates: Record<string, unknown> = {};

    try {
      const [tripsSnap, historySnap] = await Promise.all([
        get(ref(db, "rakeb/trips/default")),
        get(ref(db, "rakeb/tripHistory/default")),
      ]);

      if (!tripsSnap.exists()) return;

      const trips = tripsSnap.val() as Record<string, Record<string, unknown>>;
      const history = historySnap.exists() ? (historySnap.val() as Record<string, unknown>) : {};

      for (const [dateKey, tripData] of Object.entries(trips)) {
        const isCompleted =
          tripData && (tripData.status === "completed" || Boolean(tripData.endedAt));
        const isOlder = dateKey < currentActiveDateKey;

        if (isCompleted || isOlder) {
          // If not archived in history yet, archive it
          if (!history[dateKey]) {
            updates[`rakeb/tripHistory/default/${dateKey}`] = {
              ...tripData,
              status: "completed",
              endedAt: tripData.endedAt ?? Date.now(),
            };
          }
          // Remove from active trips node
          updates[`rakeb/trips/default/${dateKey}`] = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        await TripRepository.atomicUpdate(db, updates, "cleanStaleTrips", "rakeb/trips/default");
      }
    } catch (err) {
      console.warn("[TripRepository] cleanStaleTrips failed silently:", err);
    }
  }

  // ── Phase 2: Vehicle CRUD ───────────────────────────────────────────────

  /**
   * Create a new vehicle under rakeb/vehicles/default/{dateKey}/{vehicleId}.
   * Uses push() to generate a unique vehicleId and returns it.
   */
  static async createVehicle(
    db: Database,
    dateKey: string,
    vehicle: {
      type: string;
      capacity: number;
      createdBy: string;
    },
  ): Promise<string> {
    const { ref, push } = await import("firebase/database");
    const collectionPath = `rakeb/vehicles/default/${dateKey}`;
    const newRef = push(ref(db, collectionPath));
    const vehicleId = newRef.key!;

    const now = Date.now();
    const vehicleData = {
      id: vehicleId,
      type: vehicle.type,
      capacity: vehicle.capacity,
      occupiedSeats: 0,
      status: "planned",
      assignedCoordinatorId: null,
      assignedAt: null,
      lastHeartbeatAt: null,
      trackingSessionId: null,
      currentLocation: null,
      currentStationId: null,
      nextStationId: null,
      lastStationId: null,
      licensePlate: null,
      createdAt: now,
      updatedAt: now,
      createdBy: vehicle.createdBy,
    };

    try {
      await TripRepository.atomicUpdate(
        db,
        { [`${collectionPath}/${vehicleId}`]: vehicleData },
        "createVehicle",
        `${collectionPath}/${vehicleId}`,
      );
      return vehicleId;
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: `${collectionPath}/${vehicleId}`,
        operation: "createVehicle",
        cause: err,
      });
    }
  }

  /**
   * Remove a vehicle. Only allowed when status is still "planned" (not yet started).
   */
  static async removeVehicle(
    db: Database,
    dateKey: string,
    vehicleId: string,
  ): Promise<void> {
    const { ref, get } = await import("firebase/database");
    const vehiclePath = `rakeb/vehicles/default/${dateKey}/${vehicleId}`;

    try {
      // Safety check: only remove planned vehicles
      const snap = await get(ref(db, vehiclePath));
      if (!snap.exists()) return;

      const data = snap.val();
      if (data.status && data.status !== "planned") {
        throw new FirebaseTripError({
          code: "VEHICLE_NOT_PLANNED",
          path: vehiclePath,
          operation: "removeVehicle",
          cause: new Error(`Cannot remove vehicle with status "${data.status}"`),
        });
      }

      await TripRepository.atomicUpdate(
        db,
        { [vehiclePath]: null },
        "removeVehicle",
        vehiclePath,
      );
    } catch (err) {
      if (err instanceof FirebaseTripError) throw err;
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: vehiclePath,
        operation: "removeVehicle",
        cause: err,
      });
    }
  }

  /**
   * One-shot read of all vehicles for a given date.
   */
  static async readVehicles(
    db: Database,
    dateKey: string,
  ): Promise<Record<string, unknown> | null> {
    const { ref, get } = await import("firebase/database");
    const path = `rakeb/vehicles/default/${dateKey}`;

    try {
      const snap = await get(ref(db, path));
      return snap.exists() ? (snap.val() as Record<string, unknown>) : null;
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path,
        operation: "readVehicles",
        cause: err,
      });
    }
  }

  /**
   * Update the capacity of a planned vehicle.
   */
  static async updateVehicleCapacity(
    db: Database,
    dateKey: string,
    vehicleId: string,
    newCapacity: number,
  ): Promise<void> {
    const { ref, get } = await import("firebase/database");
    const vehiclePath = `rakeb/vehicles/default/${dateKey}/${vehicleId}`;

    // Safety check: only allow capacity edits on planned vehicles
    const snap = await get(ref(db, vehiclePath));
    if (snap.exists()) {
      const data = snap.val();
      if (data.status && data.status !== "planned") {
        throw new FirebaseTripError({
          code: "VEHICLE_NOT_PLANNED",
          path: vehiclePath,
          operation: "updateVehicleCapacity",
          cause: new Error(`Cannot update capacity of vehicle with status "${data.status}"`),
        });
      }
    }

    try {
      await TripRepository.atomicUpdate(
        db,
        {
          [`${vehiclePath}/capacity`]: newCapacity,
          [`${vehiclePath}/updatedAt`]: Date.now(),
        },
        "updateVehicleCapacity",
        vehiclePath,
      );
    } catch (err) {
      if (err instanceof FirebaseTripError) throw err;
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: vehiclePath,
        operation: "updateVehicleCapacity",
        cause: err,
      });
    }
  }

  /**
   * Take control of a vehicle for independent GPS tracking.
   * Uses runTransaction to prevent race conditions.
   */
  static async takeControl(
    db: Database,
    dateKey: string,
    vehicleId: string,
    adminUid: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { ref, runTransaction, get, serverTimestamp } = await import("firebase/database");
    console.log("[TripRepository.takeControl] Inputs:", {
      dateKey,
      vehicleId,
      adminUid,
    });
    const path = `rakeb/vehicles/default/${dateKey}/${vehicleId}`;
    console.log(`[TripRepository.takeControl] Raw path string:`, JSON.stringify(path));
    console.log(`[TripRepository.takeControl] Path: ${path}, adminUid: ${adminUid}`);
    
    try {
      // Fetch server time offset to correct for local clock drift.
      // We use the safe wrapper because ref(db, ".info/serverTimeOffset") throws "Invalid token in path" in some SDKs.
      const offset = await TripRepository.readServerTimeOffset(db);
      console.log(`[TripRepository.takeControl] serverTimeOffset: ${offset}`);
      
      const result = await runTransaction(ref(db, path), (vehicle) => {
        console.log(`[TripRepository.takeControl] Transaction step. Current vehicle state:`, vehicle);
        if (vehicle === null) {
          // If SDK cache is unprimed, return a dummy object to force a server roundtrip.
          // The server will respond with a hash mismatch and provide the real data,
          // or reject it via security rules if the vehicle truly doesn't exist.
          console.log(`[TripRepository.takeControl] Vehicle is null. Returning dummy object.`);
          return { assignedCoordinatorId: adminUid };
        }
        
        const estimatedServerTime = Date.now() + offset;
        const STALE_TIMEOUT_MS = 60 * 1000; // 60 seconds

        if (vehicle.assignedCoordinatorId) {
          if (vehicle.assignedCoordinatorId !== adminUid) {
            // Already assigned to someone else. Check for staleness.
            const lastActive = vehicle.lastHeartbeatAt || vehicle.assignedAt || 0;
            console.log(`[TripRepository.takeControl] Vehicle assigned to another coordinator (${vehicle.assignedCoordinatorId}). Last active: ${lastActive}, estimatedServerTime: ${estimatedServerTime}, diff: ${estimatedServerTime - lastActive}`);
            if (estimatedServerTime - lastActive < STALE_TIMEOUT_MS) {
              console.log(`[TripRepository.takeControl] Vehicle is still active. Aborting transaction.`);
              return undefined; // Still active, abort
            }
            console.log(`[TripRepository.takeControl] Vehicle is stale. Claiming it.`);
            // Stale! We can claim it.
          } else {
            console.log(`[TripRepository.takeControl] Vehicle already assigned to us. Refreshing.`);
          }
          // Already assigned to us, just refresh
        } else {
          console.log(`[TripRepository.takeControl] Vehicle is not assigned. Claiming it.`);
        }
        
        vehicle.assignedCoordinatorId = adminUid;
        vehicle.assignedAt = serverTimestamp();
        vehicle.lastHeartbeatAt = serverTimestamp();
        console.log(`[TripRepository.takeControl] Transaction step returning updated vehicle:`, vehicle);
        return vehicle;
      });
      
      console.log(`[TripRepository.takeControl] Transaction completed. Committed: ${result.committed}`);
      if (!result.committed) {
        return { success: false, error: "Vehicle already assigned to another coordinator" };
      }
      return { success: true };
    } catch (err) {
      console.error(`[TripRepository.takeControl] Exception caught:`, err);
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path,
        operation: "takeControl",
        cause: err,
      });
    }
  }

  /**
   * Release control of a vehicle.
   */
  static async releaseControl(
    db: Database,
    dateKey: string,
    vehicleId: string,
    adminUid: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { ref, runTransaction } = await import("firebase/database");
    const path = `rakeb/vehicles/default/${dateKey}/${vehicleId}`;
    
    try {
      const result = await runTransaction(ref(db, path), (vehicle) => {
        if (vehicle === null) return undefined;
        if (vehicle.assignedCoordinatorId !== adminUid) {
          // Cannot release someone else's vehicle
          return undefined;
        }
        vehicle.assignedCoordinatorId = null;
        vehicle.assignedAt = null;
        vehicle.lastHeartbeatAt = null;
        vehicle.currentLocation = null;
        return vehicle;
      });
      
      if (!result.committed) {
        return { success: false, error: "Cannot release vehicle assigned to another coordinator" };
      }
      return { success: true };
    } catch (err) {
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path,
        operation: "releaseControl",
        cause: err,
      });
    }
  }

  // ── Phase 2c: Per-Vehicle Boarding ────────────────────────────────────────

  static async boardStudent(
    db: Database,
    activeDateKey: string,
    studentId: string,
    vehicleId: string,
    adminUid: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { ref, runTransaction, serverTimestamp, increment, update } = await import("firebase/database");
    const recordRef = ref(db, `rakeb/boardingRecords/${activeDateKey}/${studentId}`);

    // 1. Transaction to claim boarding record (guards against UI double-tap)
    let originalData: any = null;
    const { committed } = await runTransaction(recordRef, (currentData) => {
      if (currentData && currentData.status === "boarded") {
        return; // Abort transaction if already boarded
      }
      originalData = currentData;
      return {
        id: studentId,
        studentId,
        vehicleId,
        status: "boarded",
        boardedAt: serverTimestamp(),
        boardedByCoordinatorId: adminUid,
        undoneAt: null,
      };
    });

    if (!committed) {
      return { success: false, error: "الطالب مسجل بالفعل" }; // Already boarded
    }

    // 2. Increment vehicle capacity
    try {
      await update(ref(db), {
        [`rakeb/vehicles/default/${activeDateKey}/${vehicleId}/occupiedSeats`]: increment(1)
      });
      return { success: true };
    } catch (err) {
      // 3. Rollback on capacity failure (e.g. over capacity rejected by security rules)
      await update(ref(db), {
        [`rakeb/boardingRecords/${activeDateKey}/${studentId}`]: originalData || null
      });
      return { success: false, error: "المركبة ممتلئة" }; // Vehicle is full
    }
  }

  static async unboardStudent(
    db: Database,
    activeDateKey: string,
    studentId: string,
    vehicleId: string,
    adminUid: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { ref, runTransaction, serverTimestamp, increment, update } = await import("firebase/database");
    const recordRef = ref(db, `rakeb/boardingRecords/${activeDateKey}/${studentId}`);

    // 1. Transaction to release boarding record
    let originalData: any = null;
    const { committed } = await runTransaction(recordRef, (currentData) => {
      if (!currentData || currentData.status !== "boarded") {
        return; // Abort if not boarded
      }
      originalData = currentData;
      return {
        ...currentData,
        status: "undone",
        undoneAt: serverTimestamp(),
      };
    });

    if (!committed) {
      return { success: false, error: "الطالب غير مسجل" };
    }

    // 2. Decrement vehicle capacity
    try {
      await update(ref(db), {
        [`rakeb/vehicles/default/${activeDateKey}/${vehicleId}/occupiedSeats`]: increment(-1)
      });
      return { success: true };
    } catch (err) {
      // 3. Rollback on failure
      await update(ref(db), {
        [`rakeb/boardingRecords/${activeDateKey}/${studentId}`]: originalData || null
      });
      return { success: false, error: "حدث خطأ أثناء إلغاء التسجيل" };
    }
  }
}
