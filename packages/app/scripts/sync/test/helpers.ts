import { promises as fs } from "node:fs";
import path from "node:path";
import { Kysely, PGliteDialect, sql } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { PGlite } from "@electric-sql/pglite";
import type { DB } from "@db/types";
import type { CfbdClient, SearchParams, SyncContext } from "../context.ts";

const MigrationFolder = path.resolve(import.meta.dirname, "../../../db/migrations");

/**
 * Creates an in-memory Postgres with the app's migrations applied.
 */
export async function createTestDb(): Promise<Kysely<DB>> {
  const db = new Kysely<DB>({ dialect: new PGliteDialect({ pglite: new PGlite() }) });

  // The `user` table is owned by better-auth rather than our migrations
  await sql`create table "user" (id text primary key)`.execute(db);

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: MigrationFolder }),
  });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;

  return db;
}

export async function resetExtTables(db: Kysely<DB>) {
  await sql`truncate ext_ranking, ext_line, ext_game, ext_team, ext_conference cascade`.execute(db);
}

export type CfbdRequest = { path: string; searchParams: SearchParams };

/**
 * Fake CFBD client that answers requests with `respond` and records every request made.
 * Responses are still parsed with the caller's schema, like the real client.
 */
export function createFakeCfbd(respond: (req: CfbdRequest) => unknown) {
  const requests: CfbdRequest[] = [];
  const get: CfbdClient["get"] = async (path, searchParams, schema) => {
    requests.push({ path, searchParams });
    return schema.parse(respond({ path, searchParams }));
  };
  const cfbd: CfbdClient = {
    get,
    getMany: (items, request, schema) =>
      Promise.all(
        items.map((item) => {
          const { path, searchParams } = request(item);
          return get(path, searchParams, schema);
        }),
      ),
  };
  return { cfbd, requests };
}

export function createTestContext(
  db: Kysely<DB>,
  overrides: Partial<Omit<SyncContext, "db">> = {},
): SyncContext {
  return {
    db,
    cfbd: createFakeCfbd(() => {
      throw new Error("Unexpected CFBD request");
    }).cfbd,
    year: 2026,
    dryRun: false,
    ...overrides,
  };
}

// #region Fixture rows
export const conferenceRow = (id: number, abbreviation: string) => ({
  id,
  abbreviation,
  name: `${abbreviation} Conference`,
  short_name: abbreviation,
});

export const teamRow = (id: number, conference: string) => ({
  id,
  school: `School ${id}`,
  abbreviation: `S${id}`,
  conference,
  logo_url: null,
});

export const gameRow = (id: number, homeId: number, awayId: number) => ({
  id,
  week: 1,
  start_date: "2026-09-05T16:00:00.000Z",
  conference_game: false,
  home_id: homeId,
  home_team: `School ${homeId}`,
  home_conference: "SEC",
  away_id: awayId,
  away_team: `School ${awayId}`,
  away_conference: "ACC",
});

export const lineRow = (gameId: number, provider: string, spread: number | null = -3.5) => ({
  game_id: gameId,
  provider,
  spread,
  formatted_spread: `Home ${spread}`,
  spread_open: null,
  over_under: null,
  over_under_open: null,
  home_moneyline: null,
  away_moneyline: null,
});
// #endregion
