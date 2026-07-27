export interface LogEntry {
  operation: string;
  path?: string;
  code?: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export function logError(entry: LogEntry): void {
  const isDev = import.meta.env.DEV;
  if (isDev) {
    console.error("[TripService]", entry);
  } else {
    console.error(`[TripService] ${entry.operation} failed - ${entry.message}`);
  }
}
