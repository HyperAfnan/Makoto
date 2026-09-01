import type { Action, AnalysisRequest, AnalysisResponse, ApiSettings, TweetContext } from "../types/shared.js";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { analyzeClaim, analyzeContext } from "../ai.js";
import { createProvider, generateQueries, searchEvidence } from "../search.js";
import { logger } from "../utils/logger.js";
import type { StatusSender, ValidationResult } from "../types/http.js";
import { calculateEvidence } from "./evidence.service.js";
import { cacheKey, getCached, setCached } from "./cache.service.js";
import { analyzeInstagramReel } from "./instagram.service.js";

const inFlight = new Map<string, Promise<AnalysisResponse>>();

const requestEnv = (settings?: ApiSettings) => ({
	SEARCH_PROVIDER: settings?.searchProvider,
	BRAVE_API_KEY: settings?.braveApiKey,
	TAVILY_API_KEY: settings?.tavilyApiKey,
	GEMINI_API_KEY: settings?.geminiApiKey,
	GEMINI_MODEL: settings?.geminiModel,
	APIFY_API_KEY: settings?.apifyApiKey,
});

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error("Analysis timed out")), timeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export function validate(body: unknown): ValidationResult {
	if (!body || typeof body !== "object") return { error: "JSON body is required" };
	const input = body as Record<string, unknown>;
	const required = ["selection", "url", "platform"];
	const missing = required.find((field) => typeof input[field] !== "string" || !input[field]);
	if (missing) return { error: `${missing} is required` };
	if (input.platform !== "x" && input.platform !== "instagram") {
		return { error: "platform must be x or instagram" };
	}
	if (String(input.selection).length > 2000) return { error: "selection must be 2000 characters or fewer" };
	if (input.action !== "context" && input.action !== "claim") return { error: "action must be context or claim" };
	if (input.author !== undefined && typeof input.author !== "string") {
		return { error: "author must be a string" };
	}
	if (input.timestamp !== undefined && typeof input.timestamp !== "string") {
		return { error: "timestamp must be a string" };
	}
	if (input.tweet !== undefined && typeof input.tweet !== "string") {
		return { error: "tweet must be a string" };
	}
	input.author = typeof input.author === "string" ? input.author : "";
	input.timestamp = typeof input.timestamp === "string" ? input.timestamp : "";
	input.tweet = typeof input.tweet === "string" && input.tweet ? input.tweet : String(input.selection);
	if (input.images !== undefined) {
		if (!Array.isArray(input.images)) return { error: "images must be an array of strings" };
		if (input.images.length > 4) return { error: "images must contain 4 or fewer items" };
		for (const img of input.images) {
			if (typeof img !== "string" || img.length > 50000) {
				return { error: "each image must be a valid string under 50000 characters" };
			}
		}
	}
	if (input.settings !== undefined) {
		if (!input.settings || typeof input.settings !== "object") return { error: "settings must be an object" };
		const settings = input.settings as Record<string, unknown>;
		if (
			settings.searchProvider !== undefined &&
			settings.searchProvider !== "google" &&
			settings.searchProvider !== "brave" &&
			settings.searchProvider !== "tavily"
		) {
			return { error: "settings.searchProvider must be google, brave, or tavily" };
		}
		for (const field of ["braveApiKey", "tavilyApiKey", "geminiApiKey", "geminiModel", "apifyApiKey"]) {
			if (
				settings[field] !== undefined &&
				(typeof settings[field] !== "string" || String(settings[field]).length > 500)
			) {
				return { error: `settings.${field} must be a string of 500 characters or fewer` };
			}
		}
		if (
			settings.maxSources !== undefined &&
			(!Number.isInteger(settings.maxSources) || Number(settings.maxSources) < 1 || Number(settings.maxSources) > 20)
		) {
			return { error: "settings.maxSources must be an integer from 1 to 20" };
		}
	}
	return { value: input as unknown as AnalysisRequest };
}

export async function runAnalysis(
	action: Action,
	input: AnalysisRequest,
	requestId: string = randomUUID(),
	onStatus: StatusSender,
) {
	const started = Date.now();
	const credentials = requestEnv(input.settings);
	const key = cacheKey(input.platform, input.url, input.selection, action, input.settings, input.images);
	const cached = await getCached<AnalysisResponse>(key);
	if (cached) {
		onStatus("Cache hit");
		logger.info("analysis cache hit", { requestId, action });
		return { ...cached, requestId };
	}

	let execution = inFlight.get(key);
	if (!execution) {
		execution = (async () => {
			if (input.platform === "instagram") {
				const response = await withTimeout(
					analyzeInstagramReel(action, input, credentials, requestId, onStatus),
					env.REEL_ANALYSIS_TIMEOUT_MS,
				);
				await setCached(key, response);
				return response;
			}

			onStatus("Searching...");
			const search = await withTimeout(
				searchEvidence(
					createProvider(credentials),
					generateQueries(input.selection, action),
					3,
					input.settings?.maxSources ?? 5,
				),
				env.ANALYSIS_TIMEOUT_MS,
			);
			logger.info("search completed", {
				requestId,
				action,
				provider: search.provider,
				rounds: search.rounds,
				attemptedQueries: search.queries.length,
				sources: search.results.length,
				errors: search.errors,
				latencyMs: search.latencyMs,
			});
			if (search.results.length === 0) {
				logger.warn("no evidence found", {
					requestId,
					action,
					provider: search.provider,
					errors: search.errors,
				});
			}
			onStatus(`Found ${search.results.length} sources.`);
			onStatus("Analyzing...");
			const analysis =
				action === "claim"
					? await analyzeClaim(input.selection, search.results, credentials, input.images)
					: await analyzeContext(input.selection, search.results, credentials, input.images);
			logger.info("analysis completed", {
				requestId,
				action,
				sources: search.results.length,
				latencyMs: Date.now() - started,
			});
			const { settings: _settings, action: _action, ...tweetContext } = input;
			const response: AnalysisResponse = {
				requestId,
				action,
				status: "completed",
				message: "Analysis completed.",
				input: tweetContext as TweetContext,
				search,
				analysis,
				evidence: calculateEvidence(input.selection, search.results),
			};
			await setCached(key, response);
			return response;
		})();

		inFlight.set(key, execution);
		execution.finally(() => inFlight.delete(key));
	} else {
		onStatus("Analyzing with active in-flight request...");
	}

	const response = await execution;
	return { ...response, requestId };
}
