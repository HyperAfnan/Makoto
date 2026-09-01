import { createHash } from "node:crypto";
import type { ApiSettings } from "../types/shared.js";
import { env } from "../config/env.js";
import { redisGet, redisSet } from "../cache/redis.js";

export function cacheKey(
	platform: string,
	tweetUrl: string,
	selection: string,
	action: string,
	settings?: ApiSettings,
	images?: string[],
) {
	const settingsFingerprint = createHash("sha256")
		.update(
			JSON.stringify({
				searchProvider: settings?.searchProvider ?? "",
				braveApiKey: settings?.braveApiKey ?? "",
				tavilyApiKey: settings?.tavilyApiKey ?? "",
				geminiApiKey: settings?.geminiApiKey ?? "",
				geminiModel: settings?.geminiModel ?? "gemini-2.0-flash",
				maxSources: settings?.maxSources ?? 5,
				images: (images ?? []).slice().sort(),
			}),
		)
		.digest("hex");
	const raw = `${platform}:${tweetUrl}:${selection.trim().replace(/\s+/g, " ").toLowerCase()}:${action}:${settingsFingerprint}`;
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
