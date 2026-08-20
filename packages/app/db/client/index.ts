import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "../types";
import config from "../../config";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.DATABASE_URL,
  }),
});
const db = new Kysely<DB>({ dialect });

export default db;
