import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"] });
const ConfigSchema = z.object({
  DATABASE_URL: z.string(),
  CFBD_API_KEY: z.string(),
});
const config = ConfigSchema.parse(process.env);

export default config;
