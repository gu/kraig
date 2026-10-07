import { PICKS_PER_WEEK } from "../../src/lib/picks.ts";

export type Game = { id: number; week: number; home_id: number; away_id: number };
export type Pick = { game_id: number; team_id: number };
export type Random = () => number;

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Randomly picks a team from games in each of `weeks`, topping each week up to PICKS_PER_WEEK.
 * Follows the same rules as saving a pick in the app: one pick per game, and each team only once
 * per sheet (counting `existing` picks), and only `teams` we have records for. A week ends up short
 * if it runs out of eligible games.
 */
export function chooseRandomPicks({
  games,
  teams,
  weeks,
  existing,
  random = Math.random,
}: {
  games: readonly Game[];
  teams: ReadonlySet<number>;
  weeks: readonly number[];
  existing: readonly Pick[];
  random?: Random;
}): Pick[] {
  const weekByGame = new Map(games.map((g) => [g.id, g.week]));
  const pickedGames = new Set(existing.map((p) => p.game_id));
  const usedTeams = new Set(existing.map((p) => p.team_id));
  const picks: Pick[] = [];

  for (const week of weeks) {
    let count = existing.filter((p) => weekByGame.get(p.game_id) === week).length;

    for (const game of shuffle(
      games.filter((g) => g.week === week),
      random,
    )) {
      if (count >= PICKS_PER_WEEK) break;
      if (pickedGames.has(game.id)) continue;

      const team = shuffle([game.home_id, game.away_id], random).find(
        (t) => teams.has(t) && !usedTeams.has(t),
      );
      if (team === undefined) continue;

      picks.push({ game_id: game.id, team_id: team });
      pickedGames.add(game.id);
      usedTeams.add(team);
      count++;
    }
  }

  return picks;
}
