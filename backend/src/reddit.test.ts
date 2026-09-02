import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "./services/analysis.service.js";
import { analyzeRedditPost, fetchRedditPostJson, normalizeRedditJsonUrl } from "./services/reddit.service.js";
import type { AnalysisRequest } from "./types/shared.js";

test("validate accepts platform 'reddit'", () => {
	const request: AnalysisRequest = {
		selection: "NASA discovered water plumes on Europa",
		tweet: "NASA's Europa Clipper confirms active water plumes",
		url: "https://www.reddit.com/r/space/comments/1abcxyz/europa_clipper_update/",
		author: "u/astronomer_dan",
		timestamp: "2026-04-01T00:00:00Z",
		platform: "reddit",
		subreddit: "r/space",
		action: "claim",
	};

	const result = validate(request);
	assert.equal(result.error, undefined);
	assert.equal(result.value?.platform, "reddit");
	assert.equal(result.value?.subreddit, "r/space");
});

test("normalizeRedditJsonUrl converts public Reddit URLs to JSON endpoints", () => {
	assert.equal(
		normalizeRedditJsonUrl("https://www.reddit.com/r/technology/comments/1i3xyz/apple_m4/"),
		"https://www.reddit.com/r/technology/comments/1i3xyz/apple_m4.json",
	);
	assert.equal(
		normalizeRedditJsonUrl("https://reddit.com/r/science/comments/abc123/study?sort=top"),
		"https://www.reddit.com/r/science/comments/abc123/study.json",
	);
	assert.equal(
		normalizeRedditJsonUrl("https://www.reddit.com/comments/123456.json"),
		"https://www.reddit.com/comments/123456.json",
	);
});

test("fetchRedditPostJson gracefully returns null on invalid or unreachable URL", async () => {
	const result = await fetchRedditPostJson("https://www.reddit.com/r/nonexistent_sub_xyz_123/comments/00000/test/");
	assert.equal(result, null);
});

test("analyzeRedditPost completes claim analysis and returns evidence summary", async () => {
	const input: AnalysisRequest = {
		selection: "Electric vehicles cause more tire wear than gas cars",
		tweet: "[r/cars] Recent study explores EV tire wear compared to ICE vehicles",
		url: "https://www.reddit.com/r/cars/comments/test123ev/tire_wear_study/",
		author: "u/carenthusiast",
		timestamp: "2026-02-15T00:00:00Z",
		platform: "reddit",
		subreddit: "r/cars",
		action: "claim",
	};

	const statuses: string[] = [];
	const response = await analyzeRedditPost(
		"claim",
		input,
		{}, // No API key -> test fallback path
		"test-reddit-req-id",
		(msg) => statuses.push(msg),
	);

	assert.equal(response.status, "completed");
	assert.equal(response.requestId, "test-reddit-req-id");
	assert.equal(response.input.platform, "reddit");
	assert.equal(response.input.subreddit, "r/cars");
	assert.ok(response.search !== undefined);
	assert.ok(response.analysis !== undefined);
	assert.ok(response.evidence !== undefined);
	assert.ok(statuses.length > 0);
});

test("analyzeRedditPost completes context analysis for Reddit posts", async () => {
	const input: AnalysisRequest = {
		selection: "New breakthrough in solid state batteries reported",
		tweet: "[r/technology] Breakthrough solid state battery reaches 1000 Wh/kg",
		url: "https://www.reddit.com/r/technology/comments/test456/battery_breakthrough/",
		author: "u/techinsider",
		timestamp: "2026-03-10T00:00:00Z",
		platform: "reddit",
		subreddit: "r/technology",
		action: "context",
	};

	const statuses: string[] = [];
	const response = await analyzeRedditPost("context", input, {}, "test-reddit-context-id", (msg) =>
		statuses.push(msg),
	);

	assert.equal(response.action, "context");
	assert.equal(response.status, "completed");
	assert.ok(response.analysis.summary.length > 0);
	assert.equal(response.input.platform, "reddit");
});
