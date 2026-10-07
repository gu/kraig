import type { Insertable, Kysely } from "kysely";
import type { DB } from "@db/types";
import type { SyncContext } from "./context.ts";

const UPSERT_CHUNK_SIZE = 1000;

export type SyncResult = {
  table: string;
  fetched: number;
  inserted: number;
  updated: number;
  stale: Record<string, unknown>[];
};

class DryRunRollback extends Error {}

/**
 * Upserts `rows` into `table` keyed on `keys`. Existing rows that aren't in `rows`
 * are left untouched and returned as `stale`.
 */
export async function syncTable<T extends keyof DB & string>(
  ctx: SyncContext,
  {
    table,
    keys,
    rows,
  }: {
    table: T;
    keys: readonly (keyof DB[T] & string)[];
    rows: Insertable<DB[T]>[];
  },
): Promise<SyncResult> {
  // Table/column names are dynamic here, so query through an untyped handle
  const db = ctx.db as unknown as Kysely<any>;
  const tableName: string = table;
  const keyOf = (row: Record<string, unknown>) => JSON.stringify(keys.map((k) => row[k]));

  const fetchedKeys = new Set(rows.map((r) => keyOf(r as Record<string, unknown>)));
  const result: SyncResult = { table, fetched: rows.length, inserted: 0, updated: 0, stale: [] };

  try {
    await db.transaction().execute(async (trx) => {
      const existing: Record<string, unknown>[] = await trx
        .selectFrom(tableName)
        .selectAll()
        .execute();
      const existingKeys = new Set(existing.map(keyOf));

      result.stale = existing.filter((r) => !fetchedKeys.has(keyOf(r)));
      result.inserted = [...fetchedKeys].filter((k) => !existingKeys.has(k)).length;
      result.updated = rows.length - result.inserted;

      const updateColumns = Object.keys(rows[0] ?? {}).filter((c) => !keys.includes(c as never));
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
        await trx
          .insertInto(tableName)
          .values(rows.slice(i, i + UPSERT_CHUNK_SIZE))
          .onConflict((oc) => {
            const conflict = oc.columns(keys);
            return updateColumns.length > 0
              ? conflict.doUpdateSet(
                  Object.fromEntries(
                    updateColumns.map((c) => [c, (eb: any) => eb.ref(`excluded.${c}`)]),
                  ),
                )
              : conflict.doNothing();
          })
          .execute();
      }

      if (ctx.dryRun) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  const prefix = ctx.dryRun ? "[dry run] " : "";
  console.log(
    `> ${prefix}${table}: fetched ${result.fetched}, inserted ${result.inserted}, updated ${result.updated}, stale ${result.stale.length}`,
  );
  return result;
}
