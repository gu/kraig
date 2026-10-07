import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Kysely } from "kysely";
import type { DB } from "@db/types";
import { syncTable } from "./sync-table.ts";
import {
  createTestContext,
  createTestDb,
  gameRow,
  lineRow,
  resetExtTables,
  teamRow,
} from "./test/helpers.ts";

describe("syncTable", () => {
  let db: Kysely<DB>;

  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await resetExtTables(db);
  });
  afterAll(async () => {
    await db.destroy();
  });

  const allTeams = () => db.selectFrom("ext_team").selectAll().orderBy("id").execute();

  it("inserts rows into an empty table", async () => {
    const result = await syncTable(createTestContext(db), {
      table: "ext_team",
      keys: ["id"],
      rows: [teamRow(1, "SEC"), teamRow(2, "ACC")],
    });

    expect(result).toEqual({ table: "ext_team", fetched: 2, inserted: 2, updated: 0, stale: [] });
    expect(await allTeams()).toEqual([teamRow(1, "SEC"), teamRow(2, "ACC")]);
  });

  it("updates existing rows and inserts new ones", async () => {
    await db.insertInto("ext_team").values(teamRow(1, "SEC")).execute();

    const result = await syncTable(createTestContext(db), {
      table: "ext_team",
      keys: ["id"],
      rows: [{ ...teamRow(1, "B1G"), school: "Renamed" }, teamRow(2, "ACC")],
    });

    expect(result).toMatchObject({ inserted: 1, updated: 1 });
    expect(await allTeams()).toEqual([
      { ...teamRow(1, "B1G"), school: "Renamed" },
      teamRow(2, "ACC"),
    ]);
  });

  it("reports rows missing from the fetched data as stale without deleting them", async () => {
    await db
      .insertInto("ext_team")
      .values([teamRow(1, "SEC"), teamRow(2, "ACC")])
      .execute();

    const result = await syncTable(createTestContext(db), {
      table: "ext_team",
      keys: ["id"],
      rows: [teamRow(1, "SEC")],
    });

    expect(result.stale).toEqual([teamRow(2, "ACC")]);
    expect(await allTeams()).toHaveLength(2);
  });

  it("reports every row as stale when nothing is fetched", async () => {
    await db.insertInto("ext_team").values(teamRow(1, "SEC")).execute();

    const result = await syncTable(createTestContext(db), {
      table: "ext_team",
      keys: ["id"],
      rows: [],
    });

    expect(result.fetched).toBe(0);
    expect(result.stale).toEqual([teamRow(1, "SEC")]);
    expect(await allTeams()).toHaveLength(1);
  });

  it("supports composite keys", async () => {
    await db
      .insertInto("ext_game")
      .values(gameRow(10, 1, 2))
      .execute();
    await db
      .insertInto("ext_line")
      .values([lineRow(10, "Bovada", -3), lineRow(10, "OldBook", -1)])
      .execute();

    const result = await syncTable(createTestContext(db), {
      table: "ext_line",
      keys: ["game_id", "provider"],
      rows: [lineRow(10, "Bovada", -7), lineRow(10, "DraftKings", -6.5)],
    });

    expect(result).toMatchObject({ inserted: 1, updated: 1, stale: [lineRow(10, "OldBook", -1)] });
    const lines = await db
      .selectFrom("ext_line")
      .select(["provider", "spread"])
      .orderBy("provider")
      .execute();
    expect(lines).toEqual([
      { provider: "Bovada", spread: -7 },
      { provider: "DraftKings", spread: -6.5 },
      { provider: "OldBook", spread: -1 },
    ]);
  });

  it("upserts more rows than a single insert chunk", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => teamRow(i + 1, "SEC"));

    const result = await syncTable(createTestContext(db), {
      table: "ext_team",
      keys: ["id"],
      rows,
    });

    expect(result.inserted).toBe(2500);
    const { count } = await db
      .selectFrom("ext_team")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count)).toBe(2500);
  });

  it("rolls back changes on a dry run but still reports the diff", async () => {
    await db.insertInto("ext_team").values(teamRow(1, "SEC")).execute();

    const result = await syncTable(createTestContext(db, { dryRun: true }), {
      table: "ext_team",
      keys: ["id"],
      rows: [teamRow(2, "ACC")],
    });

    expect(result).toMatchObject({ inserted: 1, stale: [teamRow(1, "SEC")] });
    expect(await allTeams()).toEqual([teamRow(1, "SEC")]);
  });
});
