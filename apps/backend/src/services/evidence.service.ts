import type { EvidenceSummary, SearchResult } from "@context/shared";

const officialDomains = new Set([
  "who.int",
  "un.org",
  "nasa.gov",
  "github.com",
  "npmjs.com",
  "react.dev",
  "nodejs.org",
]);
const stopWords = new Set(["the", "and", "for", "that", "this", "with", "from", "are", "was", "has", "have"]);

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );
}

function isOfficial(domain: string) {
  return domain.endsWith(".gov") || domain.endsWith(".edu") || officialDomains.has(domain.trim());
}

export function calculateEvidence(selection: string, results: SearchResult[]): EvidenceSummary {
  const domains = new Set(results.map((result) => result.domain).filter(Boolean));
  const target = words(selection);
  let support = 0;
  let conflicts = 0;
  for (const result of results) {
    const text = `${result.title} ${result.snippet}`;
    const overlap = [...target].filter((word) => words(text).has(word)).length / Math.max(target.size, 1);
    const contradiction = /\b(false|debunked|misleading|incorrect|no evidence|not true|denied|rejects)\b/i.test(text);
    if (contradiction) conflicts += 1;
    else if (overlap >= 0.2) support += 1;
  }
  const directional = support + conflicts;
  const agreementRatio = directional ? Number((support / directional).toFixed(2)) : 0;
  const strength =
    domains.size >= 3 && support >= 3 && agreementRatio >= 0.67
      ? "high"
      : domains.size >= 2 && support >= 2
        ? "medium"
        : "low";
  // ponytail: lexical stance heuristic; replace with claim-level evidence extraction when precision matters.
  return {
    independentDomains: domains.size,
    officialSources: results.filter((result) => isOfficial(result.domain)).length,
    agreementRatio,
    conflicts,
    strength,
  };
}
