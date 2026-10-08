import { loadGamesWithLines } from "#/lib/games";
import { buildLeaderboard } from "#/lib/leaderboard";
import { toPoolSettings } from "#/lib/pool-settings";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

const getPoolLeaderboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ poolDisplayId: z.string() }))
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const pool = await db
      .selectFrom("pool")
      .select(["id", "conferences", "max_sheets", "picks_per_week", "pick_type"])
      .where("owner_id", "=", userId)
      .where("display_id", "=", data.poolDisplayId)
      .executeTakeFirstOrThrow();

    const [games, sheets, picks] = await Promise.all([
      loadGamesWithLines(),
      db
        .selectFrom("sheet")
        .innerJoin("user", "user.id", "sheet.owner_id")
        .select([
          "sheet.id",
          "sheet.display_id",
          "sheet.name",
          "sheet.owner_id",
          "user.name as owner",
        ])
        .where("sheet.pool_id", "=", pool.id)
        .execute(),
      db
        .selectFrom("sheet_pick")
        .innerJoin("sheet", "sheet.id", "sheet_pick.sheet_id")
        .select(["sheet_pick.sheet_id", "sheet_pick.game_id", "sheet_pick.team_id"])
        .where("sheet.pool_id", "=", pool.id)
        .execute(),
    ]);

    return buildLeaderboard(
      sheets.map((sheet) => ({
        id: sheet.id,
        displayId: sheet.display_id,
        name: sheet.name,
        owner: sheet.owner,
        mine: sheet.owner_id === userId,
        picks: picks
          .filter((p) => p.sheet_id === sheet.id)
          .map(({ game_id, team_id }) => ({ game_id, team_id })),
      })),
      games,
      toPoolSettings(pool).pickType,
    );
  });

export function useLeaderboard(poolDisplayId: string) {
  return useQuery({
    queryKey: ["leaderboard", poolDisplayId],
    queryFn: () => getPoolLeaderboard({ data: { poolDisplayId } }),
  });
}
