import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { redisIncrement } from "../cache/redis.js";
import { logger } from "../utils/logger.js";

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
	const identity = createHash("sha256")
		.update(req.ip || "anonymous")
		.digest("hex")
		.slice(0, 16);
	const window = Math.floor(Date.now() / 1000 / env.RATE_LIMIT_WINDOW_SECONDS);
	const count = await redisIncrement(`rate:${identity}:${window}`, env.RATE_LIMIT_WINDOW_SECONDS);
	if (count !== null && count > env.RATE_LIMIT_MAX) {
		const retryAfter =
			env.RATE_LIMIT_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % env.RATE_LIMIT_WINDOW_SECONDS);
		logger.warn("rate limit exceeded", { ip: identity, count, retryAfter });
		res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Rate limit exceeded" });
		return;
	}
	next();
}
