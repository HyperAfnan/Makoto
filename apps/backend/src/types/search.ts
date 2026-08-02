import type { SearchResult } from "@context/shared";

export interface SearchProvider {
  readonly name: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}
