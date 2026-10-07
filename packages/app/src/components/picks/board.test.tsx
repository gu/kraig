import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import { buildBoard, rankedName } from "./board";
import { GameCard } from "./game-card";
import { WeekPicksCard } from "./week-picks-card";

const now = new Date("2026-09-10T00:00:00Z");

const team = (id: number, school: string) => ({
  id,
  school,
  abbreviation: school.slice(0, 3).toUpperCase(),
  logo_url: null,
});

const game = (id: number, week: number, homeId: number, awayId: number) => ({
  id,
  week,
  start_date: week === 1 ? "2026-09-05T16:00:00.000Z" : "2026-09-12T16:00:00.000Z",
  home_id: homeId,
  home_team: null,
  away_id: awayId,
  away_team: null,
  home_spread: -3.5,
  over_under: null,
});

const board = (overrides: Partial<SheetBoard> = {}): SheetBoard => ({
  games: [game(100, 1, 1, 2), game(200, 2, 1, 3)],
  teams: [team(1, "Texas"), team(2, "Ohio State"), team(3, "Michigan")],
  rankings: [
    { week: 1, team_id: 1, rank: 1 },
    { week: 1, team_id: 2, rank: 4 },
    { week: 2, team_id: 1, rank: 2 },
  ],
  picks: [],
  ...overrides,
});

describe("buildBoard rankings", () => {
  it("gives each team its AP rank for the game's week", () => {
    const { weeks } = buildBoard(board(), now);

    const [week1, week2] = weeks;
    expect([week1.games[0].home.rank, week1.games[0].away.rank]).toEqual([1, 4]);
    // Texas moved to #2 for week 2 and Michigan is unranked
    expect([week2.games[0].home.rank, week2.games[0].away.rank]).toEqual([2, null]);
  });

  it("leaves every team unranked when a week has no poll yet", () => {
    const { weeks } = buildBoard(board({ rankings: [] }), now);
    expect(weeks.flatMap((w) => w.games.flatMap((g) => [g.home.rank, g.away.rank]))).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("rankedName", () => {
  it("prefixes the rank when ranked", () => {
    expect(rankedName({ name: "Texas", rank: 3 })).toBe("#3 Texas");
    expect(rankedName({ name: "Michigan", rank: null })).toBe("Michigan");
  });
});

describe("pick components", () => {
  const week2 = () => buildBoard(board({ picks: [{ game_id: 200, team_id: 3 }] }), now).weeks[1];

  it("shows ranks on the team buttons in a game card", () => {
    const html = renderToStaticMarkup(
      <GameCard game={week2().games[0]} busy={false} onPick={() => {}} />,
    );

    expect(html).toMatch(/>#2<\/span>Texas</);
    expect(html).not.toMatch(/#\d+<\/span>Michigan/);
    expect(html).toContain('aria-label="Michigan at #2 Texas"');
  });

  it("shows the opponent's rank in the week's picks", () => {
    const html = renderToStaticMarkup(
      <WeekPicksCard week={week2()} busy={false} onRemove={() => {}} />,
    );

    expect(html).toContain("at #2 Texas");
  });
});
