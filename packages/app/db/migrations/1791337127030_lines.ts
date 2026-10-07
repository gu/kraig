import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("ext_line")
    .addColumn("game_id", "integer", (col) =>
      col.notNull().references("ext_game.id").onDelete("cascade"),
    )
    .addColumn("provider", "text", (col) => col.notNull())
    .addColumn("spread", "double precision")
    .addColumn("formatted_spread", "text", (col) => col.notNull())
    .addColumn("spread_open", "double precision")
    .addColumn("over_under", "double precision")
    .addColumn("over_under_open", "double precision")
    .addColumn("home_moneyline", "double precision")
    .addColumn("away_moneyline", "double precision")
    .addPrimaryKeyConstraint("ext_line_pkey", ["game_id", "provider"])
    .execute();
}
