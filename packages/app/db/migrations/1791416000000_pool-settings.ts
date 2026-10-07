import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("pool")
    // ext_conference names whose teams can be picked. Null means every conference
    .addColumn("conferences", sql`text[]`)
    .addColumn("max_sheets", "integer", (col) =>
      col
        .notNull()
        .defaultTo(2)
        .check(sql`max_sheets between 1 and 10`),
    )
    .addColumn("picks_per_week", "integer", (col) =>
      col
        .notNull()
        .defaultTo(5)
        .check(sql`picks_per_week between 1 and 10`),
    )
    // Whether a pick wins by winning the game outright or by covering the spread
    .addColumn("pick_type", "text", (col) =>
      col
        .notNull()
        .defaultTo("outright")
        .check(sql`pick_type in ('outright', 'spread')`),
    )
    .execute();
}
