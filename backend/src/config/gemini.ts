import { GoogleGenAI } from "@google/genai";
import { jsonBlock } from "../utils/ai.utils.js";
import { env as config } from "./env.js";
import type { Env } from "../types/env.js";
import { logger } from "../utils/logger.js";

export function getGoogleGenAI(apiKey: string): GoogleGenAI {
	return new GoogleGenAI({ apiKey });
}

export type GroundingChunk = {
	web?: {
		uri?: string;
		title?: string;
	};
};

export type GroundingSupport = {
	segment?: {
		startIndex?: number;
		endIndex?: number;
		text?: string;
	};
	groundingChunkIndices?: number[];
	confidenceScores?: number[];
};

export type GroundingMetadata = {
	webSearchQueries?: string[];
	groundingChunks?: GroundingChunk[];
	groundingSupports?: GroundingSupport[];
	searchEntryPoint?: {
		renderedContent?: string;
	};
};

export type GroundedGeminiResponse = {
	data: unknown | null;
	groundingMetadata?: GroundingMetadata;
};

async function fetchImagePart(image: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
	try {
		if (image.startsWith("data:")) {
			const match = image.match(/^data:([^;]+);base64,(.+)$/);
			if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
		}
		if (image.startsWith("http://") || image.startsWith("https://")) {
			const response = await fetch(image, { signal: AbortSignal.timeout(5000) });
			if (!response.ok) return null;
			const buffer = await response.arrayBuffer();
			const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
			return {
				inlineData: {
					mimeType,
					data: Buffer.from(buffer).toString("base64"),
				},
			};
		}
	} catch (error) {
		logger.warn("gemini image fetch failed", {
			stage: "gemini_image_fetch",
			error: error instanceof Error ? error.message : String(error),
			imageSnippet: image.slice(0, 100),
		});
	}
	return null;
}

export async function geminiGrounded(
	prompt: string,
	env: Env,
	images?: string[],
): Promise<GroundedGeminiResponse | null> {
	if (!env.GEMINI_API_KEY) {
		logger.warn("gemini call skipped: no api key configured", { stage: "gemini_grounded_call" });
		return null;
	}

	const model = env.GEMINI_MODEL ?? "gemini-2.0-flash";
	const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

	let contents: unknown = prompt;
	let validPartsCount = 0;
	if (images && images.length > 0) {
		logger.info("fetching image attachments for Gemini", {
			stage: "gemini_image_fetch_start",
			input: { imageCount: images.length },
		});
		const fetchedParts = await Promise.all(images.slice(0, 4).map(fetchImagePart));
		const validParts = fetchedParts.filter((part): part is { inlineData: { mimeType: string; data: string } } =>
			Boolean(part),
		);
		validPartsCount = validParts.length;
		if (validParts.length > 0) {
			contents = [...validParts, { text: prompt }];
		}
		logger.info("image attachments processed", {
			stage: "gemini_image_fetch_completed",
			output: { validPartsCount, totalRequested: images.length },
		});
	}

	logger.info("dispatching Gemini Google Search Grounding request", {
		stage: "gemini_api_call_start",
		input: {
			model,
			promptLength: prompt.length,
			hasImages: validPartsCount > 0,
			imagePartsCount: validPartsCount,
			tools: ["googleSearch"],
		},
	});

	const started = Date.now();
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const response = await Promise.race([
			ai.models.generateContent({
				model,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				contents: contents as any,
				config: {
					responseMimeType: "application/json",
					tools: [{ googleSearch: {} }],
				},
			}),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error("Gemini request timed out")), config.GEMINI_TIMEOUT_MS);
			}),
		]);

		const latencyMs = Date.now() - started;
		const output = response.text;
		const candidate = response.candidates?.[0];
		const groundingMetadata = candidate?.groundingMetadata as GroundingMetadata | undefined;
		const parsedData = output ? jsonBlock(output) : null;

		logger.info("Gemini Grounding response received", {
			stage: "gemini_api_call_completed",
			output: {
				latencyMs,
				outputLength: output?.length ?? 0,
				hasGroundingMetadata: Boolean(groundingMetadata),
				searchQueries: groundingMetadata?.webSearchQueries ?? [],
				groundingChunksCount: groundingMetadata?.groundingChunks?.length ?? 0,
				groundingSupportsCount: groundingMetadata?.groundingSupports?.length ?? 0,
				jsonParsed: Boolean(parsedData),
			},
		});

		return {
			data: parsedData,
			groundingMetadata,
		};
	} catch (error) {
		logger.error("Gemini API call failed", {
			stage: "gemini_api_call_failed",
			output: {
				latencyMs: Date.now() - started,
				error: error instanceof Error ? error.message : String(error),
			},
		});
		throw error;
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export async function gemini(prompt: string, env: Env, images?: string[]): Promise<unknown | null> {
	const res = await geminiGrounded(prompt, env, images);
	return res ? res.data : null;
}
