import { serve } from "@hono/node-server";
import { structuredLogger } from "@hono/structured-logger";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { logger } from "@/logger";

const app = new Hono();

app.use(requestId());
app.use(
  structuredLogger({
    createLogger: (c) => logger.child({ requestId: c.var.requestId }),
    onResponse: (logger, c, elapsedMs) =>
      logger.info({ method: c.req.method, path: c.req.path, elapsedMs }, "request completed"),
  }),
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
