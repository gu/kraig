import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import { DEFAULT_POOL_SETTINGS } from "#/lib/pool-settings";
import { buildBoard } from "./board";
import { GameCard } from "./game-card";
import { SheetStats, sheetStats } from "./sheet-stats";
import { WeekPicksCard } from "./week-picks-card";
import { WeekPicksStrip } from "./week-picks-strip";

// Week 1 is over; week 2 hasn't kicked off
const now = new Date("2026-09-10T00:00:00Z");

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
) => ({
  id,
  week,
  start_date: week === 1 ? "2026-09-05T16:00:00.000Z" : "2026-09-12T16:00:00.000Z",
  home_id: homeId,
  home_team: null,
  away_id: awayId,
  away_team: null,
  home_spread: null,
  over_under: null,
  completed: score !== null,
  home_points: score?.[0] ?? null,
  away_points: score?.[1] ?? null,
});

const boardData: SheetBoard = {
  games: [
    game(10, 1, 1, 2, [31, 17]),
    game(11, 1, 3, 4, [24, 10]),
    // Final for week 1, but CFBD hasn't marked it completed yet
    { ...game(12, 1, 5, 6, null), home_points: 7, away_points: 3 },
    game(20, 2, 1, 3, null),
  ],
  teams: [
    team(1, "Texas"),
    team(2, "Michigan"),
    team(3, "Georgia"),
    team(4, "Alabama"),
    team(5, "Oregon"),
    team(6, "USC"),
  ],
  rankings: [],
  picks: [
    // Home team won
    { game_id: 10, team_id: 1 },
    // Away team lost
    { game_id: 11, team_id: 4 },
    { game_id: 12, team_id: 5 },
    { game_id: 20, team_id: 3 },
  ],
  pool: DEFAULT_POOL_SETTINGS,
};

const { weeks } = buildBoard(boardData, now);
const resultByTeam = (week: (typeof weeks)[number]) =>
  Object.fromEntries(week.picks.map((p) => [p.team.name, p.result]));

describe("pick results", () => {
  it("marks picks in completed games as wins or losses", () => {
    expect(resultByTeam(weeks[0])).toEqual({ Texas: "win", Alabama: "loss", Oregon: null });
    expect(resultByTeam(weeks[1])).toEqual({ Georgia: null });
  });

  it("colors the strip slots and shows the score from the picked team's side", () => {
    const html = renderToStaticMarkup(
      <WeekPicksStrip week={weeks[0]} busy={false} onRemove={() => {}} onShowGame={() => {}} />,
    );

    expect(html).toContain('aria-label="Texas, vs Michigan · W 31–17 · +1"');
    expect(html).toContain('aria-label="Alabama, at Georgia · L 10–24 · +0"');
    expect(html.match(/ring-success/g)).toHaveLength(1);
    expect(html.match(/ring-destructive/g)).toHaveLength(1);
    expect(html.match(/ring-primary\/40/g)).toHaveLength(1);
  });

  it("colors the expanded picks list", () => {
    const html = renderToStaticMarkup(
      <WeekPicksCard week={weeks[0]} busy={false} onRemove={() => {}} />,
    );

    expect(html).toContain("vs Michigan · W 31–17");
    expect(html).toContain("at Georgia · L 10–24");
    expect(html.match(/border-success bg-success\/10/g)).toHaveLength(1);
    expect(html.match(/border-destructive bg-destructive\/10/g)).toHaveLength(1);
  });

  it("shows the final score and pick result in the games listing", () => {
    const card = (index: number) =>
      renderToStaticMarkup(
        <GameCard game={weeks[0].games[index]} busy={false} onPick={() => {}} />,
      );

    const won = card(0);
    expect(won).toContain("Final");
    expect(won).not.toContain("Started");
    expect(won).toContain("Your pick · Won");
    expect(won).toContain(">31</span>");
    expect(won).toContain(">17</span>");
    expect(won.match(/border-success bg-success\/10/g)).toHaveLength(1);

    const lost = card(1);
    expect(lost).toContain("Your pick · Lost");
    expect(lost.match(/border-destructive bg-destructive\/10/g)).toHaveLength(1);

    // Scores without CFBD marking the game completed aren't final yet
    const pending = card(2);
    expect(pending).not.toContain("Final");
    expect(pending).not.toContain(">7</span>");
  });

  it("totals the season record across weeks", () => {
    expect(sheetStats(weeks)).toEqual({ points: 1, wins: 1, losses: 1, pending: 2, winRate: 0.5 });

    const html = renderToStaticMarkup(<SheetStats weeks={weeks} />);
    expect(html).toContain("Won</dt><dd");
    expect(html).toContain("text-success");
    expect(html).toContain("text-destructive");
    expect(html).toContain(">50%</dd>");
  });

  it("shows no win rate before any pick is decided", () => {
    expect(sheetStats([weeks[1]])).toEqual({
      points: 0,
      wins: 0,
      losses: 0,
      pending: 1,
      winRate: null,
    });
    const html = renderToStaticMarkup(<SheetStats weeks={[weeks[1]]} />);
    expect(html).toContain(">–</dd>");
    expect(html).not.toContain("text-success");
  });
});
