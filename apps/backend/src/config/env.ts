import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envFiles = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "apps/backend/.env")];
const envFile = envFiles.find((file) => existsSync(file));
if (envFile) dotenv.config({ path: envFile });

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 8787),
  SEARCH_PROVIDER: process.env.SEARCH_PROVIDER,
  BRAVE_API_KEY: process.env.BRAVE_API_KEY,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  SWAGGER_ENABLED: process.env.SWAGGER_ENABLED !== "false",
};

export const apiEnv: Record<string, string | undefined> = {
  SEARCH_PROVIDER: env.SEARCH_PROVIDER,
  BRAVE_API_KEY: env.BRAVE_API_KEY,
  TAVILY_API_KEY: env.TAVILY_API_KEY,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  GEMINI_MODEL: env.GEMINI_MODEL,
};
