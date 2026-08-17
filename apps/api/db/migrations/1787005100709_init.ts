import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("ext_conference")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("display_name_short", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("ext_team")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("conference_id", "integer", (col) =>
      col.references("ext_conference.id").onDelete("cascade").notNull(),
    )
    .execute();
}
