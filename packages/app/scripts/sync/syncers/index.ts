import type { SyncContext } from "../context.ts";
import type { SyncResult } from "../sync-table.ts";

export interface Syncer {
  name: string;
  run(ctx: SyncContext): Promise<SyncResult>;
}

/** Downstream syncers scope their requests by already-synced upstream tables */
export function requireRows<T>(table: string, rows: T[]): T[] {
  if (rows.length === 0) {
    throw new Error(`${table} is empty. Sync it first before syncing tables that depend on it.`);
  }
  return rows;
}
