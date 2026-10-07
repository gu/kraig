import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // Points are null until the game is final
  await db.schema
    .alterTable("ext_game")
    .addColumn("completed", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("home_points", "integer")
    .addColumn("away_points", "integer")
    .execute();
}
