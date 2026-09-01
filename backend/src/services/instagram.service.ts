import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getApifyClient } from "../config/apify.js";
import { env as config } from "../config/env.js";
import { getGoogleGenAI } from "../config/gemini.js";
import { createProvider, generateQueries, searchEvidence } from "../search.js";
import type { Env } from "../types/env.js";
import type { StatusSender } from "../types/http.js";
import type {
	Action,
	AnalysisRequest,
	AnalysisResponse,
	AnalysisResult,
	ClaimType,
	TweetContext,
	Verdict,
	VideoContext,
} from "../types/shared.js";
import { evidenceText, jsonBlock } from "../utils/ai.utils.js";
import { logger } from "../utils/logger.js";
import { ReelSynthesisPrompt, ReelVideoExtractionPrompt } from "../utils/prompts.utils.js";
import { calculateEvidence } from "./evidence.service.js";

export type ScrapedReel = {
	url: string;
	videoUrl?: string;
	caption: string;
	author: string;
	displayUrl?: string;
	timestamp?: string;
};

export async function scrapeInstagramReel(url: string, token?: string): Promise<ScrapedReel> {
	const apifyToken = token !== undefined ? token : config.APIFY_API_TOKEN;
	if (!apifyToken) {
		logger.warn("no Apify token provided; skipping Apify scrape", {
			stage: "instagram_scrape_skipped",
			url,
		});
		return { url, caption: "", author: "" };
	}

	logger.info("scraping Instagram Reel with Apify", {
		stage: "instagram_scrape_start",
		actorId: config.APIFY_ACTOR_ID,
		url,
	});

	try {
		const apify = getApifyClient(apifyToken);
		const run = await apify.actor(config.APIFY_ACTOR_ID).call({
			directUrls: [url],
			resultsType: "details",
		});

		const { items } = await apify.dataset(run.defaultDatasetId).listItems();
		if (!items || items.length === 0) {
			logger.warn("Apify returned no items for Reel", { stage: "instagram_scrape_empty", url });
			return { url, caption: "", author: "" };
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const item = items[0] as Record<string, any>;
		const videoUrl =
			item.videoUrl || item.video_url || item.videoUrlList?.[0] || (item.type === "Video" ? item.url : undefined);

		const caption = item.caption || item.text || item.title || "";
		const author = item.ownerUsername || item.owner?.username || item.author || item.user?.username || "";

		const scraped: ScrapedReel = {
			url,
			videoUrl,
			caption,
			author,
			displayUrl: item.displayUrl || item.thumbnailUrl,
			timestamp: item.timestamp || item.takenAtTimestamp,
		};

		logger.info("Instagram Reel scraped successfully", {
			stage: "instagram_scrape_completed",
			url,
			hasVideoUrl: Boolean(videoUrl),
			author,
			captionLength: caption.length,
		});

		return scraped;
	} catch (error) {
		logger.error("Apify Instagram Reel scraping failed", {
			stage: "instagram_scrape_failed",
			url,
			error: error instanceof Error ? error.message : String(error),
		});
		return { url, caption: "", author: "" };
	}
}

export type VideoIntelligence = VideoContext & {
	searchQueries: string[];
	claims: string[];
};

export async function extractVideoIntelligence(
	videoUrl: string | undefined,
	caption: string,
	author: string,
	apiKey?: string,
	geminiModel?: string,
): Promise<VideoIntelligence> {
	if (!videoUrl || !apiKey) {
		logger.info("skipping video file extraction: no video URL or Gemini key", {
			stage: "video_intelligence_skipped",
			hasVideoUrl: Boolean(videoUrl),
			hasApiKey: Boolean(apiKey),
		});
		return {
			transcript: "",
			visualContext: "",
			onScreenText: "",
			claims: caption ? [caption.slice(0, 300)] : ["Instagram Reel"],
			searchQueries: caption ? [caption.slice(0, 100)] : ["Instagram Reel"],
		};
	}

	const tempFilePath = join(tmpdir(), `reel_${randomUUID()}.mp4`);
	let uploadedFileName: string | undefined;

	try {
		logger.info("downloading Reel video for multimodal extraction", {
			stage: "video_download_start",
			videoUrlSnippet: videoUrl.slice(0, 100),
		});

		const videoResponse = await fetch(videoUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				Referer: "https://www.instagram.com/",
				Accept: "*/*",
			},
			signal: AbortSignal.timeout(30_000),
		});

		if (!videoResponse.ok) {
			throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
		}

		const videoBuffer = await videoResponse.arrayBuffer();
		await writeFile(tempFilePath, Buffer.from(videoBuffer));

		const model = geminiModel ?? "gemini-2.0-flash";
		const ai = getGoogleGenAI(apiKey);
		logger.info("uploading video to Gemini File API", {
			stage: "gemini_file_upload_start",
			fileSizeBytes: videoBuffer.byteLength,
		});

		const uploadResult = await ai.files.upload({
			file: tempFilePath,
			mimeType: "video/mp4",
		} as unknown as { file: string });
		uploadedFileName = uploadResult.name;

		// Wait briefly if file is still processing
		let file = uploadResult;
		let pollAttempts = 0;
		if (uploadResult.name) {
			while (file.state === "PROCESSING" && pollAttempts < 10) {
				pollAttempts++;
				await new Promise((resolve) => setTimeout(resolve, 1500));
				file = await ai.files.get({ name: uploadResult.name });
			}
		}

		logger.info("video uploaded to Gemini File API; generating video intelligence", {
			stage: "gemini_video_extraction_start",
			fileName: uploadedFileName,
			fileState: file.state,
		});

		const extractionPrompt = ReelVideoExtractionPrompt(caption, author);
		const response = await ai.models.generateContent({
			model,
			contents: [
				{
					fileData: {
						fileUri: file.uri || uploadResult.uri,
						mimeType: file.mimeType || uploadResult.mimeType || "video/mp4",
					},
				},
				{ text: extractionPrompt },
			],
			config: { responseMimeType: "application/json" },
		});

		const parsed = response.text ? (jsonBlock(response.text) as Record<string, unknown>) : null;
		const transcript = String(parsed?.transcript || "");
		const visualContext = String(parsed?.visualContext || "");
		const onScreenText = String(parsed?.onScreenText || "");
		const claims = Array.isArray(parsed?.claims) ? parsed.claims.map(String) : [];
		const searchQueries = Array.isArray(parsed?.searchQueries) ? parsed.searchQueries.map(String) : [];

		logger.info("video intelligence extracted successfully", {
			stage: "video_intelligence_completed",
			transcriptLength: transcript.length,
			claimsCount: claims.length,
			queriesCount: searchQueries.length,
		});

		return {
			transcript,
			visualContext,
			onScreenText,
			claims,
			searchQueries,
		};
	} catch (error) {
		logger.warn("video intelligence extraction failed; using caption fallback", {
			stage: "video_intelligence_failed",
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			transcript: "",
			visualContext: "",
			onScreenText: "",
			claims: caption ? [caption.slice(0, 300)] : [],
			searchQueries: caption ? [caption.slice(0, 100)] : [],
		};
	} finally {
		// Clean up local temp file
		unlink(tempFilePath).catch(() => undefined);
		// Clean up remote file from Gemini File API
		if (uploadedFileName && apiKey) {
			const ai = getGoogleGenAI(apiKey);
			ai.files.delete({ name: uploadedFileName }).catch(() => undefined);
		}
	}
}

