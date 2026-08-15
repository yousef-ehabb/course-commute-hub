import type { Database } from "firebase/database";
import { TripRepository } from "./TripRepository";

export interface LogAuditParams {
  db: Database;
  adminUid: string;
  action: string;
  tripDate: string;
  serverTimeOffset?: number;
  metadata?: Record<string, unknown>;
  courseId?: string;
}

export class AuditService {
  static async log(params: LogAuditParams): Promise<void> {
    const { db, adminUid, action, tripDate, serverTimeOffset = 0, metadata, courseId = "default" } = params;
    const timestamp = Date.now() + serverTimeOffset;

    await TripRepository.writeAuditEntry(db, {
      timestamp,
      adminUid,
      action,
      tripDate,
      ...(metadata ? { metadata } : {}),
    }, courseId);
  }
}
