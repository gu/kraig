import config from "@config";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  database: new Pool({
    connectionString: config.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
});