export async function analyzeInstagramReel(
	action: Action,
	input: AnalysisRequest,
	credentials: Env & { APIFY_API_KEY?: string },
	requestId: string,
	onStatus: StatusSender,
): Promise<AnalysisResponse> {
	const started = Date.now();

	// Step 1: Scrape Reel details via Apify
	onStatus("Scraping Reel details via Apify...");
	const scraped = await scrapeInstagramReel(input.url, credentials.APIFY_API_KEY);
	const effectiveCaption = scraped.caption || input.tweet || input.selection;
	const effectiveAuthor = scraped.author || input.author;
	const videoUrl = scraped.videoUrl;

	// Step 2: Multimodal Video & Audio Intelligence with Gemini
	onStatus("Transcribing audio & analyzing Reel video...");
	const videoIntel = await extractVideoIntelligence(
		videoUrl,
		effectiveCaption,
		effectiveAuthor,
		credentials.GEMINI_API_KEY,
		credentials.GEMINI_MODEL,
	);

	// Step 3: Search Web Evidence via Brave / Tavily
	onStatus("Searching web evidence...");
	const extractedQueries = videoIntel.searchQueries.filter(Boolean);
	const fallbackQueries = generateQueries(effectiveCaption || input.selection, action);
	const queries = extractedQueries.length > 0 ? extractedQueries : fallbackQueries;

	const search = await searchEvidence(createProvider(credentials), queries, 3, input.settings?.maxSources ?? 5);

	logger.info("Instagram Reel search completed", {
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
		logger.warn("no search evidence found for Reel", {
			requestId,
			action,
			provider: search.provider,
			errors: search.errors,
		});
		onStatus("No external web evidence found.");
	} else {
		onStatus(`Found ${search.results.length} sources.`);
	}

	// Step 4: Grounded Synthesis with Gemini
	onStatus("Synthesizing verdict...");
	const model = credentials.GEMINI_MODEL ?? "gemini-2.0-flash";
	let analysis: AnalysisResult = {
		summary: `Instagram Reel by ${effectiveAuthor || "creator"}: ${effectiveCaption.slice(0, 200)}`,
		background:
			videoIntel.visualContext ||
			(search.results.length ? search.results[0].snippet : "Instagram Reel content analyzed."),
		related: search.results.length ? search.results.slice(0, 5).map((s) => s.url) : [input.url],
		claims: videoIntel.claims,
		videoContext: {
			transcript: videoIntel.transcript,
			visualContext: videoIntel.visualContext,
			onScreenText: videoIntel.onScreenText,
			claims: videoIntel.claims,
		},
	};

	if (credentials.GEMINI_API_KEY) {
		const ai = getGoogleGenAI(credentials.GEMINI_API_KEY);
		const formattedEvidence = evidenceText(search.results);
		const synthesisPrompt = ReelSynthesisPrompt(
			action,
			effectiveCaption,
			effectiveAuthor,
			videoIntel,
			formattedEvidence,
		);

		try {
			const synthResponse = await ai.models.generateContent({
				model,
				contents: synthesisPrompt,
				config: {
					responseMimeType: "application/json",
				},
			});

			const parsed = synthResponse.text ? (jsonBlock(synthResponse.text) as Partial<AnalysisResult>) : null;
			if (parsed) {
				analysis = {
					summary: parsed.summary || analysis.summary,
					background: parsed.background || analysis.background,
					related: Array.isArray(parsed.related) && parsed.related.length > 0 ? parsed.related : analysis.related,
					claimType: parsed.claimType as ClaimType | undefined,
					claims: Array.isArray(parsed.claims) && parsed.claims.length > 0 ? parsed.claims : analysis.claims,
					verdict: parsed.verdict as Verdict | undefined,
					reasoning: parsed.reasoning,
					videoContext: {
						transcript: videoIntel.transcript,
						visualContext: videoIntel.visualContext,
						onScreenText: videoIntel.onScreenText,
						claims: videoIntel.claims,
					},
				};
			}
		} catch (synthError) {
			logger.error("Reel synthesis failed", {
				stage: "reel_synthesis_failed",
				error: synthError instanceof Error ? synthError.message : String(synthError),
			});
		}
	} else if (action === "claim") {
		analysis.verdict = "unverifiable";
		analysis.reasoning = "Evidence was searched, but a Gemini API key is required to produce a grounded verdict.";
	}

	const evidence = calculateEvidence(input.selection, search.results);

	const { settings: _settings, action: _action, ...postContext } = input;
	const response: AnalysisResponse = {
		requestId,
		action,
		status: "completed",
		message: "Instagram Reel analysis completed.",
		input: {
			...postContext,
			tweet: effectiveCaption,
			author: effectiveAuthor,
		} as TweetContext,
		search,
		analysis,
		evidence,
	};

	logger.info("Instagram Reel analysis completed successfully", {
		requestId,
		action,
		provider: search.provider,
		sources: search.results.length,
		latencyMs: Date.now() - started,
	});

	return response;
}
