export type Action = "context" | "claim";

export type TweetContext = {
  selection: string;
  tweet: string;
  url: string;
  author: string;
  timestamp: string;
  platform: "x";
};

export type AnalysisRequest = TweetContext & { action: Action };

export type AnalysisResponse = {
  requestId: string;
  action: Action;
  status: "completed";
  message: string;
  input: TweetContext;
  search: SearchResponse;
  analysis: AnalysisResult;
};

export type ClaimType = "fact" | "opinion" | "prediction" | "question" | "mixed";
export type Verdict = "true" | "false" | "misleading" | "unverifiable";

export type AnalysisResult = {
  summary: string;
  background: string;
  related: string[];
  claimType?: ClaimType;
  claims?: string[];
  verdict?: Verdict;
  reasoning?: string;
};

export type SearchResult = {
  title: string;
  snippet: string;
  url: string;
  domain: string;
};

export type SearchResponse = {
  provider: string;
  queries: string[];
  rounds: number;
  results: SearchResult[];
  errors: string[];
  latencyMs: number;
};
