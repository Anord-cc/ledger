import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { sessionMiddleware } from "./http/middleware/auth.js";
import { errorHandler } from "./http/middleware/error-handler.js";
import { adminRouter } from "./http/routes/admin.js";
import { aiRouter } from "./http/routes/ai.js";
import { attachmentsRouter } from "./http/routes/attachments.js";
import { authRouter } from "./http/routes/auth.js";
import { feedbackRouter } from "./http/routes/feedback.js";
import { mcpRouter } from "./http/routes/mcp.js";
import { pagesRouter } from "./http/routes/pages.js";
import { rolesRouter } from "./http/routes/roles.js";
import { searchRouter } from "./http/routes/search.js";
import { spacesRouter } from "./http/routes/spaces.js";
import { setupRouter } from "./http/routes/setup.js";
import { settingsRouter } from "./http/routes/settings.js";
import { webhooksRouter } from "./http/routes/webhooks.js";
import { integrationsRouter } from "./http/routes/integrations.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.LEDGER_APP_URL,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false
    }),
    authRouter
  );

  app.use(
    "/api/search",
    rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false
    }),
    searchRouter
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "ledger-api" });
  });

  app.use("/api/pages", pagesRouter);
  app.use("/api/attachments", attachmentsRouter);
  app.use("/api/spaces", spacesRouter);
  app.use("/api/roles", rolesRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/integrations", integrationsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/mcp", mcpRouter);

  app.use(errorHandler);
  return app;
}
