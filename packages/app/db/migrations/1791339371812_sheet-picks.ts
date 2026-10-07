import { sql, type Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ext_game")
    .addColumn("home_team", "text")
    .addColumn("away_team", "text")
    .execute();

  await db.schema
    .createTable("sheet_pick")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("sheet_id", "integer", (col) =>
      col.notNull().references("sheet.id").onDelete("cascade"),
    )
    .addColumn("game_id", "integer", (col) =>
      col.notNull().references("ext_game.id").onDelete("cascade"),
    )
    .addColumn("team_id", "integer", (col) =>
      col.notNull().references("ext_team.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    // One pick per game, and each team only once per sheet
    .addUniqueConstraint("sheet_pick_sheet_game_unique", ["sheet_id", "game_id"])
    .addUniqueConstraint("sheet_pick_sheet_team_unique", ["sheet_id", "team_id"])
    .execute();
}
