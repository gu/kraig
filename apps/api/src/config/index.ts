import { z } from "zod";
import { logger } from "@/logger";

const ApiConfigSchema = z.object({
  DATABASE_URL: z.string(),
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
