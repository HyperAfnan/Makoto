import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { redisGet, redisSet } from "../cache/redis.js";

export function cacheKey(platform: string, tweetUrl: string, selection: string, action: string) {
  const raw = `${platform}:${tweetUrl}:${selection.trim().replace(/\s+/g, " ").toLowerCase()}:${action}`;
  return `analysis:${createHash("sha256").update(raw).digest("hex")}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const value = await redisGet(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function setCached(key: string, value: unknown) {
  return redisSet(key, JSON.stringify(value), env.CACHE_TTL_SECONDS);
}
