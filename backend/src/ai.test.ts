import assert from "node:assert/strict";
import test from "node:test";
import { analyzeClaim, analyzeContext, classify } from "./ai.js";
import type { SearchResult } from "./types/shared.js";

test("classify correctly identifies question", () => {
	assert.equal(classify("Who was the first person on the moon?"), "question");
	assert.equal(classify("Is React dying?"), "question");
});

test("classify correctly identifies prediction", () => {
	assert.equal(classify("Electric vehicles will dominate the roads by 2030"), "prediction");
	assert.equal(classify("Experts expect interest rates to drop"), "prediction");
});

test("classify correctly identifies opinion", () => {
	assert.equal(classify("I think TypeScript is the best programming language"), "opinion");
	assert.equal(classify("This movie was terrible"), "opinion");
});

test("classify correctly identifies fact", () => {
	assert.equal(classify("Water boils at 100 degrees Celsius at sea level"), "fact");
});

test("classify handles mixed or empty strings", () => {
	assert.equal(classify(""), "mixed");
	assert.equal(classify("Water boils at 100 degrees. I love science!"), "mixed");
});

test("analyzeContext returns fallback when no GEMINI_API_KEY is provided", async () => {
	const results: SearchResult[] = [
		{
			title: "Test Title",
			snippet: "Test snippet content",
			url: "https://example.com/test",
			domain: "example.com",
		},
	];
	const analysis = await analyzeContext("Test selection", results, {});
	assert.match(analysis.summary, /Search found 1 relevant sources/);
	assert.equal(analysis.background, "Test snippet content");
	assert.deepEqual(analysis.related, ["https://example.com/test"]);
});

test("analyzeContext returns empty fallback when no sources and no key", async () => {
	const analysis = await analyzeContext("Test selection", [], {});
	assert.equal(analysis.summary, "No reliable web evidence was found.");
	assert.equal(analysis.background, "");
	assert.deepEqual(analysis.related, []);
});

test("analyzeClaim rejects non-factual claim types without calling Gemini", async () => {
	const analysis = await analyzeClaim("I think vim is better than emacs", [], {});
	assert.equal(analysis.claimType, "opinion");
	assert.equal(analysis.reasoning, "This claim type is not eligible for a factual verdict.");
	assert.equal(analysis.verdict, undefined);
});

test("analyzeClaim returns fallback verdict for factual claims when no API key is provided", async () => {
	const results: SearchResult[] = [
		{
			title: "Evidence",
			snippet: "Snippet",
			url: "https://example.com",
			domain: "example.com",
		},
	];
	const analysis = await analyzeClaim("Earth orbits the Sun", results, {});
	assert.equal(analysis.claimType, "fact");
	assert.equal(analysis.verdict, "unverifiable");
	assert.match(analysis.reasoning ?? "", /Gemini API key is required/);
});

test("analyzeContext and analyzeClaim gracefully accept optional images array", async () => {
	const results: SearchResult[] = [
		{
			title: "Evidence",
			snippet: "Snippet",
			url: "https://example.com",
			domain: "example.com",
		},
	];
	const images = ["https://pbs.twimg.com/media/test.jpg"];
	const contextRes = await analyzeContext("Test with image", results, {}, images);
	assert.match(contextRes.summary, /Search found 1 relevant sources/);

	const claimRes = await analyzeClaim("Earth orbits the Sun", results, {}, images);
	assert.equal(claimRes.verdict, "unverifiable");
	assert.match(claimRes.reasoning ?? "", /Gemini API key is required/);
});
