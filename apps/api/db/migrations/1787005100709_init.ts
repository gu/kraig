import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("ext_conference")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("short_name", "text", (col) => col.notNull())
    .addColumn("abbreviation", "text")
    .execute();

  await db.schema
    .createTable("ext_team")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("school", "text", (col) => col.notNull())
    .addColumn("abbreviation", "text", (col) => col.notNull())
    .addColumn("conference_id", "integer", (col) =>
      col.references("ext_conference.id").onDelete("cascade").notNull(),
    )
    .execute();
}
