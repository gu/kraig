import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { DB } from "@db/types";
import { conferences } from "./conferences.ts";
import { teams } from "./teams.ts";
import { games } from "./games.ts";
import { lines } from "./lines.ts";
import { rankings } from "./rankings.ts";
import {
  type CfbdRequest,
  conferenceRow,
  createFakeCfbd,
  createTestContext,
  createTestDb,
  gameRow,
  resetExtTables,
  teamRow,
} from "../test/helpers.ts";

// #region CFBD response fixtures
const apiConference = (id: number, abbreviation: string | null) => ({
  id,
  name: `${abbreviation} Conference`,
  shortName: abbreviation ?? `Conf ${id}`,
  abbreviation,
  classification: "fbs",
  memberCount: 14,
});

const apiTeam = (id: number, conference: string | null) => ({
  id,
  school: `School ${id}`,
  abbreviation: `S${id}`,
  conference,
  logos: [`https://logos.example/${id}.png`],
});

const apiGame = (id: number, homeId: number, awayId: number) => ({
  id,
  week: 1,
  startDate: "2026-09-05T16:00:00.000Z",
  conferenceGame: false,
  homeId,
  homeTeam: `School ${homeId}`,
  homeConference: "SEC",
  awayId,
  awayTeam: `School ${awayId}`,
  awayConference: "ACC",
});

const apiLine = (provider: string, spread: number) => ({
  provider,
  spread,
  formattedSpread: `Home ${spread}`,
  spreadOpen: null,
  overUnder: 50.5,
  overUnderOpen: null,
  homeMoneyline: null,
  awayMoneyline: null,
});

const apiRank = (rank: number, teamId: number) => ({
  rank,
  teamId,
  school: `School ${teamId}`,
  conference: "SEC",
  firstPlaceVotes: rank === 1 ? 60 : 0,
  points: 1600 - rank * 50,
});

const apiRankingWeek = (week: number, polls: Record<string, ReturnType<typeof apiRank>[]>) => ({
  season: 2026,
  seasonType: "regular",
  week,
  polls: Object.entries(polls).map(([poll, ranks]) => ({ poll, ranks })),
});
// #endregion

