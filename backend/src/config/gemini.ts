import { GoogleGenAI } from "@google/genai";
import { jsonBlock } from "../utils/ai.utils.js";
import { env as config } from "./env.js";
import type { Env } from "../types/env.js";

export async function gemini(prompt: string, env: Env): Promise<unknown | null> {
	if (!env.GEMINI_API_KEY) return null;
	const model = env.GEMINI_MODEL ?? "gemini-2.0-flash";
	const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const response = await Promise.race([
			ai.models.generateContent({
				model,
				contents: prompt,
				config: {
					responseMimeType: "application/json",
				},
			}),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error("Gemini request timed out")), config.GEMINI_TIMEOUT_MS);
			}),
		]);
		const output = response.text;
		return output ? jsonBlock(output) : null;
	} finally {
		if (timer) clearTimeout(timer);
	}
}
