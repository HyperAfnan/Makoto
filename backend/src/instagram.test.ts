import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "./services/analysis.service.js";
import { analyzeInstagramReel, extractVideoIntelligence, scrapeInstagramReel } from "./services/instagram.service.js";
import type { AnalysisRequest } from "./types/shared.js";

test("validate accepts platform 'instagram'", () => {
	const request: AnalysisRequest = {
		selection: "Cold plunges boost dopamine by 250%",
		tweet: "Cold plunges boost dopamine by 250% according to new study #health",
		url: "https://www.instagram.com/reel/C3b4XYZ123/",
		author: "hubermanlab",
		timestamp: "2026-03-01T00:00:00Z",
		platform: "instagram",
		action: "claim",
	};

	const result = validate(request);
	assert.equal(result.error, undefined);
	assert.equal(result.value?.platform, "instagram");
});

test("scrapeInstagramReel gracefully handles missing Apify token", async () => {
	const result = await scrapeInstagramReel("https://www.instagram.com/reel/C3b4XYZ123/", "");
	assert.equal(result.url, "https://www.instagram.com/reel/C3b4XYZ123/");
	assert.equal(result.videoUrl, undefined);
});

test("extractVideoIntelligence returns structured fallback when no Gemini key is provided", async () => {
	const intel = await extractVideoIntelligence(
		undefined,
		"Look at this amazing discovery in physics",
		"scienceguy",
		undefined,
	);

	assert.equal(intel.transcript, "");
	assert.ok(intel.claims && intel.claims.length > 0);
	assert.ok(intel.claims && intel.claims[0].includes("amazing discovery"));
	assert.ok(intel.searchQueries.length > 0);
});

test("analyzeInstagramReel completes analysis pipeline and returns videoContext with search results", async () => {
	const input: AnalysisRequest = {
		selection: "Eating carrots improves night vision",
		tweet: "WW2 secret revealed: eating carrots gives you night vision!",
		url: "https://www.instagram.com/reel/C123Test/",
		author: "historyfacts",
		timestamp: "2026-01-01T00:00:00Z",
		platform: "instagram",
		action: "claim",
	};

	const statuses: string[] = [];
	const response = await analyzeInstagramReel(
		"claim",
		input,
		{ APIFY_API_KEY: "" }, // Explicit empty API key to test fallback path deterministically
		"test-reel-req-id",
		(msg) => statuses.push(msg),
	);

	assert.equal(response.status, "completed");
	assert.equal(response.requestId, "test-reel-req-id");
	assert.equal(response.input.platform, "instagram");
	assert.ok(response.search !== undefined);
	assert.ok(response.analysis.videoContext !== undefined);
	assert.ok(response.evidence !== undefined);
	assert.ok(statuses.length > 0);
});

test("analyzeInstagramReel handles context action for Instagram Reels", async () => {
	const input: AnalysisRequest = {
		selection: "Exciting new telescope launch in 2026",
		tweet: "NASA launches new orbital observatory",
		url: "https://www.instagram.com/reel/C456Space/",
		author: "nasa",
		timestamp: "2026-05-01T00:00:00Z",
		platform: "instagram",
		action: "context",
	};

	const statuses: string[] = [];
	const response = await analyzeInstagramReel("context", input, { APIFY_API_KEY: "" }, "test-context-req-id", (msg) =>
		statuses.push(msg),
	);

	assert.equal(response.action, "context");
	assert.equal(response.status, "completed");
	assert.ok(response.analysis.summary.length > 0);
	assert.ok(response.analysis.videoContext !== undefined);
});
