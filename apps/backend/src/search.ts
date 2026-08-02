import type { SearchResult } from "@context/shared";

export interface SearchProvider {
  readonly name: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}

const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function normalize(item: { title?: unknown; snippet?: unknown; description?: unknown; url?: unknown; link?: unknown }): SearchResult | null {
  const url = String(item.url ?? item.link ?? "");
  if (!url.startsWith("http")) return null;
  return {
    title: String(item.title ?? "").trim(),
    snippet: String(item.snippet ?? item.description ?? "").trim(),
    url,
    domain: domain(url),
  };
}

async function json<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export class BraveProvider implements SearchProvider {
  readonly name = "brave";
  constructor(private readonly apiKey: string) {}

  async search(query: string, signal?: AbortSignal) {
    const data = await json<{ web?: { results?: Array<{ title?: string; description?: string; url?: string }> } }>(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      { headers: { Accept: "application/json", "X-Subscription-Token": this.apiKey }, signal },
    );
    return (data.web?.results ?? []).map((item) => normalize(item)).filter((item): item is SearchResult => Boolean(item));
  }
}

export class TavilyProvider implements SearchProvider {
  readonly name = "tavily";
  constructor(private readonly apiKey: string) {}

  async search(query: string, signal?: AbortSignal) {
    const data = await json<{ results?: Array<{ title?: string; content?: string; url?: string }> }>(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: this.apiKey, query, search_depth: "basic", max_results: 10 }),
        signal,
      },
    );
    return (data.results ?? [])
      .map((item) => normalize({ title: item.title, snippet: item.content, url: item.url }))
      .filter((item): item is SearchResult => Boolean(item));
  }
}

export function createProvider(env = process.env): SearchProvider | null {
  if (env.SEARCH_PROVIDER === "tavily" && env.TAVILY_API_KEY) return new TavilyProvider(env.TAVILY_API_KEY);
  if (env.BRAVE_API_KEY) return new BraveProvider(env.BRAVE_API_KEY);
  if (env.TAVILY_API_KEY) return new TavilyProvider(env.TAVILY_API_KEY);
  return null;
}

export function generateQueries(selection: string, action: "context" | "claim") {
  const topic = selection.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!topic) return [];
  const suffixes = action === "claim" ? ["fact check", "evidence", "official source", "rebuttal"] : ["background", "news", "history", "official source"];
  return [topic, ...suffixes.map((suffix) => `${topic} ${suffix}`)];
}

export async function searchEvidence(provider: SearchProvider | null, queries: string[], maxRounds = 3) {
  const started = Date.now();
  const results = new Map<string, SearchResult>();
  const attempted: string[] = [];
  const errors: string[] = [];
  if (!provider) return { provider: "none", queries: attempted, rounds: 0, results: [], errors: ["No search API key configured"], latencyMs: Date.now() - started };

  let rounds = 0;
  for (let offset = 0; offset < queries.length && rounds < maxRounds; offset += 2) {
    rounds += 1;
    const batch = queries.slice(offset, offset + 2);
    attempted.push(...batch);
    const settled = await Promise.allSettled(batch.map((query) => provider.search(query)));
    for (const item of settled) {
      if (item.status === "rejected") errors.push(String(item.reason));
      else for (const result of item.value) results.set(result.url, result);
    }
    if (results.size >= 5 && new Set([...results.values()].map((result) => result.domain)).size >= 3) break;
  }
  return { provider: provider.name, queries: attempted, rounds, results: [...results.values()], errors, latencyMs: Date.now() - started };
}
