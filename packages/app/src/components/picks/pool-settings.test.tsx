import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SheetBoard } from "#/hooks/use-sheet-picks";
import {
  DEFAULT_POOL_SETTINGS,
  poolSettingsSchema,
  selectedConferences,
  type PoolSettings,
} from "#/lib/pool-settings";
import { RulesCard } from "#/components/rules-card";
import { buildBoard, pickResult } from "./board";
import { GameCard } from "./game-card";

// Week 1 is over; week 2 hasn't kicked off
const now = new Date("2026-09-10T00:00:00Z");

const team = (id: number, school: string, conference: string) => ({
  id,
  school,
  abbreviation: null,
  logo_url: null,
  conference,
});

const game = (
  id: number,
  week: number,
  homeId: number,
  awayId: number,
  homeSpread: number | null,
  score: [home: number, away: number] | null = null,
) => ({
  id,
  week,
  start_date: week === 1 ? "2026-09-05T16:00:00.000Z" : "2026-09-12T16:00:00.000Z",
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

const teams = [
  team(1, "Texas", "SEC"),
  team(2, "Michigan", "Big Ten"),
  team(3, "Georgia", "SEC"),
  team(4, "Clemson", "ACC"),
  team(5, "Miami", "ACC"),
  team(6, "Alabama", "SEC"),
];

const board = (pool: Partial<PoolSettings>, picks: SheetBoard["picks"] = []): SheetBoard => ({
  games: [
    game(10, 2, 1, 2, null),
    game(11, 2, 3, 4, null),
    // Both teams are ACC
    game(12, 2, 5, 4, null),
    game(13, 2, 6, 5, null),
  ],
  teams,
  rankings: [],
  picks,
  pool: { ...DEFAULT_POOL_SETTINGS, ...pool },
  sheetId: 1,
  standings: [],
});

describe("pickResult", () => {
  // Texas (home, -7) beat Michigan 24–20
  const final = game(1, 1, 1, 2, -7, [24, 20]);

  it("scores outright pools by the final score", () => {
    expect(pickResult(final, 1, "outright")).toBe("win");
    expect(pickResult(final, 2, "outright")).toBe("loss");
  });

  it("scores spread pools by whether the team covered", () => {
    expect(pickResult(final, 1, "spread")).toBe("loss");
    expect(pickResult(final, 2, "spread")).toBe("win");
  });

  it("treats a push against the spread as no result", () => {
    const push = game(1, 1, 1, 2, -4, [24, 20]);
    expect(pickResult(push, 1, "spread")).toBeNull();
    expect(pickResult(push, 2, "spread")).toBeNull();
  });

  it("scores a game without a line as a pick'em", () => {
    const noLine = game(1, 1, 1, 2, null, [24, 20]);
    expect(pickResult(noLine, 1, "spread")).toBe("win");
  });

  it("has no result until the game is final", () => {
    expect(pickResult(game(1, 1, 1, 2, -7), 1, "spread")).toBeNull();
  });
});

describe("buildBoard with pool settings", () => {
  it("lists every game when the pool has every conference", () => {
    const [week] = buildBoard(board({}), now).weeks;
    expect(week.games.map((g) => g.game.id)).toEqual([10, 11, 12, 13]);
  });

  it("only lets teams in the pool's conferences be picked", () => {
    const [week] = buildBoard(board({ conferences: ["SEC", "Big Ten"] }), now).weeks;

    // ACC-only game 12 is hidden
    expect(week.games.map((g) => g.game.id)).toEqual([10, 11, 13]);
    const georgiaClemson = week.games[1];
    expect(georgiaClemson.home.state).toBe("open");
    expect(georgiaClemson.away.state).toBe("unavailable");
    // An out-of-pool team still shows its name
    expect(georgiaClemson.away.name).toBe("Clemson");
  });

  it("caps each week at the pool's picks per week", () => {
    const [week] = buildBoard(
      board({ picksPerWeek: 2 }, [
        { game_id: 10, team_id: 1 },
        { game_id: 11, team_id: 3 },
      ]),
      now,
    ).weeks;

    expect(week.picksPerWeek).toBe(2);
    expect(week.games[2].home.state).toBe("full");
    expect(
      renderToStaticMarkup(<GameCard game={week.games[2]} busy={false} onPick={() => {}} />),
    ).toContain("All picks made this week");
  });

  it("colors picks by covering the spread, but bolds the team that won", () => {
    const data: SheetBoard = {
      ...board({ pickType: "spread" }, [{ game_id: 1, team_id: 1 }]),
      games: [game(1, 1, 1, 2, -7, [24, 20]), game(10, 2, 1, 2, null)],
    };
    const [week1] = buildBoard(data, now).weeks;
    expect(week1.picks[0].result).toBe("loss");

    const html = renderToStaticMarkup(
      <GameCard game={week1.games[0]} busy={false} onPick={() => {}} />,
    );
    expect(html).toContain("Your pick · Lost");
    expect(html).toMatch(/font-bold text-foreground">24</);
  });
});

describe("selectedConferences", () => {
  const all = ["ACC", "Big Ten", "SEC"];

  it("stores null when every conference is in", () => {
    expect(selectedConferences(all, [])).toBeNull();
  });

  it("stores the conferences left in", () => {
    expect(selectedConferences(all, ["Big Ten"])).toEqual(["ACC", "SEC"]);
  });
});

describe("poolSettingsSchema", () => {
  it("accepts the defaults", () => {
    expect(poolSettingsSchema.safeParse(DEFAULT_POOL_SETTINGS).success).toBe(true);
  });

  it("rejects an empty conference list and out-of-range counts", () => {
    const parse = (overrides: Partial<PoolSettings>) =>
      poolSettingsSchema.safeParse({ ...DEFAULT_POOL_SETTINGS, ...overrides }).success;
    expect(parse({ conferences: [] })).toBe(false);
    expect(parse({ maxSheets: 0 })).toBe(false);
    expect(parse({ picksPerWeek: 11 })).toBe(false);
  });
});

describe("RulesCard", () => {
  it("describes a default pool", () => {
    const html = renderToStaticMarkup(<RulesCard settings={DEFAULT_POOL_SETTINGS} />);
    expect(html).toContain("All conferences");
    expect(html).toContain("Make 5 picks each week from any conference.");
    expect(html).toContain("wins the game outright");
    expect(html).toContain("Each member can enter up to 2 sheets.");
  });

  it("describes a customized pool", () => {
    const html = renderToStaticMarkup(
      <RulesCard
        settings={{
          conferences: ["Big Ten", "SEC"],
          maxSheets: 1,
          picksPerWeek: 3,
          pickType: "spread",
        }}
      />,
    );
    expect(html).toContain("Make 3 picks each week from Big Ten, SEC.");
    expect(html).toContain("Covering the spread");
    expect(html).toContain("covers the spread");
    expect(html).toContain("Each member can enter up to 1 sheet.");
  });
});
