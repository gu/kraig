import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import { buildBoard } from "./board";
import { WeekPicksStrip } from "./week-picks-strip";

// Week 2 is open; its first game has already kicked off
const now = new Date("2026-09-12T17:00:00Z");

const team = (id: number, school: string) => ({ id, school, abbreviation: null, logo_url: null });

const game = (id: number, week: number, startDate: string, homeId: number, awayId: number) => ({
  id,
  week,
  start_date: startDate,
  home_id: homeId,
  home_team: null,
  away_id: awayId,
  away_team: null,
  home_spread: null,
  over_under: null,
  completed: false,
  home_points: null,
  away_points: null,
});

const boardData: SheetBoard = {
  games: [
    game(10, 1, "2026-09-05T16:00:00.000Z", 1, 2),
    game(20, 2, "2026-09-12T16:00:00.000Z", 1, 2),
    game(21, 2, "2026-09-12T23:30:00.000Z", 3, 4),
    game(30, 3, "2026-09-19T16:00:00.000Z", 1, 3),
  ],
  teams: [team(1, "Texas"), team(2, "Michigan"), team(3, "Georgia"), team(4, "Alabama")],
  rankings: [
    { week: 2, team_id: 3, rank: 2 },
    { week: 2, team_id: 4, rank: 6 },
  ],
  picks: [
    { game_id: 10, team_id: 1 },
    { game_id: 20, team_id: 2 },
    { game_id: 21, team_id: 3 },
  ],
};

const weeks = buildBoard(boardData, now).weeks;
const render = (week: (typeof weeks)[number]) =>
  renderToStaticMarkup(
    <WeekPicksStrip week={week} busy={false} onRemove={() => {}} onShowGame={() => {}} />,
  );

describe("WeekPicksStrip", () => {
  it("summarizes the open week's progress", () => {
    const html = render(weeks[1]);
    expect(html).toContain("Week 2 picks");
    expect(html).toMatch(/2 of 5<\/strong> made · 3 left/);
  });

  it("shows a slot per pick with its rank, then numbered open slots", () => {
    const html = render(weeks[1]);

    expect(html).toContain('aria-label="#2 Georgia, vs #6 Alabama · ');
    expect(html).toContain(">#2</span>");
    expect(html).toContain('aria-label="Michigan, at Texas · Started"');
    for (const n of [3, 4, 5])
      expect(html).toContain(`>${n}</span><span class="text-xs">Open</span>`);
  });

  it("marks picks whose game has started as locked", () => {
    const html = render(weeks[1]);
    const lockIcons = html.match(/lucide-lock/g) ?? [];
    expect(lockIcons).toHaveLength(1);
  });

  it("describes completed and upcoming weeks", () => {
    const complete = render(weeks[0]);
    expect(complete).toMatch(/1 of 5<\/strong> made</);
    expect(complete).toContain(">Empty</span>");
    expect(complete).toMatch(/lucide-lock/);

    expect(render(weeks[2])).toContain("Opens after week 2");
  });
});
