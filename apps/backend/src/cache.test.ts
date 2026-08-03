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
