import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import { DEFAULT_POOL_SETTINGS } from "#/lib/pool-settings";
import { describeScoring, formatStanding, pickPoints, standing, winValue } from "#/lib/scoring";
import { RulesCard } from "#/components/rules-card";
import { buildBoard, scoreSheet } from "./board";
import { SheetStats, sheetStats } from "./sheet-stats";
import { pickDetail, WeekPicksCard } from "./week-picks-card";
import { WeekTabs } from "./week-tabs";

// Weeks 1, 5 and 9 are over; week 13 hasn't kicked off
const now = new Date("2026-11-20T00:00:00Z");

const START_BY_WEEK: Record<number, string> = {
  1: "2026-09-05T16:00:00.000Z",
  5: "2026-10-03T16:00:00.000Z",
  9: "2026-10-31T16:00:00.000Z",
  13: "2026-11-28T16:00:00.000Z",
};

const team = (id: number, school: string) => ({
  id,
  school,
  abbreviation: null,
  logo_url: null,
  conference: "SEC",
});

const game = (
  id: number,
  week: number,
  homeId: number,
  awayId: number,
  score: [home: number, away: number] | null,
  homeSpread: number | null = null,
) => ({
  id,
  week,
  start_date: START_BY_WEEK[week],
  home_id: homeId,
  home_team: null,
  away_id: awayId,
  away_team: null,
  home_spread: homeSpread,
  over_under: null,
  completed: score !== null,
  home_points: score?.[0] ?? null,
  away_points: score?.[1] ?? null,
});

const boardData = (overrides: Partial<SheetBoard> = {}): SheetBoard => ({
  games: [
    game(10, 1, 1, 2, [30, 10]),
    game(11, 1, 3, 4, [10, 30]),
    game(50, 5, 1, 5, [21, 14]),
    game(51, 5, 6, 2, [17, 17], -3),
    game(90, 9, 3, 7, [28, 3], -10),
    game(130, 13, 4, 8, null),
  ],
  teams: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => team(id, `Team ${id}`)),
  rankings: [],
  picks: [
    { game_id: 10, team_id: 1 }, // week 1 win: 1
    { game_id: 11, team_id: 3 }, // week 1 loss: 0
    { game_id: 50, team_id: 5 }, // week 5 loss: 0
    { game_id: 51, team_id: 6 }, // week 5 tie: 0
    { game_id: 90, team_id: 3 }, // week 9 win: 3
    { game_id: 130, team_id: 4 }, // week 13, not played yet
  ],
  pool: DEFAULT_POOL_SETTINGS,
  sheetId: 1,
  standings: [],
  ...overrides,
});

