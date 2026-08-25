import type { SearchResult } from "./shared.js";

export interface SearchProvider {
	readonly name: string;
	search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}
