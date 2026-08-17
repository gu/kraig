import { z } from "zod";
import { logger } from "@/logger";
import { loadCfbdClient } from "./cfbd";

const ApiConfigSchema = z.object({
  DATABASE_URL: z.string(),

  CFBD_API_KEY: z.string(),
});

try {
  process.loadEnvFile(".env");
} catch {
  logger.debug("Unable to load .env file. Skipping");
}

try {
  process.loadEnvFile(".env.local");
} catch {
  logger.debug("Unable to load .env.local file. Skipping");
}

export const ApiConfig = ApiConfigSchema.parse(process.env);

loadCfbdClient(ApiConfig.CFBD_API_KEY);
