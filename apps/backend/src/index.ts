import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openapi } from "./docs/openapi.js";
import { analysisRoutes } from "./routes/analysis.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { validate } from "./services/analysis.service.js";
import { logger } from "./utils/logger.js";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "32kb" }));
if (env.SWAGGER_ENABLED) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.get("/api-docs.json", (_req, res) => res.json(openapi));
}
app.use("/api", analysisRoutes);
app.use(healthRoutes);
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (error as { type?: string }).type === "entity.too.large" ? 413 : 400;
  logger.warn("request rejected", { status, error: error instanceof Error ? error.message : String(error) });
  res.status(status).json({ error: status === 413 ? "Request body is too large" : "Invalid JSON" });
});

if (env.NODE_ENV !== "test") app.listen(env.PORT, () => logger.info("backend listening", { port: env.PORT }));

export { app, validate };
