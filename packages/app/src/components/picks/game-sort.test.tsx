import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import { buildBoard } from "./board";
import { GameCard } from "./game-card";
import { GameSortMenu, isGameSort, sortGames } from "./game-sort";

const now = new Date("2026-09-10T00:00:00Z");

const game = (id: number, startDate: string, homeSpread: number | null) => ({
  id,
  week: 2,
  start_date: startDate,
  home_id: id * 10,
  home_team: `Home ${id}`,
  away_id: id * 10 + 1,
  away_team: `Away ${id}`,
  home_spread: homeSpread,
  over_under: null,
});

const boardData: SheetBoard = {
  // Listed out of kickoff order on purpose
  games: [
    game(1, "2026-09-12T23:00:00.000Z", -14),
    game(2, "2026-09-12T16:00:00.000Z", 3),
    game(3, "2026-09-13T00:00:00.000Z", null),
    game(4, "2026-09-12T19:30:00.000Z", -3),
    game(5, "2026-09-11T12:00:00.000Z", 21.5),
    game(6, "2026-09-12T12:00:00.000Z", null),
  ],
  teams: [],
  rankings: [],
  picks: [],
};

const games = buildBoard(boardData, now).weeks[0].games;
const sortedIds = (sort: Parameters<typeof sortGames>[1]) =>
  sortGames(games, sort).map((g) => g.game.id);

describe("sortGames", () => {
  it("sorts by kickoff time", () => {
    expect(sortedIds("time")).toEqual([5, 6, 2, 4, 1, 3]);
  });

  it("sorts the closest spreads first, regardless of which side is favored", () => {
    // Games 2 and 4 are both 3-point spreads, so the earlier kickoff wins
    expect(sortedIds("spreadClosest")).toEqual([2, 4, 1, 5, 6, 3]);
  });

  it("sorts the biggest favorites first", () => {
    expect(sortedIds("spreadLargest")).toEqual([5, 1, 2, 4, 6, 3]);
  });

  it("keeps games without a line last, in kickoff order", () => {
    for (const sort of ["spreadClosest", "spreadLargest"] as const) {
      expect(sortedIds(sort).slice(-2)).toEqual([6, 3]);
    }
  });

  it("doesn't mutate the input", () => {
    const before = games.map((g) => g.game.id);
    sortGames(games, "spreadLargest");
    expect(games.map((g) => g.game.id)).toEqual(before);
  });
});

describe("isGameSort", () => {
  it("accepts only known sorts", () => {
    expect(isGameSort("spreadClosest")).toBe(true);
    expect(isGameSort("spread")).toBe(false);
    expect(isGameSort(undefined)).toBe(false);
  });
});

describe("GameSortMenu", () => {
  it("shows the current sort on the trigger", () => {
    const html = renderToStaticMarkup(<GameSortMenu sort="spreadClosest" onChange={() => {}} />);
    expect(html).toContain('<span class="sr-only">Sort by </span>Closest spread');
  });
});

describe("GameCard showDate", () => {
  it("shows the kickoff day only when asked", () => {
    const game = games.find((g) => g.game.id === 5)!;
    const withDate = renderToStaticMarkup(
      <GameCard game={game} busy={false} onPick={() => {}} showDate />,
    );
    const withoutDate = renderToStaticMarkup(
      <GameCard game={game} busy={false} onPick={() => {}} />,
    );

    expect(withDate).toMatch(/>Fri, Sep 11</);
    expect(withoutDate).not.toContain("Sep 11");
  });
});
