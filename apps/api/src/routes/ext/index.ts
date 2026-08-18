import { getConferences } from "@/cfbd/conferences";
import { db } from "@/db";
import { Hono } from "hono";

const ext = new Hono();

ext.post("/conferences/refresh", async (c) => {
  c.var.logger.info("Refreshing conference data from external source");

  const conferences = await getConferences();

  await db
    .insertInto("ext_conference")
    .values(
      conferences.map((c) => ({
        id: c.id,
        abbreviation: c.abbreviation,
        short_name: c.shortName,
        name: c.name,
      })),
    )
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        abbreviation: eb.ref("excluded.abbreviation"),
        short_name: eb.ref("excluded.short_name"),
        name: eb.ref("excluded.name"),
      })),
    )
    .execute();

  return c.json({ status: "done" });
});

// ext.post("/teams/refresh", async (c) => {
//   c.var.logger.info("Starting to refresh external data");

//   const conferences = await db
//     .selectFrom("ext_conference")
//     .select(["slug", "display_name_short"])
//     .execute();

//   for (const conference of conferences) {
//     const teams = await getTeam;
//   }

//   return c.json({ success: true });
// });

export default ext;
