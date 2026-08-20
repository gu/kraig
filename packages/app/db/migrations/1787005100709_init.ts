import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("ext_conference")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.unique().notNull())
    .addColumn("short_name", "text", (col) => col.unique().notNull())
    .addColumn("abbreviation", "text", (col) => col.unique().notNull())
    .execute();

  await db.schema
    .createTable("ext_team")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("school", "text", (col) => col.notNull())
    .addColumn("abbreviation", "text", (col) => col)
    .addColumn("conference", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("ext_game")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("week", "integer", (col) => col.notNull())
    .addColumn("start_date", "timestamptz", (col) => col.notNull())
    .addColumn("conference_game", "boolean", (col) => col.notNull())
    .addColumn("home_id", "integer", (col) => col.notNull())
    .addColumn("home_conference", "text", (col) => col.notNull())
    .addColumn("away_id", "integer", (col) => col.notNull())
    .addColumn("away_conference", "text", (col) => col.notNull())
    .execute();
}
