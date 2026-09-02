import { analyzeClaim, analyzeContext } from "../ai.js";
import { createProvider, generateQueries, searchEvidence } from "../search.js";
import type { Env } from "../types/env.js";
import type { StatusSender } from "../types/http.js";
import type { Action, AnalysisRequest, AnalysisResponse, TweetContext } from "../types/shared.js";
import { logger } from "../utils/logger.js";
import { calculateEvidence } from "./evidence.service.js";

export type ScrapedRedditPost = {
	title: string;
	selftext: string;
	author: string;
	subreddit: string;
	timestamp: string;
	externalUrl?: string;
	images: string[];
	topComments: string[];
};

export function normalizeRedditJsonUrl(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl);
		let pathname = parsed.pathname.replace(/\/+$/, "");
		if (!pathname.endsWith(".json")) {
			pathname = `${pathname}.json`;
		}
		return `https://www.reddit.com${pathname}`;
	} catch {
		const clean = rawUrl.replace(/\?.*$/, "").replace(/\/+$/, "");
		return clean.endsWith(".json") ? clean : `${clean}.json`;
	}
}

function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

export async function fetchRedditPostJson(url: string): Promise<ScrapedRedditPost | null> {
	const jsonUrl = normalizeRedditJsonUrl(url);
	logger.info("fetching Reddit post via public JSON API", {
		stage: "reddit_json_fetch_start",
		url,
		jsonUrl,
	});

	try {
		const response = await fetch(jsonUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			logger.warn("Reddit public JSON API returned non-200 status", {
				stage: "reddit_json_fetch_non_200",
				status: response.status,
				statusText: response.statusText,
				url,
			});
			return null;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const data = (await response.json()) as any;
		if (!Array.isArray(data) || data.length === 0) {
			logger.warn("unexpected Reddit JSON response format", { stage: "reddit_json_parse_invalid", url });
			return null;
		}

		const postChild = data[0]?.data?.children?.[0]?.data;
		if (!postChild) {
			logger.warn("Reddit post listing empty", { stage: "reddit_json_empty_children", url });
			return null;
		}

		const title = String(postChild.title || "").trim();
		const selftext = String(postChild.selftext || "").trim();
		const author = postChild.author ? `u/${postChild.author}` : "";
		const subreddit = postChild.subreddit_name_prefixed || (postChild.subreddit ? `r/${postChild.subreddit}` : "");
		const createdUtc = postChild.created_utc ? new Date(postChild.created_utc * 1000).toISOString() : "";

		const rawPostUrl = postChild.url ? String(postChild.url) : "";
		const isExternalUrl = rawPostUrl && !rawPostUrl.includes("reddit.com") && !rawPostUrl.includes("redd.it");
		const externalUrl = isExternalUrl ? rawPostUrl : undefined;

		// Extract attached images
		const images: string[] = [];
		if (
			rawPostUrl &&
			(rawPostUrl.endsWith(".jpg") ||
				rawPostUrl.endsWith(".png") ||
				rawPostUrl.endsWith(".webp") ||
				rawPostUrl.includes("i.redd.it"))
		) {
			images.push(rawPostUrl);
		}

		// Extract preview images
		const previews = postChild.preview?.images;
		if (Array.isArray(previews)) {
			for (const prev of previews) {
				const src = prev?.source?.url;
				if (src && typeof src === "string") {
					images.push(decodeHtmlEntities(src));
				}
			}
		}

		// Extract gallery metadata
		if (postChild.media_metadata && typeof postChild.media_metadata === "object") {
			for (const mediaId of Object.keys(postChild.media_metadata)) {
				const media = postChild.media_metadata[mediaId];
				const src = media?.s?.u || media?.s?.gif;
				if (src && typeof src === "string") {
					images.push(decodeHtmlEntities(src));
				}
			}
		}

		// Extract top comments for context
		const topComments: string[] = [];
		const commentChildren = data[1]?.data?.children;
		if (Array.isArray(commentChildren)) {
			for (const child of commentChildren.slice(0, 3)) {
				const body = child?.data?.body;
				if (body && typeof body === "string" && body !== "[deleted]" && body !== "[removed]") {
					topComments.push(body.slice(0, 500));
				}
			}
		}

		const uniqueImages = Array.from(new Set(images)).slice(0, 4);

		logger.info("Reddit post JSON parsed successfully", {
			stage: "reddit_json_fetch_success",
			title,
			author,
			subreddit,
			hasExternalUrl: Boolean(externalUrl),
			imagesCount: uniqueImages.length,
			commentsCount: topComments.length,
		});

		return {
			title,
			selftext,
			author,
			subreddit,
			timestamp: createdUtc,
			externalUrl,
			images: uniqueImages,
			topComments,
		};
	} catch (error) {
		logger.warn("failed to fetch Reddit public JSON; using fallback context", {
			stage: "reddit_json_fetch_error",
			url,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export async function analyzeRedditPost(
	action: Action,
	input: AnalysisRequest,
	credentials: Env,
	requestId: string,
	onStatus: StatusSender,
): Promise<AnalysisResponse> {
	const started = Date.now();

	// Step 1: Enrich via Reddit's no-auth JSON API
	onStatus("Fetching Reddit post details...");
	const redditData = await fetchRedditPostJson(input.url);

	const effectiveTitle = redditData?.title || input.selection;
	const effectiveAuthor = redditData?.author || input.author;
	const effectiveSubreddit = redditData?.subreddit || input.subreddit;
	const effectiveTimestamp = redditData?.timestamp || input.timestamp;
	const effectiveBody = redditData?.selftext || input.tweet || input.selection;

	// Merge images from client DOM extraction and Reddit API
	const mergedImages = Array.from(new Set([...(input.images ?? []), ...(redditData?.images ?? [])])).slice(0, 4);

	// Context string for search & synthesis
	const contextParts = [
		effectiveSubreddit ? `[${effectiveSubreddit}]` : "",
		effectiveTitle,
		effectiveBody !== effectiveTitle ? effectiveBody.slice(0, 1000) : "",
		redditData?.externalUrl ? `Link: ${redditData.externalUrl}` : "",
	].filter(Boolean);

	const fullContextText = contextParts.join("\n");
	const selectionText = input.selection.trim() || effectiveTitle;

	// Step 2: Query Generation & Search
	onStatus("Searching web evidence...");
	const baseQueries = generateQueries(selectionText, action);
	if (redditData?.externalUrl) {
		baseQueries.push(redditData.externalUrl);
	}
	if (effectiveTitle && effectiveTitle !== selectionText) {
		baseQueries.push(`${effectiveTitle} news fact check`);
	}

	const search = await searchEvidence(
		createProvider(credentials),
		Array.from(new Set(baseQueries)),
		3,
		input.settings?.maxSources ?? 5,
	);

	logger.info("Reddit post search completed", {
		requestId,
		action,
		provider: search.provider,
		rounds: search.rounds,
		sources: search.results.length,
		errors: search.errors,
		latencyMs: search.latencyMs,
	});

	if (search.results.length === 0) {
		logger.warn("no web evidence found for Reddit post", {
			requestId,
			action,
			provider: search.provider,
		});
		onStatus("No external web evidence found.");
	} else {
		onStatus(`Found ${search.results.length} sources.`);
	}

	// Step 3: AI Analysis (Claim / Context)
	onStatus("Analyzing...");
	const analysis =
		action === "claim"
			? await analyzeClaim(selectionText, search.results, credentials, mergedImages)
			: await analyzeContext(fullContextText, search.results, credentials, mergedImages);

	logger.info("Reddit post analysis completed", {
		requestId,
		action,
		sources: search.results.length,
		latencyMs: Date.now() - started,
	});

	const evidence = calculateEvidence(selectionText, search.results);

	const { settings: _settings, action: _action, ...postContext } = input;
	const response: AnalysisResponse = {
		requestId,
		action,
		status: "completed",
		message: "Reddit post analysis completed.",
		input: {
			...postContext,
			tweet: fullContextText,
			author: effectiveAuthor,
			timestamp: effectiveTimestamp,
			subreddit: effectiveSubreddit,
			images: mergedImages.length > 0 ? mergedImages : undefined,
		} as TweetContext,
		search,
		analysis,
		evidence,
	};

	return response;
}
