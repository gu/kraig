import type { BoardGame, BoardTeam, SheetBoard } from "#/hooks/use-sheet-picks";
import { getOpenWeek, getWeekState, hasStarted, PICKS_PER_WEEK, type WeekState } from "#/lib/picks";
import { format, isSameMonth } from "date-fns";

export type TeamPickState =
  | "open"
  | "swap"
  | "picked"
  | "lockedPick"
  | "used"
  | "started"
  | "closed"
  | "full"
  | "unavailable";

export interface TeamView {
  id: number;
  name: string;
  team: BoardTeam | undefined;
  spread: number | null;
  state: TeamPickState;
  usedWeek: number | null;
}

export interface GameView {
  game: BoardGame;
  started: boolean;
  away: TeamView;
  home: TeamView;
}

export interface PickView {
  game: GameView;
  team: TeamView;
}

export interface WeekView {
  week: number;
  state: WeekState;
  dates: string;
  games: GameView[];
  picks: PickView[];
}

export function formatSpread(spread: number | null) {
  if (spread === null) return null;
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

function formatDates(games: BoardGame[]) {
  const first = new Date(games[0].start_date);
  const last = new Date(games[games.length - 1].start_date);
  if (format(first, "yyyy-MM-dd") === format(last, "yyyy-MM-dd")) return format(first, "MMM d");
  if (isSameMonth(first, last)) return `${format(first, "MMM d")}–${format(last, "d")}`;
  return `${format(first, "MMM d")} – ${format(last, "MMM d")}`;
}

export function buildBoard(board: SheetBoard, now: Date) {
  const teamsById = new Map(board.teams.map((t) => [t.id, t]));
  const gamesById = new Map(board.games.map((g) => [g.id, g]));
  const openWeek = getOpenWeek(board.games, now);

  const pickByGame = new Map(board.picks.map((p) => [p.game_id, p.team_id]));
  const pickedWeekByTeam = new Map<number, { week: number; gameId: number }>();
  const pickCountByWeek = new Map<number, number>();
  for (const pick of board.picks) {
    const game = gamesById.get(pick.game_id);
    if (!game) continue;
    pickedWeekByTeam.set(pick.team_id, { week: game.week, gameId: game.id });
    pickCountByWeek.set(game.week, (pickCountByWeek.get(game.week) ?? 0) + 1);
  }

  const gamesByWeek = new Map<number, BoardGame[]>();
  for (const game of board.games) {
    gamesByWeek.set(game.week, [...(gamesByWeek.get(game.week) ?? []), game]);
  }

  const weeks: WeekView[] = [...gamesByWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, games]) => {
      const state = getWeekState(week, openWeek);
      const full = (pickCountByWeek.get(week) ?? 0) >= PICKS_PER_WEEK;

      const teamView = (game: BoardGame, side: "home" | "away", started: boolean): TeamView => {
        const id = side === "home" ? game.home_id : game.away_id;
        const otherId = side === "home" ? game.away_id : game.home_id;
        const team = teamsById.get(id);
        const used = pickedWeekByTeam.get(id);
        const usedWeek = used && used.gameId !== game.id ? used.week : null;
        const pickedTeamId = pickByGame.get(game.id);

        let pickState: TeamPickState;
        if (pickedTeamId === id) {
          pickState = started || state !== "open" ? "lockedPick" : "picked";
        } else if (!team) {
          pickState = "unavailable";
        } else if (usedWeek !== null) {
          pickState = "used";
        } else if (started) {
          pickState = "started";
        } else if (state !== "open") {
          pickState = "closed";
        } else if (pickedTeamId === otherId) {
          pickState = "swap";
        } else if (full) {
          pickState = "full";
        } else {
          pickState = "open";
        }

        return {
          id,
          name: team?.school ?? (side === "home" ? game.home_team : game.away_team) ?? "TBD",
          team,
          spread:
            game.home_spread === null
              ? null
              : side === "home"
                ? game.home_spread
                : -game.home_spread,
          state: pickState,
          usedWeek,
        };
      };

      const gameViews = games.map((game) => {
        const started = hasStarted(game, now);
        return {
          game,
          started,
          away: teamView(game, "away", started),
          home: teamView(game, "home", started),
        };
      });

      const picks = gameViews.flatMap((g) => {
        const pickedTeamId = pickByGame.get(g.game.id);
        if (pickedTeamId === undefined) return [];
        return [{ game: g, team: pickedTeamId === g.home.id ? g.home : g.away }];
      });

      return { week, state, dates: formatDates(games), games: gameViews, picks };
    });

  return { weeks, openWeek };
}
