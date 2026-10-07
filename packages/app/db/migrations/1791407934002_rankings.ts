import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // AP Top 25 by week. Ranked teams can be outside the synced conferences, so team_id has no FK to ext_team
  await db.schema
    .createTable("ext_ranking")
    .addColumn("week", "integer", (col) => col.notNull())
    .addColumn("team_id", "integer", (col) => col.notNull())
    .addColumn("rank", "integer", (col) => col.notNull())
    .addColumn("school", "text", (col) => col.notNull())
    .addColumn("conference", "text")
    .addColumn("first_place_votes", "integer")
    .addColumn("points", "integer")
    .addPrimaryKeyConstraint("ext_ranking_pkey", ["week", "team_id"])
    .execute();
}
