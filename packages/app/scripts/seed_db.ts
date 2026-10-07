import { z } from "zod";
import { getYear } from "date-fns";
import { createClients, syncApRankings, syncGames, syncLines } from "./lib/external.ts";

const { client, db } = createClients();

// #region Defined allowed conference abbreviations. Pulled directly from CFBD
const AllowedConferenceAbbreviations: readonly string[] = [
  "ACC",
  "B12",
  "B1G",
  "PAC",
  "SEC",
  "Ind",
];
// #endregion

// #region Get external conference data
const ConferenceResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string(),
  abbreviation: z.string().nullish(),
  classification: z.string(),
  memberCount: z.number(),
});
const rawConferencesResponse = await client
  .get("https://api.collegefootballdata.com/conferences", {
    searchParams: {
      year: getYear(new Date()),
    },
  })
  .json();
const conferencesResponse = z.array(ConferenceResponseSchema).parse(rawConferencesResponse);
const conferenceData = conferencesResponse.filter(
  (c) => c.abbreviation && AllowedConferenceAbbreviations.includes(c.abbreviation),
);
const conferenceIds = conferenceData.map((c) => c.id);
const conferenceNames = conferenceData.map((c) => c.name);
console.log(`> Got ${conferenceData.length} conference entries to insert`);
// #endregion

// #region Update conference data in db
const currentConferenceIds = (await db.selectFrom("ext_conference").select("id").execute()).map(
  (c) => c.id,
);

const conferenceIdsToRemove = currentConferenceIds.filter((c) => !conferenceIds.includes(c));

await db.transaction().execute(async (trx) => {
  if (conferenceIdsToRemove.length > 0) {
    const deleteConferencesResult = await trx
      .deleteFrom("ext_conference")
      .where("id", "in", conferenceIdsToRemove)
      .executeTakeFirstOrThrow();
    console.log(`> Removed ${deleteConferencesResult.numDeletedRows} conferences`);
  }

  const insertConferencesResult = await trx
    .insertInto("ext_conference")
    .values(
      conferenceData.map((c) => ({
        id: c.id,
        abbreviation: c.abbreviation!,
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
    .executeTakeFirstOrThrow();
  console.log(
    `> Inserted/Updated ${insertConferencesResult.numInsertedOrUpdatedRows} conferences into database`,
  );
});
// #endregion

// #region Get external teams data
const TeamSchema = z.object({
  id: z.number(),
  school: z.string(),
  abbreviation: z.string().nullish(),
  conference: z.string(),
  logos: z.array(z.string()).nullish(),
});
const rawTeamsResponse = await client
  .get("https://api.collegefootballdata.com/teams", {
    searchParams: {
      year: getYear(new Date()),
    },
  })
  .json();
const allTeamsResponse = z.array(TeamSchema).parse(rawTeamsResponse);
const teamData = allTeamsResponse.filter(
  (t) => t.conference && conferenceNames.includes(t.conference),
);
const teamIds = teamData.map((t) => t.id);
// #endregion

// #region Update team data in db
const currentTeamIds = (await db.selectFrom("ext_team").select("id").execute()).map((t) => t.id);

const teamIdsToRemove = currentTeamIds.filter((t) => !teamIds.includes(t));

await db.transaction().execute(async (trx) => {
  if (teamIdsToRemove.length > 0) {
    const deleteTeamsResult = await trx
      .deleteFrom("ext_team")
      .where("id", "in", teamIdsToRemove)
      .executeTakeFirstOrThrow();
    console.log(`> Removed ${deleteTeamsResult.numDeletedRows} teams`);
  }

  const insertTeamsResult = await trx
    .insertInto("ext_team")
    .values(
      teamData.map((t) => ({
        id: t.id,
        abbreviation: t.abbreviation,
        school: t.school,
        conference: t.conference,
        logo_url: t.logos?.[0],
      })),
    )
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        abbreviation: eb.ref("excluded.abbreviation"),
        school: eb.ref("excluded.school"),
        conference: eb.ref("excluded.conference"),
        logo_url: eb.ref("excluded.logo_url"),
      })),
    )
    .executeTakeFirstOrThrow();
  console.log(
    `> Inserted/Updated ${insertTeamsResult.numInsertedOrUpdatedRows} teams into database`,
  );
});
// #endregion

// #region Update game, betting line and AP ranking data in db
const gameIds = await syncGames({ client, db, schools: teamData.map((t) => t.school) });
await syncLines({
  client,
  db,
  conferenceAbbreviations: conferenceData.map((c) => c.abbreviation!),
  gameIds,
});
await syncApRankings({ client, db });
// #endregion

// #region Cleanup
await db.destroy();
console.log();
console.log("> Completed");
// #endregion
