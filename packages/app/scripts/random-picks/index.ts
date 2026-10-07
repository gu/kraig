import { parseArgs } from "node:util";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "@db/types";
import config from "../../config.ts";
import { getOpenWeek } from "../../src/lib/picks.ts";
import { chooseRandomPicks } from "./choose.ts";

const Usage = `Usage: node scripts/random-picks/index.ts --sheet <id> --pool <id> [options]

Development helper: fills every week before the current open week with random picks for a sheet.
Weeks that already have picks are topped up to the weekly limit. Teams already used on the sheet
are never picked again.

Options:
  --sheet <id>           Sheet id or display id (required)
  --pool <id>            Pool id or display id the sheet belongs to (required)
  --reset                Delete the sheet's existing picks in those weeks first
  --dry-run              Print the picks without saving them
  -h, --help             Show this message`;

function fail(message: string): never {
  console.error(message);
  console.error();
  console.error(Usage);
  process.exit(1);
}

// #region Parse args
let parsed;
try {
  parsed = parseArgs({
    options: {
      sheet: { type: "string" },
      pool: { type: "string" },
      reset: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
} catch (e) {
  fail((e as Error).message);
}
const { values } = parsed;

if (values.help) {
  console.log(Usage);
  process.exit(0);
}
if (!values.sheet) fail("Missing --sheet");
if (!values.pool) fail("Missing --pool");

const sheetArg = values.sheet;
const poolArg = values.pool;
const reset = values.reset;
const dryRun = values["dry-run"];
// #endregion

/** Ids can be given as the numeric id or the display id (uuid) */
function idColumn(value: string) {
  return /^\d+$/.test(value)
    ? ({ column: "id", value: Number(value) } as const)
    : ({ column: "display_id", value } as const);
}

const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool: new Pool({ connectionString: config.DATABASE_URL }) }),
});

try {
  const poolId = idColumn(poolArg);
  const pool = await db
    .selectFrom("pool")
    .select(["id", "name"])
    .where(poolId.column, "=", poolId.value)
    .executeTakeFirst();
  if (!pool) fail(`Pool not found: ${poolArg}`);

  const sheetId = idColumn(sheetArg);
  const sheet = await db
    .selectFrom("sheet")
    .select(["id", "name"])
    .where(sheetId.column, "=", sheetId.value)
    .where("pool_id", "=", pool.id)
    .executeTakeFirst();
  if (!sheet) fail(`Sheet ${sheetArg} not found in pool "${pool.name}"`);

  const games = await db
    .selectFrom("ext_game")
    .select(["id", "week", "start_date", "home_id", "away_id"])
    .execute();
  const openWeek = getOpenWeek(
    games.map((g) => ({ week: g.week, start_date: g.start_date.toISOString() })),
    new Date(),
  );
  // Once every game has started, the whole season is in the past
  const weeks = [...new Set(games.map((g) => g.week))]
    .filter((week) => openWeek === null || week < openWeek)
    .sort((a, b) => a - b);

  console.log(
    `> Random picks for sheet "${sheet.name}" in pool "${pool.name}"${dryRun ? " (dry run)" : ""}`,
  );
  if (weeks.length === 0) {
    console.log(`  No weeks before the open week (${openWeek}), nothing to do`);
    process.exit(0);
  }
  console.log(`  Weeks ${weeks[0]}-${weeks.at(-1)} (open week: ${openWeek ?? "none"})`);

  const weekByGame = new Map(games.map((g) => [g.id, g.week]));
  const allPicks = await db
    .selectFrom("sheet_pick")
    .select(["game_id", "team_id"])
    .where("sheet_id", "=", sheet.id)
    .execute();
  const resetPicks = reset
    ? allPicks.filter((p) => weeks.includes(weekByGame.get(p.game_id)!))
    : [];
  const existing = allPicks.filter((p) => !resetPicks.includes(p));

  // Like the app, only teams we have records for can be picked (excludes e.g. FCS opponents)
  const schools = new Map(
    (await db.selectFrom("ext_team").select(["id", "school"]).execute()).map((t) => [
      t.id,
      t.school,
    ]),
  );
  const picks = chooseRandomPicks({ games, teams: new Set(schools.keys()), weeks, existing });

  console.table(
    picks.map((p) => ({
      week: weekByGame.get(p.game_id),
      game_id: p.game_id,
      team: schools.get(p.team_id),
    })),
  );

  if (!dryRun) {
    await db.transaction().execute(async (trx) => {
      if (resetPicks.length > 0) {
        await trx
          .deleteFrom("sheet_pick")
          .where("sheet_id", "=", sheet.id)
          .where(
            "game_id",
            "in",
            resetPicks.map((p) => p.game_id),
          )
          .execute();
      }
      if (picks.length > 0) {
        await trx
          .insertInto("sheet_pick")
          .values(picks.map((p) => ({ sheet_id: sheet.id, ...p })))
          .execute();
      }
    });
  }

  console.log();
  console.log(
    `> ${dryRun ? "Would add" : "Added"} ${picks.length} pick(s)` +
      (reset ? `, ${dryRun ? "would remove" : "removed"} ${resetPicks.length}` : ""),
  );
} catch (e) {
  console.error();
  console.error("> Failed:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
