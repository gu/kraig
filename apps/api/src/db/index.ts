import { ApiConfig } from "@/config";
import type { DB } from "@db/types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: ApiConfig.DATABASE_URL,
  }),
});

export const db = new Kysely<DB>({ dialect });
