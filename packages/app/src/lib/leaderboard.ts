import { isFinal, pickResult, type ScoredGame } from "#/components/picks/board";
import type { PickType } from "#/lib/pool-settings";
import { pickPoints } from "#/lib/scoring";

export interface LeaderboardSheet {
  id: number;
  displayId: string;
  name: string;
  /** Owner's display name */
  owner: string;
  mine: boolean;
  picks: readonly { game_id: number; team_id: number }[];
}

export interface Rank {
  /** 1-based, shared by tied sheets */
  rank: number;
  tied: boolean;
}

export interface LeaderboardRow extends LeaderboardSheet, Rank {
  points: number;
  /** Points from the latest week with results */
  weekPoints: number;
  wins: number;
  losses: number;
  /** Season rank before the latest week, null when it's the first week with results */
  previousRank: number | null;
}

export interface Leaderboard {
  /** Latest week with a final pick in the pool, null before any results */
  throughWeek: number | null;
  /** Sorted by season rank */
  rows: LeaderboardRow[];
}

/**
 * Standard competition ranking, highest first: two values tied for 2nd are both 2nd and the next
 * is 4th
 */
export function competitionRanks(values: readonly number[]): Rank[] {
  return values.map((value, i) => ({
    rank: 1 + values.filter((other) => other > value).length,
    tied: values.some((other, j) => j !== i && other === value),
  }));
}

export function buildLeaderboard(
  sheets: readonly LeaderboardSheet[],
  games: readonly (ScoredGame & { id: number })[],
  pickType: PickType,
): Leaderboard {
  const gamesById = new Map(games.map((g) => [g.id, g]));

  let throughWeek: number | null = null;
  for (const sheet of sheets) {
    for (const pick of sheet.picks) {
      const game = gamesById.get(pick.game_id);
      if (game && isFinal(game) && (throughWeek === null || game.week > throughWeek)) {
        throughWeek = game.week;
      }
    }
  }

  const scored = sheets.map((sheet) => {
    let points = 0;
    let weekPoints = 0;
    let earlierFinal = false;
    let wins = 0;
    let losses = 0;
    for (const pick of sheet.picks) {
      const game = gamesById.get(pick.game_id);
      if (!game || !isFinal(game)) continue;
      const result = pickResult(game, pick.team_id, pickType);
      const earned = pickPoints(result, game.week, true) ?? 0;
      points += earned;
      if (game.week === throughWeek) weekPoints += earned;
      else earlierFinal = true;
      if (result === "win") wins++;
      if (result === "loss") losses++;
    }
    return { ...sheet, points, weekPoints, wins, losses, earlierFinal };
  });

  const ranks = competitionRanks(scored.map((s) => s.points));
  const previous = competitionRanks(scored.map((s) => s.points - s.weekPoints));
  const hasPreviousWeek = scored.some((s) => s.earlierFinal);

  const rows = scored.map(({ earlierFinal: _, ...sheet }, i) => ({
    ...sheet,
    ...ranks[i],
    previousRank: hasPreviousWeek ? previous[i].rank : null,
  }));
  rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  return { throughWeek, rows };
}

/** Wins as a share of decided picks, null before any */
export function winRate(row: Pick<LeaderboardRow, "wins" | "losses">) {
  const decided = row.wins + row.losses;
  return decided === 0 ? null : row.wins / decided;
}

export type LeaderboardScope = "season" | "week";

export interface ScopedRow extends LeaderboardRow {
  /** Points for the scope: the season total or the latest week's */
  shown: number;
  /** Rank by `shown` */
  scopedRank: Rank;
  /** Places gained (positive) or lost since last week, null when not tracked */
  movement: number | null;
}

/** Rows ranked and sorted for the season, or for the latest week alone */
export function scopeLeaderboard(rows: readonly LeaderboardRow[], scope: LeaderboardScope) {
  const shown = rows.map((r) => (scope === "season" ? r.points : r.weekPoints));
  const ranks = competitionRanks(shown);
  const scoped: ScopedRow[] = rows.map((row, i) => ({
    ...row,
    shown: shown[i],
    scopedRank: ranks[i],
    movement: scope === "season" && row.previousRank !== null ? row.previousRank - row.rank : null,
  }));
  return scoped.sort(
    (a, b) => a.scopedRank.rank - b.scopedRank.rank || a.name.localeCompare(b.name),
  );
}

/** e.g. "T-3" */
export function rankLabel({ rank, tied }: Rank) {
  return `${tied ? "T-" : ""}${rank}`;
}
