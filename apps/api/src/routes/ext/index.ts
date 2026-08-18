import { getConferences } from "@/cfbd/conferences";
import { getTeamsOfConference } from "@/cfbd/teams";
import { db } from "@/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const ext = new Hono();

ext.post("/conferences", async (c) => {
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

ext.post("/conferences/:conference/teams", async (c) => {
  const conferenceParam = c.req.param("conference");

  c.var.logger.info(`Refreshing teams in conference ${conferenceParam} from external source`);

  const conference = await db
    .selectFrom("ext_conference")
    .select(["id", "abbreviation"])
    .where(({ eb, fn }) => eb(fn("lower", ["abbreviation"]), "=", conferenceParam.toLowerCase()))
    .executeTakeFirst();

  if (!conference) {
    throw new HTTPException(404, { message: "Conference not found" });
  }

  const teams = await getTeamsOfConference(conference.abbreviation);

  const teamIds = teams.map((t) => t.id);

  const currentTeams = await db
    .selectFrom("ext_team")
    .select("id")
    .where("conference_id", "=", conference.id)
    .execute();

  const currentTeamIds = currentTeams.map((c) => c.id);

  const teamsToRemove = currentTeamIds.filter((item) => !teamIds.includes(item));

  await db.transaction().execute(async (trx) => {
    if (teamsToRemove.length > 0) {
      await trx.deleteFrom("ext_team").where("id", "in", teamsToRemove).execute();
    }

    await trx
      .insertInto("ext_team")
      .values(
        teams.map((team) => ({
          id: team.id,
          school: team.school,
          abbreviation: team.abbreviation,
          conference_id: conference.id,
        })),
      )
      .onConflict((oc) =>
        oc.column("id").doUpdateSet((eb) => ({
          abbreviation: eb.ref("excluded.abbreviation"),
          school: eb.ref("excluded.school"),
          conference_id: eb.ref("excluded.conference_id"),
        })),
      )
      .execute();
  });

  return c.json({ success: true });
});

export default ext;
