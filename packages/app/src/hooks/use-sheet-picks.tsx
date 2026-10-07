import { getOpenWeek, PICKS_PER_WEEK } from "#/lib/picks";
import { queryClient } from "#/lib/query-client";
import { authMiddleware } from "#/middleware/auth";
import db from "@db/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";

// Sportsbooks to take the spread from, in order of preference
const PREFERRED_PROVIDERS = ["DraftKings", "ESPN Bet", "Bovada"];

async function getOwnedSheetId(userId: string, sheetDisplayId: string) {
  const sheet = await db
    .selectFrom("sheet")
    .select("id")
    .where("owner_id", "=", userId)
    .where("display_id", "=", sheetDisplayId)
    .executeTakeFirstOrThrow();

  return sheet.id;
}

const getSheetBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ sheetDisplayId: z.string() }))
  .handler(async ({ context, data }) => {
    const sheetId = await getOwnedSheetId(context.user.id, data.sheetDisplayId);

    const [games, teams, lines, picks] = await Promise.all([
      db
        .selectFrom("ext_game")
        .select(["id", "week", "start_date", "home_id", "home_team", "away_id", "away_team"])
        .orderBy("start_date")
        .orderBy("id")
        .execute(),
      db.selectFrom("ext_team").select(["id", "school", "abbreviation", "logo_url"]).execute(),
      db.selectFrom("ext_line").select(["game_id", "provider", "spread", "over_under"]).execute(),
      db
        .selectFrom("sheet_pick")
        .select(["game_id", "team_id"])
        .where("sheet_id", "=", sheetId)
        .execute(),
    ]);

    const linesByGame = new Map<number, typeof lines>();
    for (const line of lines) {
      linesByGame.set(line.game_id, [...(linesByGame.get(line.game_id) ?? []), line]);
    }
    const rank = (provider: string) => {
      const index = PREFERRED_PROVIDERS.indexOf(provider);
      return index === -1 ? PREFERRED_PROVIDERS.length : index;
    };

    return {
      games: games.map((game) => {
        const line = (linesByGame.get(game.id) ?? [])
          .filter((l) => l.spread !== null)
          .sort((a, b) => rank(a.provider) - rank(b.provider))[0];

        return {
          ...game,
          start_date: game.start_date.toISOString(),
          // CFBD spreads are relative to the home team
          home_spread: line?.spread ?? null,
          over_under: line?.over_under ?? null,
        };
      }),
      teams,
      picks,
    };
  });

const savePick = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ sheetDisplayId: z.string(), gameId: z.number(), teamId: z.number() }))
  .handler(async ({ context, data }) => {
    const sheetId = await getOwnedSheetId(context.user.id, data.sheetDisplayId);
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
        .select("ext_team.id")
        .where("ext_game.id", "=", data.gameId)
        .where("ext_team.id", "=", data.teamId)
        .executeTakeFirst();
      if (!team) throw new Error("That team can't be picked for this game");

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
      if (Number(count) >= PICKS_PER_WEEK) {
        throw new Error(`You can only make ${PICKS_PER_WEEK} picks per week`);
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
    const sheetId = await getOwnedSheetId(context.user.id, data.sheetDisplayId);

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