describe("winValue", () => {
  it("steps up every four weeks", () => {
    const values = [0, 1, 4, 5, 8, 9, 12, 13, 15].map(winValue);
    expect(values).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("pickPoints", () => {
  it("awards the week's value for a win and nothing for a loss or push", () => {
    expect(pickPoints("win", 10, true)).toBe(3);
    expect(pickPoints("loss", 10, true)).toBe(0);
    expect(pickPoints(null, 10, true)).toBe(0);
  });

  it("has no points until the game is final", () => {
    expect(pickPoints(null, 10, false)).toBeNull();
  });
});

describe("board points", () => {
  const { weeks } = buildBoard(boardData(), now);
  const byWeek = Object.fromEntries(weeks.map((w) => [w.week, w]));

  it("totals each week's final picks", () => {
    expect(weeks.map((w) => [w.week, w.winValue, w.points])).toEqual([
      [1, 1, 1],
      [5, 2, 0],
      [9, 3, 3],
      [13, 4, 0],
    ]);
    expect(byWeek[13].picks[0].points).toBeNull();
    expect(byWeek[5].picks.map((p) => p.points)).toEqual([0, 0]);
  });

  it("scores spread pools by covering", () => {
    const spread = buildBoard(
      boardData({ pool: { ...DEFAULT_POOL_SETTINGS, pickType: "spread" } }),
      now,
    );
    // Team 6 tied as a 3-point favorite: didn't cover. Team 3 won by 25 as a 10-point favorite
    const points = Object.fromEntries(spread.weeks.map((w) => [w.week, w.points]));
    expect(points).toEqual({ 1: 1, 5: 0, 9: 3, 13: 0 });
  });

  it("adds up the season in the sheet stats", () => {
    expect(sheetStats(weeks).points).toBe(4);
    expect(renderToStaticMarkup(<SheetStats weeks={weeks} standing={null} />)).toMatch(
      /Points<\/dt><dd[^>]*>4</,
    );
  });

  it("shows the points each pick earned", () => {
    expect(pickDetail(byWeek[9].picks[0])).toBe("vs Team 7 · W 28–3 · +3");
    expect(pickDetail(byWeek[5].picks[1])).toBe("vs Team 2 · P 17–17 · +0");
    expect(pickDetail(byWeek[13].picks[0])).not.toContain("+");
  });

  it("shows the week's win value on the picks card", () => {
    const html = renderToStaticMarkup(
      <WeekPicksCard week={byWeek[13]} busy={false} onRemove={() => {}} />,
    );
    expect(html).toContain("4 pts per win");
  });

  it("shows points on finished weeks' tabs", () => {
    const html = renderToStaticMarkup(
      <WeekTabs weeks={weeks} selectedWeek={13} onSelect={() => {}} />,
    );
    expect(html).toContain(">1 pt<");
    expect(html).toContain(">0 pts<");
    expect(html).toContain(">3 pts<");
    expect(html).toContain("1/5 picked");
  });
});

describe("scoring rules", () => {
  it("describes every tier", () => {
    expect(describeScoring()).toBe(
      "1 pt in weeks 1–4, 2 in weeks 5–8, 3 in weeks 9–12 and 4 from week 13 on",
    );
    expect(renderToStaticMarkup(<RulesCard settings={DEFAULT_POOL_SETTINGS} />)).toContain(
      "Each winning pick earns 1 pt in weeks 1–4",
    );
  });
});

describe("standings", () => {
  const sheets = [
    { sheetId: 1, points: 12, decided: 8 },
    { sheetId: 2, points: 20, decided: 8 },
    { sheetId: 3, points: 12, decided: 8 },
    { sheetId: 4, points: 5, decided: 8 },
  ];

  it("ranks by points, sharing a rank on ties", () => {
    expect(standing(sheets, 2)).toEqual({ rank: 1, tied: false, of: 4 });
    expect(standing(sheets, 1)).toEqual({ rank: 2, tied: true, of: 4 });
    expect(standing(sheets, 3)).toEqual({ rank: 2, tied: true, of: 4 });
    expect(standing(sheets, 4)).toEqual({ rank: 4, tied: false, of: 4 });
  });

  it("has no standing until a pick in the pool is decided", () => {
    const fresh = sheets.map((s) => ({ ...s, points: 0, decided: 0 }));
    expect(standing(fresh, 1)).toBeNull();
    expect(standing(sheets, 99)).toBeNull();
  });

  it("formats ordinals", () => {
    const format = (rank: number, tied = false) => formatStanding({ rank, tied, of: 30 });
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map((r) => format(r))).toEqual([
      "1st of 30",
      "2nd of 30",
      "3rd of 30",
      "4th of 30",
      "11th of 30",
      "12th of 30",
      "13th of 30",
      "21st of 30",
      "22nd of 30",
      "23rd of 30",
    ]);
    expect(format(2, true)).toBe("T-2nd of 30");
  });

  it("scores each sheet's decided picks", () => {
    const data = boardData();
    const gamesById = new Map(data.games.map((g) => [g.id, g]));
    expect(scoreSheet(data.picks, gamesById, "outright")).toEqual({ points: 4, decided: 5 });
    // The same picks the board totals
    expect(sheetStats(buildBoard(data, now).weeks).points).toBe(4);
  });

  it("shows the standing first in the sheet stats", () => {
    const { weeks } = buildBoard(boardData(), now);
    const html = renderToStaticMarkup(
      <SheetStats weeks={weeks} standing={{ rank: 2, tied: true, of: 4 }} />,
    );
    expect(html).toMatch(/^<dl[^>]*><div[^>]*><dt[^>]*>Standing<\/dt><dd[^>]*>T-2nd of 4</);
    expect(renderToStaticMarkup(<SheetStats weeks={weeks} standing={null} />)).toMatch(
      /Standing<\/dt><dd[^>]*>–</,
    );
  });
});
