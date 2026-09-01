import type { ClaimType, SearchResult } from "../types/shared.js";

export const clean = (value: string) =>
	value
		.replace(/[\u0000-\u001f\u007f]/g, " ")
		.slice(0, 2000)
		.trim();

export const jsonBlock = (value: string) => JSON.parse(value.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? value);

export function classify(selection: string): ClaimType {
	const text = selection.trim().toLowerCase();
	if (!text) return "mixed";
	if (text.endsWith("?") || /^(who|what|when|where|why|how|is|are|does|do)\b/.test(text)) return "question";
	if (/\b(will|going to|likely|expect|predict|by \d{4})\b/.test(text)) return "prediction";
	if (/\b(i think|i believe|best|worst|should|must|amazing|terrible|better|worse)\b/.test(text)) return "opinion";
	return /[.!?].+[.!?]/.test(text) ? "mixed" : "fact";
}

export function evidenceText(results: SearchResult[]) {
	return results
		.slice(0, 12)
		.map((source, index) => `[${index + 1}] ${source.title}\n${source.snippet}\nURL: ${source.url}`)
		.join("\n\n");
}
