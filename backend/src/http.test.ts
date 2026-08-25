import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { app } from "./index.js";

const server = app.listen(0);
const address = server.address() as AddressInfo;
const base = `http://127.0.0.1:${address.port}`;

const valid = {
	selection: "React is dying",
	tweet: "React is dying",
	url: "https://x.com/example/status/1",
	author: "@example",
	timestamp: "2026-08-02T00:00:00.000Z",
	platform: "x",
};

test.after(() => server.close());

test("health endpoint returns JSON", async () => {
	const response = await fetch(`${base}/health`);
	assert.equal(response.status, 200);
	assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
	assert.deepEqual(await response.json(), { ok: true });
});

test("Swagger endpoints return API documentation", async () => {
	const ui = await fetch(`${base}/api-docs`);
	const document = await fetch(`${base}/api-docs.json`);
	assert.equal(ui.status, 200);
	assert.equal(document.status, 200);
	const body = (await document.json()) as { paths: Record<string, unknown> };
	assert.ok(body.paths["/health"]);
	assert.ok(body.paths["/api/context"]);
	assert.ok(body.paths["/api/claim"]);
});

test("context endpoint preserves SSE event contract", async () => {
	const response = await fetch(`${base}/api/context`, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "text/event-stream" },
		body: JSON.stringify(valid),
	});
	const text = await response.text();
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
	assert.match(text, /event: status/);
	assert.match(text, /Searching/);
	assert.match(text, /event: completed/);
});

test("invalid JSON returns 400 JSON", async () => {
	const response = await fetch(`${base}/api/context`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: "{",
	});
	assert.equal(response.status, 400);
	assert.deepEqual(await response.json(), { error: "Invalid JSON" });
});

test("unknown routes return 404 JSON", async () => {
	const response = await fetch(`${base}/missing`);
	assert.equal(response.status, 404);
	assert.deepEqual(await response.json(), { error: "Not found" });
});
