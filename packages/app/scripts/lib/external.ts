import ky, { type KyInstance } from "ky";
import dotenv from "dotenv";
import { z } from "zod";
import { getYear } from "date-fns";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "@db/types";

// #region Create clients from env config
export function createClients() {
  dotenv.config({ path: [".env.local", ".env"] });
  const ConfigSchema = z.object({
    DATABASE_URL: z.string(),
    CFBD_API_KEY: z.string(),
  });
  const config = ConfigSchema.parse(process.env);

  const client = ky.create({
    headers: {
      Authorization: `Bearer ${config.CFBD_API_KEY}`,
    },
    // Back off when rate limited (429) or the API is struggling. A Retry-After header from the
    // API takes precedence over the delay below.
    retry: {
      limit: 6,
      delay: (attemptCount) => 1000 * 2 ** (attemptCount - 1),
      backoffLimit: 30_000,
      jitter: true,
    },
  });
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: config.DATABASE_URL,
    }),
  });
  const db = new Kysely<DB>({ dialect });

  return { client, db };
}
// #endregion

// #region Request throttling
// Keep the number of in-flight API requests low so a sync doesn't trip the API's rate limit
const MAX_CONCURRENT_REQUESTS = 4;
const DELAY_BETWEEN_REQUESTS_MS = 250;

/** Like `Promise.all(items.map(fn))`, but runs at most `MAX_CONCURRENT_REQUESTS` at a time. */
async function mapThrottled<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, items.length) }, () => worker()),
  );
  return results;
}
// #endregion

// #region Sync game data
const GameSchema = z.object({
  id: z.number(),
  week: z.number(),
  startDate: z.iso.datetime(),
  conferenceGame: z.boolean(),
  homeId: z.number(),
  homeTeam: z.string(),
  homeConference: z.string(),
  awayId: z.number(),
  awayTeam: z.string(),
  awayConference: z.string(),
});

/** Pulls this season's regular season games for the given schools and upserts them. */
export async function syncGames({
  client,
  db,
  schools,
}: {
  client: KyInstance;
  db: Kysely<DB>;
  schools: string[];
}) {
  const allGamesRaw = await mapThrottled(schools, async (school) => {
    const rawGameResponse = await client
      .get("https://api.collegefootballdata.com/games", {
        searchParams: {
          year: getYear(new Date()),
          seasonType: "regular",
          team: school,
        },
      })
      .json();
    return z.array(GameSchema).parse(rawGameResponse);
  });
  const allGamesDupe = allGamesRaw.flat();
  const gameData = Array.from(new Map(allGamesDupe.map((g) => [g.id, g])).values());
  const gameIds = gameData.map((g) => g.id);
  console.log(`> Got ${gameData.length} game entries to insert`);

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

    if (gameData.length === 0) return;

    const insertGamesResult = await trx
      .insertInto("ext_game")
      .values(
        gameData.map((g) => ({
          id: g.id,
          week: g.week,
          start_date: g.startDate,
          conference_game: g.conferenceGame,
          away_id: g.awayId,
          away_team: g.awayTeam,
          away_conference: g.awayConference,
          home_id: g.homeId,
          home_team: g.homeTeam,
          home_conference: g.homeConference,
        })),
      )
      .onConflict((oc) =>
        oc.column("id").doUpdateSet((eb) => ({
          week: eb.ref("excluded.week"),
          start_date: eb.ref("excluded.start_date"),
          conference_game: eb.ref("excluded.conference_game"),
          away_id: eb.ref("excluded.away_id"),
          away_team: eb.ref("excluded.away_team"),
          away_conference: eb.ref("excluded.away_conference"),
          home_id: eb.ref("excluded.home_id"),
          home_team: eb.ref("excluded.home_team"),
          home_conference: eb.ref("excluded.home_conference"),
        })),
      )
      .executeTakeFirstOrThrow();
    console.log(
      `> Inserted/Updated ${insertGamesResult.numInsertedOrUpdatedRows} games into database`,
    );
  });

  return gameIds;
}
// #endregion

// #region Sync betting line data
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

/** Pulls this season's betting lines for the given conferences and replaces the stored lines. */
export async function syncLines({
  client,
  db,
  conferenceAbbreviations,
  gameIds,
}: {
  client: KyInstance;
  db: Kysely<DB>;
  conferenceAbbreviations: string[];
  gameIds: number[];
}) {
  const allBettingGamesRaw = await mapThrottled(conferenceAbbreviations, async (abbreviation) => {
    const rawLinesResponse = await client
      .get("https://api.collegefootballdata.com/lines", {
        searchParams: {
          year: getYear(new Date()),
          conference: abbreviation,
        },
      })
      .json();
    return z.array(BettingGameSchema).parse(rawLinesResponse);
  });
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
}
// #endregion

// #region Sync AP poll rankings
const PollRankSchema = z.object({
  rank: z.number().nullable(),
  teamId: z.number(),
  school: z.string(),
  conference: z.string().nullable(),
  firstPlaceVotes: z.number().nullable(),
  points: z.number().nullable(),
});
const PollWeekSchema = z.object({
  week: z.number(),
  polls: z.array(z.object({ poll: z.string(), ranks: z.array(PollRankSchema) })),
});

/** Pulls this season's weekly AP Top 25 rankings and replaces the stored rankings. */
export async function syncApRankings({ client, db }: { client: KyInstance; db: Kysely<DB> }) {
  const rawRankingsResponse = await client
    .get("https://api.collegefootballdata.com/rankings", {
      searchParams: {
        year: getYear(new Date()),
        seasonType: "regular",
      },
    })
    .json();
  const pollWeeks = z.array(PollWeekSchema).parse(rawRankingsResponse);
  const rankingData = pollWeeks.flatMap((w) =>
    w.polls
      .filter((p) => p.poll === "AP Top 25")
      .flatMap((p) => p.ranks)
      .filter((r) => r.rank !== null)
      .map((r) => ({
        week: w.week,
        team_id: r.teamId,
        school: r.school,
        conference: r.conference,
        rank: r.rank!,
        first_place_votes: r.firstPlaceVotes,
        points: r.points,
      })),
  );
  console.log(
    `> Got ${rankingData.length} AP ranking entries across ${new Set(rankingData.map((r) => r.week)).size} weeks to insert`,
  );

  await db.transaction().execute(async (trx) => {
    // Replace all rankings so that corrected or removed entries don't linger
    const deleteRankingsResult = await trx.deleteFrom("ext_ap_ranking").executeTakeFirstOrThrow();
    console.log(`> Removed ${deleteRankingsResult.numDeletedRows} AP rankings`);

    if (rankingData.length > 0) {
      const insertRankingsResult = await trx
        .insertInto("ext_ap_ranking")
        .values(rankingData)
        .executeTakeFirstOrThrow();
      console.log(
        `> Inserted ${insertRankingsResult.numInsertedOrUpdatedRows} AP rankings into database`,
      );
    }
  });
}
// #endregion
