import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"] });

const ApiConfigSchema = z.object({
  DATABASE_URL: z.string(),
  CFBD_API_KEY: z.string(),
});

export const ApiConfig = ApiConfigSchema.parse(process.env);
