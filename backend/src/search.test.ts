import assert from "node:assert/strict";
import test from "node:test";
import { generateQueries, searchEvidence } from "./search.js";
import type { SearchProvider } from "./types/search.js";

test("generates bounded context queries", () => {
	assert.deepEqual(generateQueries("React is dying", "context"), [
		"React is dying",
		"React is dying background",
		"React is dying news",
		"React is dying history",
		"React is dying official source",
	]);
});

test("runs rounds in parallel and removes duplicate URLs", async () => {
	const provider: SearchProvider = {
		name: "fake",
		async search(query) {
			return [{ title: query, snippet: "", url: "https://example.com/item", domain: "example.com" }];
		},
	};
	const response = await searchEvidence(provider, ["one", "two", "three"]);
	assert.equal(response.rounds, 2);
	assert.equal(response.results.length, 1);
});

test("reports missing provider without throwing", async () => {
	const response = await searchEvidence(null, ["one"]);
	assert.deepEqual(response.errors, ["No search API key configured"]);
});
