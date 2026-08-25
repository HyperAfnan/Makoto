import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFiles = [resolve(process.cwd(), ".env")];
const envFile = envFiles.find((file) => existsSync(file));
if (envFile) dotenv.config({ path: envFile });

export const env = {
	NODE_ENV: process.env.NODE_ENV ?? "development",
	PORT: Number(process.env.PORT ?? 8787),
	LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
	SWAGGER_ENABLED: process.env.SWAGGER_ENABLED !== "false",
	REDIS_URL: process.env.REDIS_URL,
	CACHE_TTL_SECONDS: Number(process.env.CACHE_TTL_SECONDS ?? 21600),
	ANALYSIS_TIMEOUT_MS: Number(process.env.ANALYSIS_TIMEOUT_MS ?? 20000),
	SEARCH_TIMEOUT_MS: Number(process.env.SEARCH_TIMEOUT_MS ?? 8000),
	GEMINI_TIMEOUT_MS: Number(process.env.GEMINI_TIMEOUT_MS ?? 15000),
	RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 30),
	RATE_LIMIT_WINDOW_SECONDS: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 3600),
};
