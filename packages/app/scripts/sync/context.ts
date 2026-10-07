import ky from "ky";
import { z } from "zod";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "@db/types";
import config from "../../config.ts";
import { createThrottle } from "./throttle.ts";

export type SearchParams = Record<string, string | number | boolean>;

export interface CfbdClient {
  get<S extends z.ZodType>(
    path: string,
    searchParams: SearchParams,
    schema: S,
  ): Promise<z.infer<S>>;
  /** Fetch many requests through the throttle, preserving input order */
  getMany<T, S extends z.ZodType>(
    items: readonly T[],
    request: (item: T) => { path: string; searchParams: SearchParams },
    schema: S,
  ): Promise<z.infer<S>[]>;
}

export interface SyncContext {
  db: Kysely<DB>;
  cfbd: CfbdClient;
  year: number;
  dryRun: boolean;
}

export function createDb(): Kysely<DB> {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: config.DATABASE_URL,
    }),
  });
  return new Kysely<DB>({ dialect });
}

export function createCfbdClient({
  concurrency,
  intervalMs,
}: {
  concurrency: number;
  intervalMs: number;
}): CfbdClient {
  const throttle = createThrottle({ concurrency, intervalMs });
  const client = ky.create({
    baseUrl: "https://api.collegefootballdata.com/",
    headers: {
      Authorization: `Bearer ${config.CFBD_API_KEY}`,
    },
    timeout: 30_000,
    // Retries honor the Retry-After header on 429s, with jittered exponential backoff otherwise
    retry: {
      limit: 5,
      statusCodes: [408, 429, 500, 502, 503, 504],
      afterStatusCodes: [413, 429, 503],
      maxRetryAfter: 60_000,
      backoffLimit: 30_000,
      jitter: true,
    },
  });

  const get: CfbdClient["get"] = async (path, searchParams, schema) => {
    const raw = await throttle(() => client.get(path, { searchParams }).json());
    return schema.parse(raw);
  };

  return {
    get,
    getMany: (items, request, schema) =>
      Promise.all(
        items.map((item) => {
          const { path, searchParams } = request(item);
          return get(path, searchParams, schema);
        }),
      ),
  };
}
