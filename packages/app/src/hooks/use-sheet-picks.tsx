import { getOpenWeek } from "#/lib/picks";
import { isConferenceInPool, toPoolSettings } from "#/lib/pool-settings";
import { scoreSheet } from "#/components/picks/board";
import { loadGamesWithLines } from "#/lib/games";
import { queryClient } from "#/lib/query-client";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

/** The user's sheet, with the settings of the pool it's in */
async function getOwnedSheet(userId: string, sheetDisplayId: string) {
  const sheet = await db
    .selectFrom("sheet")
    .innerJoin("pool", "pool.id", "sheet.pool_id")
    .select([
      "sheet.id",
      "sheet.pool_id",
      "pool.conferences",
      "pool.max_sheets",
      "pool.picks_per_week",
      "pool.pick_type",
    ])
    .where("sheet.owner_id", "=", userId)
    .where("sheet.display_id", "=", sheetDisplayId)
    .executeTakeFirstOrThrow();

  return { id: sheet.id, poolId: sheet.pool_id, settings: toPoolSettings(sheet) };
}

const getSheetBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ sheetDisplayId: z.string() }))
  .handler(async ({ context, data }) => {
    const sheet = await getOwnedSheet(context.user.id, data.sheetDisplayId);

    const [boardGames, teams, rankings, poolSheets, poolPicks] = await Promise.all([
      loadGamesWithLines(),
      db
        .selectFrom("ext_team")
        .select(["id", "school", "abbreviation", "logo_url", "conference"])
        .execute(),
      // AP Top 25. A week's poll is the ranking teams carry into that week's games
      db.selectFrom("ext_ranking").select(["week", "team_id", "rank"]).execute(),
      db.selectFrom("sheet").select("id").where("pool_id", "=", sheet.poolId).execute(),
      // Every sheet's picks in the pool, for the standings
      db
        .selectFrom("sheet_pick")
        .innerJoin("sheet", "sheet.id", "sheet_pick.sheet_id")
        .select(["sheet_pick.sheet_id", "sheet_pick.game_id", "sheet_pick.team_id"])
        .where("sheet.pool_id", "=", sheet.poolId)
        .execute(),
    ]);
    const picks = poolPicks
      .filter((p) => p.sheet_id === sheet.id)
      .map(({ game_id, team_id }) => ({ game_id, team_id }));

    const gamesById = new Map(boardGames.map((g) => [g.id, g]));
    const picksBySheet = new Map<number, typeof poolPicks>();
    for (const pick of poolPicks) {
      picksBySheet.set(pick.sheet_id, [...(picksBySheet.get(pick.sheet_id) ?? []), pick]);
    }

    return {
      games: boardGames,
      teams,
      rankings,
      picks,
      pool: sheet.settings,
      sheetId: sheet.id,
      // Points for every sheet in the pool, this one included
      standings: poolSheets.map(({ id }) => ({
        sheetId: id,
        ...scoreSheet(picksBySheet.get(id) ?? [], gamesById, sheet.settings.pickType),
      })),
    };
  });

const savePick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sheetDisplayId: z.string(), gameId: z.number(), teamId: z.number() }))
  .handler(async ({ context, data }) => {
    const { id: sheetId, settings } = await getOwnedSheet(context.user.id, data.sheetDisplayId);
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      const games = await trx.selectFrom("ext_game").select(["id", "week", "start_date"]).execute();
      const openWeek = getOpenWeek(
        games.map((g) => ({ week: g.week, start_date: g.start_date.toISOString() })),
        now,
      );
      const game = games.find((g) => g.id === data.gameId);

      if (!game) throw new Error("Game not found");
      if (game.start_date <= now) throw new Error("This game has already started");
      if (game.week !== openWeek) throw new Error(`Picks for week ${game.week} aren't open`);

      const team = await trx
        .selectFrom("ext_game")
        .innerJoin("ext_team", (join) =>
          join.on((eb) =>
            eb.or([
              eb("ext_team.id", "=", eb.ref("ext_game.home_id")),
              eb("ext_team.id", "=", eb.ref("ext_game.away_id")),
            ]),
          ),
        )
        .select(["ext_team.id", "ext_team.conference"])
        .where("ext_game.id", "=", data.gameId)
        .where("ext_team.id", "=", data.teamId)
        .executeTakeFirst();
      if (!team) throw new Error("That team can't be picked for this game");
      if (!isConferenceInPool(settings, team.conference)) {
        throw new Error("That team's conference isn't in this pool");
      }

      const usedElsewhere = await trx
        .selectFrom("sheet_pick")
        .select("id")
        .where("sheet_id", "=", sheetId)
        .where("team_id", "=", data.teamId)
        .where("game_id", "!=", data.gameId)
        .executeTakeFirst();
      if (usedElsewhere) throw new Error("You've already picked this team this season");

      const existing = await trx
        .selectFrom("sheet_pick")
        .select("id")
        .where("sheet_id", "=", sheetId)
        .where("game_id", "=", data.gameId)
        .executeTakeFirst();

      if (existing) {
        // Switching to the other team in a game already picked
        await trx
          .updateTable("sheet_pick")
          .set({ team_id: data.teamId, updated_at: now })
          .where("id", "=", existing.id)
          .execute();
        return;
      }

      const { count } = await trx
        .selectFrom("sheet_pick")
        .innerJoin("ext_game", "ext_game.id", "sheet_pick.game_id")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("sheet_pick.sheet_id", "=", sheetId)
        .where("ext_game.week", "=", game.week)
        .executeTakeFirstOrThrow();
      if (Number(count) >= settings.picksPerWeek) {
        throw new Error(`You can only make ${settings.picksPerWeek} picks per week`);
      }

      await trx
        .insertInto("sheet_pick")
        .values({ sheet_id: sheetId, game_id: data.gameId, team_id: data.teamId })
        .execute();
    });
  });

const removePick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sheetDisplayId: z.string(), gameId: z.number() }))
  .handler(async ({ context, data }) => {
    const { id: sheetId } = await getOwnedSheet(context.user.id, data.sheetDisplayId);

    const game = await db
      .selectFrom("ext_game")
      .select("start_date")
      .where("id", "=", data.gameId)
      .executeTakeFirstOrThrow();
    if (game.start_date <= new Date()) throw new Error("This game has already started");

    await db
      .deleteFrom("sheet_pick")
      .where("sheet_id", "=", sheetId)
      .where("game_id", "=", data.gameId)
      .execute();
  });

export type SheetBoard = Awaited<ReturnType<typeof getSheetBoard>>;
export type BoardGame = SheetBoard["games"][number];
export type BoardTeam = SheetBoard["teams"][number];

export function useSheetBoard(sheetDisplayId: string) {
  return useQuery({
    queryKey: ["sheet-board", sheetDisplayId],
    queryFn: () => getSheetBoard({ data: { sheetDisplayId } }),
  });
}

export function useSavePick(sheetDisplayId: string) {
  return useMutation({
    mutationFn: (pick: { gameId: number; teamId: number }) =>
      savePick({ data: { sheetDisplayId, ...pick } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["sheet-board", sheetDisplayId] }),
  });
}

export function useRemovePick(sheetDisplayId: string) {
  return useMutation({
    mutationFn: (gameId: number) => removePick({ data: { sheetDisplayId, gameId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["sheet-board", sheetDisplayId] }),
  });
}
