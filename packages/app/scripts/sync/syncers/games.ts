import { z } from "zod";
import { requireRows, type Syncer } from "./index.ts";
import { syncTable } from "../sync-table.ts";

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
  completed: z.boolean(),
  // Null until the game is final
  homePoints: z.number().nullable(),
  awayPoints: z.number().nullable(),
});

export const games: Syncer = {
  name: "games",
  async run(ctx) {
    const conferences = requireRows(
      "ext_conference",
      await ctx.db.selectFrom("ext_conference").select("abbreviation").execute(),
    );
    const teams = requireRows(
      "ext_team",
      await ctx.db.selectFrom("ext_team").select("id").execute(),
    );
    const teamIds = new Set(teams.map((t) => t.id));

    // One request per conference rather than per team keeps the request count low
    const responses = await ctx.cfbd.getMany(
      conferences,
      (c) => ({
        path: "games",
        searchParams: { year: ctx.year, seasonType: "regular", conference: c.abbreviation },
      }),
      z.array(GameSchema),
    );
    const gameData = Array.from(new Map(responses.flat().map((g) => [g.id, g])).values()).filter(
      (g) => teamIds.has(g.homeId) || teamIds.has(g.awayId),
    );

    return syncTable(ctx, {
      table: "ext_game",
      keys: ["id"],
      rows: gameData.map((g) => ({
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
        completed: g.completed,
        home_points: g.homePoints,
        away_points: g.awayPoints,
      })),
    });
  },
};
