import type { BoardGame, BoardTeam, SheetBoard } from "#/hooks/use-sheet-picks";
import { getOpenWeek, getWeekState, hasStarted, type WeekState } from "#/lib/picks";
import { isConferenceInPool, type PickType, type PoolSettings } from "#/lib/pool-settings";
import { pickPoints, winValue } from "#/lib/scoring";
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
  /** AP Top 25 rank going into this game's week */
  rank: number | null;
  spread: number | null;
  state: TeamPickState;
  usedWeek: number | null;
  /** Final score, null until the game is final */
  points: number | null;
  /** Whether a pick of this team won, under the pool's pick type. Null until the game is final,
   * and for a tie or a push against the spread */
  result: PickResult | null;
}

export interface GameView {
  game: BoardGame;
  started: boolean;
  away: TeamView;
  home: TeamView;
}

export type PickResult = "win" | "loss";

export interface PickView {
  game: GameView;
  team: TeamView;
  /** Null until the game is final */
  result: PickResult | null;
  /** Points earned, null until the game is final */
  points: number | null;
}

export interface WeekView {
  week: number;
  state: WeekState;
  dates: string;
  games: GameView[];
  picks: PickView[];
  picksPerWeek: number;
  /** Points a winning pick earns this week */
  winValue: number;
  /** Points earned by this week's final picks */
  points: number;
}

/** Team name prefixed with its AP rank, e.g. "#4 Texas" */
export function rankedName(team: Pick<TeamView, "name" | "rank">) {
  return team.rank === null ? team.name : `#${team.rank} ${team.name}`;
}

export function formatSpread(spread: number | null) {
  if (spread === null) return null;
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

/** Whether `game` is final with a score */
export function isFinal(game: Pick<ScoredGame, "completed" | "home_points" | "away_points">) {
  return game.completed && game.home_points !== null && game.away_points !== null;
}

/**
 * Whether a pick of `teamId` won `game`, once the game is final. Against the spread, the team's
 * points plus its spread must beat the opponent's (a game without a line counts as a pick'em).
 * Null for a tie or a push
 */
export function pickResult(
  game: ScoredGame,
  teamId: number,
  pickType: PickType = "outright",
): PickResult | null {
  if (!isFinal(game)) return null;
  const isHome = teamId === game.home_id;
  const [ours, theirs] = isHome
    ? [game.home_points!, game.away_points!]
    : [game.away_points!, game.home_points!];
  const homeSpread = pickType === "spread" ? (game.home_spread ?? 0) : 0;
  const margin = ours - theirs + (isHome ? homeSpread : -homeSpread);
  if (margin === 0) return null;
  return margin > 0 ? "win" : "loss";
}

/** The parts of a game scoring needs. Spelled out, since BoardGame is inferred from a server
 * function that scores sheets */
export interface ScoredGame {
  week: number;
  home_id: number;
  completed: boolean;
  home_points: number | null;
  away_points: number | null;
  home_spread: number | null;
}

/** A sheet's season points, and how many of its picks have been decided */
export function scoreSheet(
  picks: readonly { game_id: number; team_id: number }[],
  gamesById: ReadonlyMap<number, ScoredGame>,
  pickType: PickType,
) {
  let points = 0;
  let decided = 0;
  for (const pick of picks) {
    const game = gamesById.get(pick.game_id);
    if (!game || !isFinal(game)) continue;
    decided++;
    points += pickPoints(pickResult(game, pick.team_id, pickType), game.week, true) ?? 0;
  }
  return { points, decided };
}

function formatDates(games: BoardGame[]) {
  const first = new Date(games[0].start_date);
  const last = new Date(games[games.length - 1].start_date);
  if (format(first, "yyyy-MM-dd") === format(last, "yyyy-MM-dd")) return format(first, "MMM d");
  if (isSameMonth(first, last)) return `${format(first, "MMM d")}–${format(last, "d")}`;
  return `${format(first, "MMM d")} – ${format(last, "MMM d")}`;
}

export function buildBoard(board: SheetBoard, now: Date) {
  const settings: PoolSettings = board.pool;
  const teamsById = new Map(board.teams.map((t) => [t.id, t]));
  // Teams outside the pool's conferences can't be picked
  const inPool = (id: number) => {
    const team = teamsById.get(id);
    return team !== undefined && isConferenceInPool(settings, team.conference);
  };
  const gamesById = new Map(board.games.map((g) => [g.id, g]));
  const openWeek = getOpenWeek(board.games, now);
  const rankByWeekTeam = new Map(board.rankings.map((r) => [`${r.week}:${r.team_id}`, r.rank]));

  const pickByGame = new Map(board.picks.map((p) => [p.game_id, p.team_id]));
  const pickedWeekByTeam = new Map<number, { week: number; gameId: number }>();
  const pickCountByWeek = new Map<number, number>();
  for (const pick of board.picks) {
    const game = gamesById.get(pick.game_id);
    if (!game) continue;
    pickedWeekByTeam.set(pick.team_id, { week: game.week, gameId: game.id });
    pickCountByWeek.set(game.week, (pickCountByWeek.get(game.week) ?? 0) + 1);
  }

  // Games without a team in the pool aren't worth listing
  const gamesByWeek = new Map<number, BoardGame[]>();
  for (const game of board.games) {
    if (!inPool(game.home_id) && !inPool(game.away_id)) continue;
    gamesByWeek.set(game.week, [...(gamesByWeek.get(game.week) ?? []), game]);
  }

  const weeks: WeekView[] = [...gamesByWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, games]) => {
      const state = getWeekState(week, openWeek);
      const full = (pickCountByWeek.get(week) ?? 0) >= settings.picksPerWeek;

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
        } else if (!inPool(id)) {
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
          rank: rankByWeekTeam.get(`${week}:${id}`) ?? null,
          spread:
            game.home_spread === null
              ? null
              : side === "home"
                ? game.home_spread
                : -game.home_spread,
          state: pickState,
          usedWeek,
          points: isFinal(game) ? (side === "home" ? game.home_points : game.away_points) : null,
          result: pickResult(game, id, settings.pickType),
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

      const picks: PickView[] = gameViews.flatMap((g) => {
        const pickedTeamId = pickByGame.get(g.game.id);
        if (pickedTeamId === undefined) return [];
        const result = pickedTeamId === g.home.id ? g.home.result : g.away.result;
        return [
          {
            game: g,
            team: pickedTeamId === g.home.id ? g.home : g.away,
            result,
            points: pickPoints(result, week, isFinal(g.game)),
          },
        ];
      });

      return {
        week,
        state,
        dates: formatDates(games),
        games: gameViews,
        picks,
        picksPerWeek: settings.picksPerWeek,
        winValue: winValue(week),
        points: picks.reduce((sum, p) => sum + (p.points ?? 0), 0),
      };
    });

  return { weeks, openWeek };
}
