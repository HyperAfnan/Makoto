import type { Action } from "@context/shared";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { runAnalysis, validate } from "../services/analysis.service.js";
import { logger } from "../utils/logger.js";

export function analysisController(action: Action) {
  return async (req: Request, res: Response) => {
    const result = validate({ ...req.body, action });
    if (result.error) return res.status(400).json({ error: result.error });

    const requestId = randomUUID();
    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const response = await runAnalysis(action, result.value!, requestId, (message) =>
        send("status", { requestId, message }),
      );
      send("completed", response);
    } catch (error) {
      logger.error("analysis failed", {
        requestId,
        action,
        error: error instanceof Error ? error.message : String(error),
      });
      send("error", { requestId, message: error instanceof Error ? error.message : "Analysis failed" });
    } finally {
      res.end();
    }
  };
}
