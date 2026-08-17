import { db } from "@/db";
import { Hono } from "hono";

const ext = new Hono();

ext.post("/refresh", async (c) => {
  c.var.logger.info("Starting to refresh external data");

  const conferences = await db
    .selectFrom("ext_conference")
    .select(["slug", "display_name_short"])
    .execute();

  c.var.logger.info(conferences);

  return c.json({ success: true });
});

export default ext;
