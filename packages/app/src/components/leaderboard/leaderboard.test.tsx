import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildLeaderboard,
  competitionRanks,
  scopeLeaderboard,
  winRate,
  type LeaderboardSheet,
} from "#/lib/leaderboard";
import { LeaderboardCard } from "./leaderboard-card";
import { LeaderboardTable } from "./leaderboard-table";
import { MySheetTile } from "./my-sheet-tile";

// Router Links need a router; the card's link markup isn't under test
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));

const game = (
  id: number,
  week: number,
  score: [home: number, away: number] | null,
  homeSpread: number | null = null,
) => ({
  id,
  week,
  home_id: id * 10,
  completed: score !== null,
  home_points: score?.[0] ?? null,
  away_points: score?.[1] ?? null,
  home_spread: homeSpread,
});

// Home teams win every final game. Week 1 wins are worth 1, week 5 wins 2
const games = [
  game(1, 1, [20, 10]),
  game(2, 1, [20, 10]),
  game(5, 5, [20, 10], -14),
  game(6, 5, [20, 10]),
  game(9, 9, null),
];
const home = (gameId: number) => ({ game_id: gameId, team_id: gameId * 10 });
const away = (gameId: number) => ({ game_id: gameId, team_id: gameId * 10 + 1 });

const sheet = (
  id: number,
  name: string,
  picks: LeaderboardSheet["picks"],
  mine = false,
): LeaderboardSheet => ({
  id,
  displayId: `sheet-${id}`,
  name,
  owner: mine ? "Freddy" : `Owner ${id}`,
  mine,
  picks,
});

const sheets = [
  // Week 1: 2, week 5: 0 → 2
  sheet(1, "Early Bird", [home(1), home(2), away(5), away(6)]),
  // Week 1: 0, week 5: 4 → 4
  sheet(2, "Late Surge", [away(1), away(2), home(5), home(6)], true),
  // Week 1: 1, week 5: 2 → 3
  sheet(3, "Steady", [home(1), away(2), away(5), home(6), home(9)]),
  // Same as Steady
  sheet(4, "Copycat", [home(1), away(2), away(5), home(6)], true),
  sheet(5, "No Picks", []),
];

const leaderboard = buildLeaderboard(sheets, games, "outright");
const byName = Object.fromEntries(leaderboard.rows.map((r) => [r.name, r]));

describe("competitionRanks", () => {
  it("shares ranks on ties and skips the places they take", () => {
    expect(competitionRanks([5, 9, 5, 1])).toEqual([
      { rank: 2, tied: true },
      { rank: 1, tied: false },
      { rank: 2, tied: true },
      { rank: 4, tied: false },
    ]);
  });
});

describe("buildLeaderboard", () => {
  it("ranks sheets by season points, ties sorted by name", () => {
    expect(leaderboard.throughWeek).toBe(5);
    expect(leaderboard.rows.map((r) => [r.name, r.points, r.rank, r.tied])).toEqual([
      ["Late Surge", 4, 1, false],
      ["Copycat", 3, 2, true],
      ["Steady", 3, 2, true],
      ["Early Bird", 2, 4, false],
      ["No Picks", 0, 5, false],
    ]);
  });

  it("tracks the latest week's points, record and movement", () => {
    expect(byName["Late Surge"]).toMatchObject({ weekPoints: 4, wins: 2, losses: 2 });
    // Early Bird led after week 1 and fell to 4th
    expect(byName["Early Bird"].previousRank).toBe(1);
    expect(byName["Late Surge"].previousRank).toBe(4);
    // A pick in an unplayed game doesn't count toward the record
    expect(byName["Steady"]).toMatchObject({ wins: 2, losses: 2 });
    expect(winRate(byName["No Picks"])).toBeNull();
    expect(winRate(byName["Steady"])).toBe(0.5);
  });

  it("scores spread pools by covering", () => {
    const spread = buildLeaderboard(sheets, games, "spread");
    // Game 5's home team won by 10 as a 14-point favorite, so the away pick covered
    expect(Object.fromEntries(spread.rows.map((r) => [r.name, r.points]))).toMatchObject({
      "Early Bird": 4,
      "Late Surge": 2,
    });
  });

  it("has no standings or movement before results", () => {
    const fresh = buildLeaderboard(sheets, [game(9, 9, null)], "outright");
    expect(fresh.throughWeek).toBeNull();
    const firstWeek = buildLeaderboard(sheets, games.slice(0, 2), "outright");
    expect(firstWeek.throughWeek).toBe(1);
    expect(firstWeek.rows.every((r) => r.previousRank === null)).toBe(true);
  });
});

describe("scopeLeaderboard", () => {
  it("ranks the season with movement since last week", () => {
    const rows = scopeLeaderboard(leaderboard.rows, "season");
    expect(rows[0]).toMatchObject({ name: "Late Surge", shown: 4, movement: 3 });
    expect(rows.find((r) => r.name === "Early Bird")?.movement).toBe(-3);
  });

  it("re-ranks by the latest week alone, without movement", () => {
    const rows = scopeLeaderboard(leaderboard.rows, "week");
    expect(rows.map((r) => [r.name, r.shown, r.scopedRank.rank])).toEqual([
      ["Late Surge", 4, 1],
      ["Copycat", 2, 2],
      ["Steady", 2, 2],
      ["Early Bird", 0, 4],
      ["No Picks", 0, 4],
    ]);
    expect(rows.every((r) => r.movement === null)).toBe(true);
  });
});

describe("LeaderboardTable", () => {
  const html = renderToStaticMarkup(
    <LeaderboardTable rows={scopeLeaderboard(leaderboard.rows, "season")} throughWeek={5} />,
  );

  it("marks ties, the viewer's sheets and movement", () => {
    expect(html.match(/>T-2</g)).toHaveLength(2);
    expect(html.match(/>You</g)).toHaveLength(2);
    expect(html).toContain("Up </span>3");
    expect(html).toContain("Down </span>3");
    expect(html).toContain(">Week 5<");
  });

  it("shows the record and win rate", () => {
    expect(html).toContain("2–2");
    expect(html).toContain(">50%<");
    expect(html).toContain(">–<");
  });
});

describe("MySheetTile", () => {
  it("shows the rank and the gap to 1st", () => {
    const rows = scopeLeaderboard(leaderboard.rows, "season");
    const copycat = rows.find((r) => r.name === "Copycat")!;
    const html = renderToStaticMarkup(<MySheetTile row={copycat} total={5} leader={4} />);
    expect(html).toContain(">T-2nd<");
    expect(html).toContain("1 pt behind 1st");
    expect(renderToStaticMarkup(<MySheetTile row={rows[0]} total={5} leader={4} />)).toContain(
      "Leading the pool",
    );
  });
});

describe("LeaderboardCard", () => {
  it("lists the top sheets and pins the viewer's sheets below them", () => {
    const html = renderToStaticMarkup(
      <LeaderboardCard leaderboard={leaderboard} poolDisplayId="pool" topCount={1} />,
    );
    expect(html).toContain("Through week 5");
    expect(html).toContain("Late Surge");
    expect(html).toContain("Your other sheets");
    expect(html).toContain("Copycat");
    expect(html).not.toContain("Early Bird");
    expect(html).toContain("View full leaderboard");
  });

  it("explains when there are no standings yet", () => {
    const html = renderToStaticMarkup(
      <LeaderboardCard
        leaderboard={{ throughWeek: null, rows: leaderboard.rows }}
        poolDisplayId="pool"
      />,
    );
    expect(html).toContain("Standings start once the first picks are final.");
    expect(html).not.toContain("Through week");
  });
});
