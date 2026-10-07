import { describe, expect, it } from "vitest";
import { DEFAULT_PICKS_PER_WEEK } from "../../src/lib/pool-settings.ts";
import { chooseRandomPicks, type Game } from "./choose.ts";

// Week w has `count` games between unique teams
function makeGames(weeks: number, count: number): Game[] {
  const games: Game[] = [];
  for (let week = 1; week <= weeks; week++) {
    for (let i = 0; i < count; i++) {
      const id = week * 100 + i;
      games.push({ id, week, home_id: id * 2, away_id: id * 2 + 1 });
    }
  }
  return games;
}

function allTeams(games: Game[]) {
  return new Set(games.flatMap((g) => [g.home_id, g.away_id]));
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

describe("chooseRandomPicks", () => {
  it("makes the default number of picks for each requested week only", () => {
    const games = makeGames(4, 10);
    const picks = chooseRandomPicks({
      games,
      teams: allTeams(games),
      weeks: [1, 2, 3],
      existing: [],
      random: seeded(1),
    });

    const weekOf = (gameId: number) => games.find((g) => g.id === gameId)!.week;
    for (const week of [1, 2, 3]) {
      expect(picks.filter((p) => weekOf(p.game_id) === week)).toHaveLength(DEFAULT_PICKS_PER_WEEK);
    }
    expect(picks.some((p) => weekOf(p.game_id) === 4)).toBe(false);
  });

  it("follows the pool's picks per week", () => {
    const games = makeGames(2, 10);
    const picks = chooseRandomPicks({
      games,
      teams: allTeams(games),
      weeks: [1, 2],
      existing: [],
      picksPerWeek: 2,
      random: seeded(3),
    });

    expect(picks.filter((p) => p.game_id < 200)).toHaveLength(2);
    expect(picks.filter((p) => p.game_id >= 200)).toHaveLength(2);
  });

  it("picks a team playing in the game", () => {
    const games = makeGames(2, 10);
    for (const pick of chooseRandomPicks({
      games,
      teams: allTeams(games),
      weeks: [1, 2],
      existing: [],
    })) {
      const game = games.find((g) => g.id === pick.game_id)!;
      expect([game.home_id, game.away_id]).toContain(pick.team_id);
    }
  });

  it("tops up weeks with existing picks and never reuses a team or game", () => {
    const games = makeGames(2, 10);
    const existing = [
      { game_id: 100, team_id: 200 },
      { game_id: 101, team_id: 203 },
    ];
    const picks = chooseRandomPicks({
      games,
      teams: allTeams(games),
      weeks: [1, 2],
      existing,
      random: seeded(2),
    });

    expect(picks.filter((p) => p.game_id < 200)).toHaveLength(DEFAULT_PICKS_PER_WEEK - 2);
    expect(picks.map((p) => p.game_id)).not.toContain(100);
    expect(picks.map((p) => p.game_id)).not.toContain(101);
    const teams = [...existing, ...picks].map((p) => p.team_id);
    expect(new Set(teams).size).toBe(teams.length);
  });

  it("uses the other team when one side has already been picked", () => {
    // The same two teams play each other every week
    const games: Game[] = [1, 2].map((week) => ({ id: week, week, home_id: 10, away_id: 20 }));
    const picks = chooseRandomPicks({ games, teams: allTeams(games), weeks: [1, 2], existing: [] });

    expect(picks).toHaveLength(2);
    expect(new Set(picks.map((p) => p.team_id))).toEqual(new Set([10, 20]));
  });

  it("only picks known teams", () => {
    const games: Game[] = [{ id: 1, week: 1, home_id: 10, away_id: 20 }];
    const picks = chooseRandomPicks({ games, teams: new Set([20]), weeks: [1], existing: [] });

    expect(picks).toEqual([{ game_id: 1, team_id: 20 }]);
  });

  it("leaves a week short when it runs out of eligible games", () => {
    const games = makeGames(1, 2);
    expect(
      chooseRandomPicks({ games, teams: allTeams(games), weeks: [1], existing: [] }),
    ).toHaveLength(2);
  });
});
