import { z } from "zod";
import { requireRows, type Syncer } from "./index.ts";
import { syncTable } from "../sync-table.ts";

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

export const lines: Syncer = {
  name: "lines",
  async run(ctx) {
    const conferences = requireRows(
      "ext_conference",
      await ctx.db.selectFrom("ext_conference").select("abbreviation").execute(),
    );
    const games = requireRows(
      "ext_game",
      await ctx.db.selectFrom("ext_game").select("id").execute(),
    );
    const gameIds = new Set(games.map((g) => g.id));

    const responses = await ctx.cfbd.getMany(
      conferences,
      (c) => ({ path: "lines", searchParams: { year: ctx.year, conference: c.abbreviation } }),
      z.array(BettingGameSchema),
    );
    const bettingGameData = Array.from(
      new Map(responses.flat().map((g) => [g.id, g])).values(),
    ).filter((g) => gameIds.has(g.id));

    // A provider can appear more than once for a game; keep the last entry per (game, provider)
    const lineData = Array.from(
      new Map(
        bettingGameData.flatMap((g) =>
          g.lines.map((l) => [
            `${g.id}:${l.provider}`,
            {
              game_id: g.id,
              provider: l.provider,
              spread: l.spread,
              formatted_spread: l.formattedSpread,
              spread_open: l.spreadOpen,
              over_under: l.overUnder,
              over_under_open: l.overUnderOpen,
              home_moneyline: l.homeMoneyline,
              away_moneyline: l.awayMoneyline,
            },
          ]),
        ),
      ).values(),
    );

    return syncTable(ctx, {
      table: "ext_line",
      keys: ["game_id", "provider"],
      rows: lineData,
    });
  },
};
