import type { Action, AnalysisRequest, AnalysisResponse } from "@context/shared";
import { randomUUID } from "node:crypto";
import { apiEnv, env } from "../config/env.js";
import { analyzeClaim, analyzeContext } from "../ai.js";
import { createProvider, generateQueries, searchEvidence } from "../search.js";
import { logger } from "../utils/logger.js";
import type { StatusSender, ValidationResult } from "../types/http.js";

export function validate(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") return { error: "JSON body is required" };
  const input = body as Record<string, unknown>;
  const fields = ["selection", "tweet", "url", "author", "timestamp", "platform"];
  const missing = fields.find((field) => typeof input[field] !== "string" || !input[field]);
  if (missing) return { error: `${missing} is required` };
  if (input.platform !== "x") return { error: "platform must be x" };
  if (String(input.selection).length > 2000) return { error: "selection must be 2000 characters or fewer" };
  if (input.action !== "context" && input.action !== "claim") return { error: "action must be context or claim" };
  return { value: input as unknown as AnalysisRequest };
}

export async function runAnalysis(
  action: Action,
  input: AnalysisRequest,
  requestId = randomUUID(),
  onStatus: StatusSender,
) {
  const started = Date.now();
  onStatus("Searching...");
  const search = await searchEvidence(createProvider(apiEnv), generateQueries(input.selection, action));
  onStatus(`Found ${search.results.length} sources.`);
  onStatus("Analyzing...");
  const analysis =
    action === "claim"
      ? await analyzeClaim(input.selection, search.results, apiEnv)
      : await analyzeContext(input.selection, search.results, apiEnv);
  logger.info("analysis completed", {
    requestId,
    action,
    sources: search.results.length,
    latencyMs: Date.now() - started,
  });
  const response: AnalysisResponse = {
    requestId,
    action,
    status: "completed",
    message: "Analysis completed.",
    input,
    search,
    analysis,
  };
  return response;
}
