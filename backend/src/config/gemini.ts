import { GoogleGenAI } from "@google/genai";
import { jsonBlock } from "../utils/ai.utils.js";
import { env as config } from "./env.js";
import type { Env } from "../types/env.js";

async function fetchImagePart(image: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
	try {
		if (image.startsWith("data:")) {
			const match = image.match(/^data:([^;]+);base64,(.+)$/);
			if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
		}
		if (image.startsWith("http://") || image.startsWith("https://")) {
			const response = await fetch(image, { signal: AbortSignal.timeout(5000) });
			if (!response.ok) return null;
			const buffer = await response.arrayBuffer();
			const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
			return {
				inlineData: {
					mimeType,
					data: Buffer.from(buffer).toString("base64"),
				},
			};
		}
	} catch {
		// Ignore image fetch errors, proceed gracefully
	}
	return null;
}

export async function gemini(prompt: string, env: Env, images?: string[]): Promise<unknown | null> {
	if (!env.GEMINI_API_KEY) return null;
	const model = env.GEMINI_MODEL ?? "gemini-2.0-flash";
	const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

	let contents: unknown = prompt;
	if (images && images.length > 0) {
		const fetchedParts = await Promise.all(images.slice(0, 4).map(fetchImagePart));
		const validParts = fetchedParts.filter((part): part is { inlineData: { mimeType: string; data: string } } =>
			Boolean(part),
		);
		if (validParts.length > 0) {
			contents = [...validParts, { text: prompt }];
		}
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const response = await Promise.race([
			ai.models.generateContent({
				model,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				contents: contents as any,
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
