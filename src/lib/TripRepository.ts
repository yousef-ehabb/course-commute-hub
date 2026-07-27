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
   * Centralises the location write that was previously inline in the UI.
   */
  static async updateLocation(
    db: Database,
    tripPath: string,
    location: { lat: number; lng: number; updatedAt: number },
  ): Promise<void> {
    try {
      await TripRepository.atomicUpdate(
        db,
        { [`${tripPath}/location`]: location },
        "updateLocation",
        tripPath,
      );
    } catch (err) {
      if (err instanceof FirebaseTripError) throw err;
      throw new FirebaseTripError({
        code: extractFirebaseCode(err),
        path: tripPath,
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
}
