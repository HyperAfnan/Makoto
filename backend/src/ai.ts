import type { AnalysisResult, ClaimType, SearchResult, Verdict } from "./types/shared.js";
import { clean, classify, evidenceText } from "./utils/ai.utils.js";
import { ClaimAnalysisPrompt, ContextAnalysisPrompt } from "./utils/prompts.utils.js";
import type { Env } from "./types/env.js";
import { gemini } from "./config/gemini.js";

export { classify };

export async function analyzeContext(
	selection: string,
	results: SearchResult[],
	env: Env = {},
	images?: string[],
): Promise<AnalysisResult> {
	const text = clean(selection);
	const prompt = ContextAnalysisPrompt(text, evidenceText(results));
	const result = await gemini(prompt, env, images);
	if (result && typeof result === "object") {
		const raw = result as Record<string, unknown>;
		return {
			summary: typeof raw.summary === "string" ? raw.summary : String(raw.summary ?? ""),
			background: typeof raw.background === "string" ? raw.background : String(raw.background ?? ""),
			related: Array.isArray(raw.related)
				? raw.related.map(String)
				: results.slice(0, 5).map((source) => source.url),
		};
	}
	return {
		summary: results.length
			? `Search found ${results.length} relevant sources. AI summarization is not configured.`
			: "No reliable web evidence was found.",
		background: results.length ? results[0].snippet : "",
		related: results.slice(0, 5).map((source) => source.url),
	};
}

export async function analyzeClaim(
	selection: string,
	results: SearchResult[],
	env: Env = {},
	images?: string[],
): Promise<AnalysisResult> {
	const claimType = classify(selection);
	const claims = [clean(selection)];
	if (claimType !== "fact" && claimType !== "mixed") {
		return {
			summary: "",
			background: "",
			related: results.slice(0, 5).map((source) => source.url),
			claimType,
			claims,
			reasoning: "This claim type is not eligible for a factual verdict.",
		};
	}
	const prompt = ClaimAnalysisPrompt(clean(selection), evidenceText(results));
	const result = await gemini(prompt, env, images);
	if (result && typeof result === "object") {
		const raw = result as Record<string, unknown>;
		const normalizedClaims: string[] = Array.isArray(raw.claims)
			? raw.claims.map((c) =>
					typeof c === "string"
						? c
						: String(
								(c as Record<string, unknown>)?.claim ??
									(c as Record<string, unknown>)?.text ??
									JSON.stringify(c),
							),
				)
			: claims;
		return {
			summary: typeof raw.summary === "string" ? raw.summary : String(raw.summary ?? ""),
			background: typeof raw.background === "string" ? raw.background : String(raw.background ?? ""),
			related: Array.isArray(raw.related)
				? raw.related.map(String)
				: results.slice(0, 5).map((source) => source.url),
			claimType: (raw.claimType as ClaimType) ?? claimType,
			claims: normalizedClaims,
			verdict: raw.verdict as Verdict | undefined,
			reasoning: typeof raw.reasoning === "string" ? raw.reasoning : String(raw.reasoning ?? ""),
		};
	}
	const verdict: Verdict = "unverifiable";
	return {
		summary: "AI claim analysis is not configured.",
		background: "",
		related: results.slice(0, 5).map((source) => source.url),
		claimType,
		claims,
		verdict,
		reasoning: "Evidence was retrieved, but a Gemini API key is required to produce a grounded verdict.",
	};
}
