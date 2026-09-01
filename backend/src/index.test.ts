import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "./index.js";

const valid = {
	action: "context",
	selection: "React is dying",
	tweet: "React is dying",
	url: "https://x.com/example/status/1",
	author: "@example",
	timestamp: "2026-08-02T00:00:00.000Z",
	platform: "x",
};

test("accepts a valid analysis request", () => {
	assert.equal(validate(valid).value?.selection, "React is dying");
});

test("rejects oversized selections", () => {
	assert.equal(
		validate({ ...valid, selection: "x".repeat(2001) }).error,
		"selection must be 2000 characters or fewer",
	);
});

test("rejects unsupported platforms", () => {
	assert.equal(validate({ ...valid, platform: "web" }).error, "platform must be x or instagram");
});

test("accepts instagram platform", () => {
	assert.equal(validate({ ...valid, platform: "instagram" }).error, undefined);
});

test("accepts empty author, timestamp, and missing tweet fallback", () => {
	const res = validate({
		action: "context",
		selection: "Instagram Reel",
		url: "https://www.instagram.com/reels/DcvHXZKzMNK/",
		author: "",
		timestamp: "",
		platform: "instagram",
	});
	assert.equal(res.error, undefined);
	assert.equal(res.value?.author, "");
	assert.equal(res.value?.timestamp, "");
	assert.equal(res.value?.tweet, "Instagram Reel");
});

test("accepts request-scoped API settings", () => {
	assert.equal(
		validate({ ...valid, settings: { searchProvider: "brave", braveApiKey: "key", maxSources: 5 } }).error,
		undefined,
	);
});

test("rejects invalid request-scoped API settings", () => {
	assert.equal(
		validate({ ...valid, settings: { searchProvider: "bing" as unknown as "google" } }).error,
		"settings.searchProvider must be google, brave, or tavily",
	);
});

test("accepts valid optional images array", () => {
	const res = validate({ ...valid, images: ["https://pbs.twimg.com/media/test.jpg"] });
	assert.equal(res.error, undefined);
	assert.deepEqual(res.value?.images, ["https://pbs.twimg.com/media/test.jpg"]);
});

test("rejects invalid images format or count", () => {
	assert.equal(validate({ ...valid, images: "not-an-array" }).error, "images must be an array of strings");
	assert.equal(
		validate({ ...valid, images: ["1", "2", "3", "4", "5"] }).error,
		"images must contain 4 or fewer items",
	);
	assert.equal(
		validate({ ...valid, images: [123] }).error,
		"each image must be a valid string under 50000 characters",
	);
});
