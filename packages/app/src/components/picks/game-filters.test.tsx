import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import { buildBoard } from "./board";
import {
  ActiveGameFilters,
  GameFiltersMenu,
  isGameRanked,
  matchesGameFilters,
  type GameFilter,
} from "./game-filters";

// Week 2 is the open week
const now = new Date("2026-09-10T00:00:00Z");

const team = (id: number, school: string) => ({ id, school, abbreviation: null, logo_url: null });

const game = (id: number, homeId: number, awayId: number) => ({
  id,
  week: 2,
  start_date: "2026-09-12T16:00:00.000Z",
  home_id: homeId,
  home_team: `Team ${homeId}`,
  away_id: awayId,
  away_team: `Team ${awayId}`,
  home_spread: null,
  over_under: null,
});

const boardData: SheetBoard = {
  games: [
    game(1, 1, 2), // pickable, ranked
    game(2, 2, 3), // pickable, unranked
    game(3, 8, 9), // teams outside the pool, ranked
    game(4, 6, 7), // teams outside the pool, unranked
  ],
  teams: [team(1, "Texas"), team(2, "Michigan"), team(3, "Purdue")],
  rankings: [
    { week: 2, team_id: 1, rank: 3 },
    { week: 2, team_id: 9, rank: 20 },
    // A different week's poll doesn't count
    { week: 1, team_id: 2, rank: 10 },
  ],
  picks: [],
};

const games = buildBoard(boardData, now).weeks[0].games;
const shownIds = (filters: GameFilter[]) =>
  games.filter((g) => matchesGameFilters(g, filters)).map((g) => g.game.id);

describe("matchesGameFilters", () => {
  it("shows every game with no filters", () => {
    expect(shownIds([])).toEqual([1, 2, 3, 4]);
  });

  it("shows games with a team to pick", () => {
    expect(shownIds(["pickable"])).toEqual([1, 2]);
  });

  it("shows games with a ranked team", () => {
    expect(shownIds(["ranked"])).toEqual([1, 3]);
  });

  it("requires every active filter to match", () => {
    expect(shownIds(["pickable", "ranked"])).toEqual([1]);
  });

  it("only counts ranks from the game's week", () => {
    expect(isGameRanked(games[1])).toBe(false);
  });
});

describe("GameFiltersMenu", () => {
  it("shows how many filters are active on the trigger", () => {
    const none = renderToStaticMarkup(<GameFiltersMenu filters={[]} onChange={() => {}} />);
    const two = renderToStaticMarkup(
      <GameFiltersMenu filters={["pickable", "ranked"]} onChange={() => {}} />,
    );

    expect(none).toContain("Filters");
    expect(none).not.toContain("sr-only");
    expect(two).toMatch(/2<span class="sr-only"> active<\/span>/);
  });
});

describe("ActiveGameFilters", () => {
  it("renders nothing without active filters", () => {
    const html = renderToStaticMarkup(
      <ActiveGameFilters filters={[]} onChange={() => {}} shown={4} total={4} />,
    );
    expect(html).toBe("");
  });

  it("lists each active filter with the matching game count", () => {
    const html = renderToStaticMarkup(
      <ActiveGameFilters filters={["ranked"]} onChange={() => {}} shown={2} total={4} />,
    );

    expect(html).toContain("Showing 2 of 4 games");
    expect(html).toContain('aria-label="Remove filter: Has a ranked team"');
    expect(html).not.toContain("Has a team to pick");
    expect(html).toContain("Clear all");
  });
});
