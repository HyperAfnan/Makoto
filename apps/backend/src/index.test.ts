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
  assert.equal(validate({ ...valid, selection: "x".repeat(2001) }).error, "selection must be 2000 characters or fewer");
});

test("rejects unsupported platforms", () => {
  assert.equal(validate({ ...valid, platform: "web" }).error, "platform must be x");
});
