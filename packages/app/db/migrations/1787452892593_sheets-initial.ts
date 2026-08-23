import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("sheet")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("display_id", "uuid", (col) =>
      col
        .unique()
        .defaultTo(sql`gen_random_uuid()`)
        .notNull(),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("owner_id", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
    .addColumn("pool_id", "integer", (col) =>
      col.notNull().references("pool.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}