describe("syncers", () => {
  let db: Kysely<DB>;

  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await resetExtTables(db);
  });
  afterAll(async () => {
    await db.destroy();
  });

  const contextWith = (respond: (req: CfbdRequest) => unknown) => {
    const { cfbd, requests } = createFakeCfbd(respond);
    return { ctx: createTestContext(db, { cfbd }), requests };
  };

  const seedConferences = (...abbreviations: string[]) =>
    db
      .insertInto("ext_conference")
      .values(abbreviations.map((a, i) => ({ ...conferenceRow(i + 1, a), name: a })))
      .execute();

  describe("conferences", () => {
    it("syncs only the allowed conferences for the requested year", async () => {
      const { ctx, requests } = contextWith(() => [
        apiConference(1, "SEC"),
        apiConference(2, "B1G"),
        apiConference(3, "MAC"),
        apiConference(4, null),
      ]);

      const result = await conferences.run(ctx);

      expect(requests).toEqual([{ path: "conferences", searchParams: { year: 2026 } }]);
      expect(result.inserted).toBe(2);
      const rows = await db
        .selectFrom("ext_conference")
        .select("abbreviation")
        .orderBy("id")
        .execute();
      expect(rows).toEqual([{ abbreviation: "SEC" }, { abbreviation: "B1G" }]);
    });
  });

  describe("teams", () => {
    it("fails when conferences haven't been synced", async () => {
      const { ctx } = contextWith(() => []);
      await expect(teams.run(ctx)).rejects.toThrow(/ext_conference is empty/);
    });

    it("syncs teams in synced conferences and maps the first logo", async () => {
      await seedConferences("SEC");
      const { ctx } = contextWith(() => [apiTeam(1, "SEC"), apiTeam(2, "MAC"), apiTeam(3, null)]);

      await teams.run(ctx);

      expect(await db.selectFrom("ext_team").selectAll().execute()).toEqual([
        {
          id: 1,
          school: "School 1",
          abbreviation: "S1",
          conference: "SEC",
          logo_url: "https://logos.example/1.png",
        },
      ]);
    });
  });

  describe("games", () => {
    it("fails when teams haven't been synced", async () => {
      await seedConferences("SEC");
      const { ctx } = contextWith(() => []);
      await expect(games.run(ctx)).rejects.toThrow(/ext_team is empty/);
    });

    it("requests games per conference, dedupes them and keeps games involving synced teams", async () => {
      await seedConferences("SEC", "ACC");
      await db
        .insertInto("ext_team")
        .values([teamRow(1, "SEC"), teamRow(2, "ACC")])
        .execute();

      const { ctx, requests } = contextWith(({ searchParams }) =>
        searchParams.conference === "SEC"
          ? [apiGame(100, 1, 2), apiGame(101, 1, 99)]
          : // Game 100 shows up for both conferences; game 102 involves no synced team
            [apiGame(100, 1, 2), apiGame(102, 98, 99)],
      );

      const result = await games.run(ctx);

      expect(requests.map((r) => r.searchParams)).toEqual([
        { year: 2026, seasonType: "regular", conference: "SEC" },
        { year: 2026, seasonType: "regular", conference: "ACC" },
      ]);
      expect(result.fetched).toBe(2);
      expect(await db.selectFrom("ext_game").select("id").orderBy("id").execute()).toEqual([
        { id: 100 },
        { id: 101 },
      ]);
    });
  });

  describe("lines", () => {
    it("fails when games haven't been synced", async () => {
      await seedConferences("SEC");
      const { ctx } = contextWith(() => []);
      await expect(lines.run(ctx)).rejects.toThrow(/ext_game is empty/);
    });

    it("upserts lines for synced games and reports lines that are no longer offered", async () => {
      await seedConferences("SEC");
      await db
        .insertInto("ext_game")
        .values(gameRow(100, 1, 2))
        .execute();
      await db
        .insertInto("ext_line")
        .values({ game_id: 100, provider: "OldBook", formatted_spread: "Home -1" })
        .execute();

      const { ctx } = contextWith(() => [
        // Duplicate provider entries collapse to the last one
        { id: 100, lines: [apiLine("Bovada", -3), apiLine("Bovada", -4)] },
        // Unknown game is ignored
        { id: 999, lines: [apiLine("Bovada", -10)] },
      ]);

      const result = await lines.run(ctx);

      expect(result.fetched).toBe(1);
      expect(result.stale.map((l) => l.provider)).toEqual(["OldBook"]);
      const rows = await db
        .selectFrom("ext_line")
        .select(["game_id", "provider", "spread", "over_under"])
        .orderBy("provider")
        .execute();
      expect(rows).toEqual([
        { game_id: 100, provider: "Bovada", spread: -4, over_under: 50.5 },
        { game_id: 100, provider: "OldBook", spread: null, over_under: null },
      ]);
    });
  });

  describe("rankings", () => {
    it("syncs the AP Top 25 for every regular season week in one request", async () => {
      const { ctx, requests } = contextWith(() => [
        apiRankingWeek(1, {
          "AP Top 25": [apiRank(1, 10), apiRank(2, 20)],
          "Coaches Poll": [apiRank(1, 20), apiRank(2, 10)],
        }),
        apiRankingWeek(2, {
          "Coaches Poll": [apiRank(1, 10)],
          // Tied teams share a rank
          "AP Top 25": [apiRank(1, 20), apiRank(2, 10), apiRank(2, 30)],
        }),
      ]);

      const result = await rankings.run(ctx);

      expect(requests).toEqual([
        { path: "rankings", searchParams: { year: 2026, seasonType: "regular" } },
      ]);
      expect(result).toMatchObject({ fetched: 5, inserted: 5 });
      const rows = await db
        .selectFrom("ext_ranking")
        .select(["week", "rank", "team_id"])
        .orderBy(["week", "rank", "team_id"])
        .execute();
      expect(rows).toEqual([
        { week: 1, rank: 1, team_id: 10 },
        { week: 1, rank: 2, team_id: 20 },
        { week: 2, rank: 1, team_id: 20 },
        { week: 2, rank: 2, team_id: 10 },
        { week: 2, rank: 2, team_id: 30 },
      ]);
      expect(
        await db
          .selectFrom("ext_ranking")
          .selectAll()
          .where("team_id", "=", 10)
          .where("week", "=", 1)
          .executeTakeFirst(),
      ).toEqual({
        week: 1,
        team_id: 10,
        rank: 1,
        school: "School 10",
        conference: "SEC",
        first_place_votes: 60,
        points: 1550,
      });
    });

    it("updates a week's ranks and reports teams that dropped out as stale", async () => {
      await db
        .insertInto("ext_ranking")
        .values([
          { week: 1, team_id: 10, rank: 1, school: "School 10" },
          { week: 1, team_id: 99, rank: 2, school: "School 99" },
        ])
        .execute();
      const { ctx } = contextWith(() => [
        apiRankingWeek(1, { "AP Top 25": [apiRank(2, 10), apiRank(1, 20)] }),
      ]);

      const result = await rankings.run(ctx);

      expect(result).toMatchObject({ inserted: 1, updated: 1 });
      expect(result.stale).toMatchObject([{ week: 1, team_id: 99 }]);
      const ranks = await db
        .selectFrom("ext_ranking")
        .select(["team_id", "rank"])
        .orderBy("team_id")
        .execute();
      expect(ranks).toEqual([
        { team_id: 10, rank: 2 },
        { team_id: 20, rank: 1 },
        { team_id: 99, rank: 2 },
      ]);
    });
  });
});
