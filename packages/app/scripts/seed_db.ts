import ky from "ky";
import dotenv from "dotenv";
import { z } from "zod";
import { getYear } from "date-fns";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "@db/types";

// #region Read in config from env
dotenv.config({ path: [".env.local", ".env"] });
const ConfigSchema = z.object({
  DATABASE_URL: z.string(),
  CFBD_API_KEY: z.string(),
});
const config = ConfigSchema.parse(process.env);
// #endregion

// #region Create clients
const client = ky.create({
  headers: {
    Authorization: `Bearer ${config.CFBD_API_KEY}`,
  },
});
const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DATABASE_URL,
  }),
});
const db = new Kysely<DB>({ dialect });
// #endregion

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
      })),
    )
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        abbreviation: eb.ref("excluded.abbreviation"),
        school: eb.ref("excluded.school"),
        conference: eb.ref("excluded.conference"),
      })),
    )
    .executeTakeFirstOrThrow();
  console.log(
    `> Inserted/Updated ${insertTeamsResult.numInsertedOrUpdatedRows} teams into database`,
  );
});
// #endregion

// #region Get external games data
const GameSchema = z.object({
  id: z.number(),
  week: z.number(),
  startDate: z.iso.datetime(),
  conferenceGame: z.boolean(),
  homeId: z.number(),
  homeConference: z.string(),
  awayId: z.number(),
  awayConference: z.string(),
});
const allGamesRaw = await Promise.all(
  teamData.map(async (t) => {
    const rawGameResponse = await client
      .get("https://api.collegefootballdata.com/games", {
        searchParams: {
          year: getYear(new Date()),
          team: t.school,
        },
      })
      .json();
    return z.array(GameSchema).parse(rawGameResponse);
  }),
);
const allGamesDupe = allGamesRaw.flat();
const gameData = Array.from(new Map(allGamesDupe.map((g) => [g.id, g])).values());
const gameIds = gameData.map((g) => g.id);
// #endregion

// #region Update game data in db
const currentGameIds = (await db.selectFrom("ext_game").select("id").execute()).map((t) => t.id);

const gameIdsToRemove = currentGameIds.filter((g) => !gameIds.includes(g));

await db.transaction().execute(async (trx) => {
  if (gameIdsToRemove.length > 0) {
    const deleteGamesResult = await trx
      .deleteFrom("ext_game")
      .where("id", "in", gameIdsToRemove)
      .executeTakeFirstOrThrow();
    console.log(`> Removed ${deleteGamesResult.numDeletedRows} games`);
  }

  const insertGamesResult = await trx
    .insertInto("ext_game")
    .values(
      gameData.map((g) => ({
        id: g.id,
        week: g.week,
        start_date: g.startDate,
        conference_game: g.conferenceGame,
        away_id: g.awayId,
        away_conference: g.awayConference,
        home_id: g.homeId,
        home_conference: g.homeConference,
      })),
    )
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        week: eb.ref("excluded.week"),
        start_date: eb.ref("excluded.start_date"),
        conference_game: eb.ref("excluded.conference_game"),
        away_id: eb.ref("excluded.away_id"),
        away_conference: eb.ref("excluded.away_conference"),
        home_id: eb.ref("excluded.home_id"),
        home_conference: eb.ref("excluded.home_conference"),
      })),
    )
    .executeTakeFirstOrThrow();
  console.log(
    `> Inserted/Updated ${insertGamesResult.numInsertedOrUpdatedRows} games into database`,
  );
});
// #endregion

// #region Get external betting line data
const GameLineSchema = z.object({
  provider: z.string(),
  spread: z.number().nullable(),
  formattedSpread: z.string(),
  spreadOpen: z.number().nullable(),
  overUnder: z.number().nullable(),
  overUnderOpen: z.number().nullable(),
  homeMoneyline: z.number().nullable(),
  awayMoneyline: z.number().nullable(),
});
const BettingGameSchema = z.object({
  id: z.number(),
  lines: z.array(GameLineSchema),
});
const allBettingGamesRaw = await Promise.all(
  conferenceData.map(async (c) => {
    const rawLinesResponse = await client
      .get("https://api.collegefootballdata.com/lines", {
        searchParams: {
          year: getYear(new Date()),
          conference: c.abbreviation!,
        },
      })
      .json();
    return z.array(BettingGameSchema).parse(rawLinesResponse);
  }),
);
const bettingGameData = Array.from(
  new Map(allBettingGamesRaw.flat().map((g) => [g.id, g])).values(),
).filter((g) => gameIds.includes(g.id));
const lineData = bettingGameData.flatMap((g) =>
  g.lines.map((l) => ({
    game_id: g.id,
    provider: l.provider,
    spread: l.spread,
    formatted_spread: l.formattedSpread,
    spread_open: l.spreadOpen,
    over_under: l.overUnder,
    over_under_open: l.overUnderOpen,
    home_moneyline: l.homeMoneyline,
    away_moneyline: l.awayMoneyline,
  })),
);
console.log(`> Got ${lineData.length} betting line entries to insert`);
// #endregion

// #region Update betting line data in db
await db.transaction().execute(async (trx) => {
  // Replace all lines so that lines a provider no longer offers are removed
  const deleteLinesResult = await trx.deleteFrom("ext_line").executeTakeFirstOrThrow();
  console.log(`> Removed ${deleteLinesResult.numDeletedRows} betting lines`);

  if (lineData.length > 0) {
    const insertLinesResult = await trx
      .insertInto("ext_line")
      .values(lineData)
      .executeTakeFirstOrThrow();
    console.log(
      `> Inserted ${insertLinesResult.numInsertedOrUpdatedRows} betting lines into database`,
    );
  }
});
// #endregion

// #region Cleanup
await db.destroy();
console.log();
console.log("> Completed");
// #endregion
