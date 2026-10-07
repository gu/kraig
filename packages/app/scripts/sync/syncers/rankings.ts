import { z } from "zod";
import type { Syncer } from "./index.ts";
import { syncTable } from "../sync-table.ts";

const Poll = "AP Top 25";

const RankSchema = z.object({
  rank: z.number(),
  teamId: z.number(),
  school: z.string(),
  conference: z.string().nullish(),
  firstPlaceVotes: z.number().nullish(),
  points: z.number().nullish(),
});
const RankingWeekSchema = z.object({
  season: z.number(),
  seasonType: z.string(),
  week: z.number(),
  polls: z.array(z.object({ poll: z.string(), ranks: z.array(RankSchema) })),
});

export const rankings: Syncer = {
  name: "rankings",
  async run(ctx) {
    // Omitting `week` returns every regular season week released so far
    const response = await ctx.cfbd.get(
      "rankings",
      { year: ctx.year, seasonType: "regular" },
      z.array(RankingWeekSchema),
    );

    // Keyed by (week, team) since tied teams share a rank
    const rankingData = Array.from(
      new Map(
        response.flatMap((w) =>
          w.polls
            .filter((p) => p.poll === Poll)
            .flatMap((p) =>
              p.ranks.map((r) => [
                `${w.week}:${r.teamId}`,
                {
                  week: w.week,
                  team_id: r.teamId,
                  rank: r.rank,
                  school: r.school,
                  conference: r.conference,
                  first_place_votes: r.firstPlaceVotes,
                  points: r.points,
                },
              ]),
            ),
        ),
      ).values(),
    );

    return syncTable(ctx, {
      table: "ext_ranking",
      keys: ["week", "team_id"],
      rows: rankingData,
    });
  },
};
