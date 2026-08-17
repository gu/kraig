import { z } from "zod";
import { logger } from "../logger/index.js";

const ApiConfigSchema = z.object({
  DB_URI: z.string(),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

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

export const apiConfig: ApiConfig = ApiConfigSchema.parse(process.env);
