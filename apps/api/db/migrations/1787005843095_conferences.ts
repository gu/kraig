import type { Kysely } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  await db
    .insertInto("ext_conference")
    .values({
      slug: "acc",
      display_name_short: "ACC",
    })
    .execute();

  await db
    .insertInto("ext_conference")
    .values({
      slug: "b1g",
      display_name_short: "Big 10",
    })
    .execute();

  await db
    .insertInto("ext_conference")
    .values({
      slug: "b12",
      display_name_short: "Big 12",
    })
    .execute();

  await db
    .insertInto("ext_conference")
    .values({
      slug: "sec",
      display_name_short: "SEC",
    })
    .execute();

  await db
    .insertInto("ext_conference")
    .values({
      slug: "p12",
      display_name_short: "Pac-12",
    })
    .execute();
}
