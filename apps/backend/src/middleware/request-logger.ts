import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  const started = Date.now();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    logger.info("request completed", {
      requestId,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      latencyMs: Date.now() - started,
      contentLength: res.getHeader("content-length") ?? 0,
    });
  });

  next();
}
