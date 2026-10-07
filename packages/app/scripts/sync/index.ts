import { parseArgs } from "node:util";
import { createCfbdClient, createDb } from "./context.ts";
import type { SyncResult } from "./sync-table.ts";
import type { Syncer } from "./syncers/index.ts";
import { conferences } from "./syncers/conferences.ts";
import { teams } from "./syncers/teams.ts";
import { games } from "./syncers/games.ts";
import { lines } from "./syncers/lines.ts";

// Ordered by dependency: each syncer scopes its requests using the tables synced before it
const Syncers: readonly Syncer[] = [conferences, teams, games, lines];
const SyncerNames = Syncers.map((s) => s.name);

const Usage = `Usage: node scripts/sync/index.ts [${SyncerNames.join("|")} ...] [options]

Syncs external CFBD data into the database. Syncs every table when none are given.
Records in the database that no longer exist in CFBD are reported, never deleted.

Options:
  --year <year>          Season to sync (default: current year)
  --dry-run              Fetch and diff without committing any changes
  --concurrency <n>      Max concurrent CFBD requests (default: 2)
  --interval <ms>        Min delay between CFBD request starts (default: 250)
  -h, --help             Show this message`;

function fail(message: string): never {
  console.error(message);
  console.error();
  console.error(Usage);
  process.exit(1);
}

function parsePositiveInt(name: string, value: string, allowZero = false): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) fail(`Invalid --${name}: ${value}`);
  return n;
}

// #region Parse args
let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      year: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      concurrency: { type: "string", default: "2" },
      interval: { type: "string", default: "250" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
} catch (e) {
  fail((e as Error).message);
}
const { values, positionals } = parsed;

if (values.help) {
  console.log(Usage);
  process.exit(0);
}

const unknown = positionals.filter((p) => !SyncerNames.includes(p));
if (unknown.length > 0) fail(`Unknown table(s): ${unknown.join(", ")}`);

const selected =
  positionals.length > 0 ? Syncers.filter((s) => positionals.includes(s.name)) : Syncers;
const year = values.year ? parsePositiveInt("year", values.year) : new Date().getFullYear();
const dryRun = values["dry-run"];
const concurrency = parsePositiveInt("concurrency", values.concurrency);
const intervalMs = parsePositiveInt("interval", values.interval, true);
// #endregion

// #region Run syncers
const db = createDb();
const ctx = {
  db,
  cfbd: createCfbdClient({ concurrency, intervalMs }),
  year,
  dryRun,
};

console.log(
  `> Syncing ${selected.map((s) => s.name).join(", ")} for ${year}${dryRun ? " (dry run)" : ""}`,
);

const results: SyncResult[] = [];
try {
  for (const syncer of selected) {
    const start = performance.now();
    results.push(await syncer.run(ctx));
    console.log(`  ${syncer.name} done in ${((performance.now() - start) / 1000).toFixed(1)}s`);
  }
} catch (e) {
  console.error();
  console.error("> Sync failed:", e);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
// #endregion

// #region Stale records report
console.log();
console.log("> Stale records (in the database but no longer in CFBD)");
for (const result of results) {
  console.log();
  console.log(`  ${result.table}: ${result.stale.length === 0 ? "none" : result.stale.length}`);
  if (result.stale.length > 0) console.table(result.stale);
}

console.log();
console.log(process.exitCode ? "> Completed with errors" : "> Completed");
// #endregion
