import assert from "node:assert/strict";
import test from "node:test";
import { cacheKey } from "./services/cache.service.js";

const base = ["x", "https://x.com/example/status/1", "React is dying", "claim"] as const;

test("cache keys change when API settings change without exposing keys", () => {
	const noKeys = cacheKey(...base);
	const configured = cacheKey(...base, {
		searchProvider: "brave",
		braveApiKey: "brave-secret",
		geminiApiKey: "gemini-secret",
	});

	assert.notEqual(noKeys, configured);
	assert.ok(!configured.includes("brave-secret"));
	assert.ok(!configured.includes("gemini-secret"));
});

test("identical settings produce stable cache keys", () => {
	const settings = { searchProvider: "brave" as const, geminiApiKey: "gemini-secret", maxSources: 5 };
	assert.equal(cacheKey(...base, settings), cacheKey(...base, { ...settings }));
	assert.notEqual(cacheKey(...base, settings), cacheKey(...base, { ...settings, maxSources: 10 }));
});

test("cache keys change when images change and are stable under reordering", () => {
	const keyWithoutImages = cacheKey(...base);
	const keyWithImages1 = cacheKey(...base, undefined, ["https://example.com/1.jpg", "https://example.com/2.jpg"]);
	const keyWithImages2 = cacheKey(...base, undefined, ["https://example.com/2.jpg", "https://example.com/1.jpg"]);
	const keyWithOtherImage = cacheKey(...base, undefined, ["https://example.com/3.jpg"]);

	assert.notEqual(keyWithoutImages, keyWithImages1);
	assert.equal(keyWithImages1, keyWithImages2);
	assert.notEqual(keyWithImages1, keyWithOtherImage);
});
