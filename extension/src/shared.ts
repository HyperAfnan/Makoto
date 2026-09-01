export type Action = "context" | "claim";

export type TweetContext = {
	selection: string;
	tweet: string;
	url: string;
	author: string;
	timestamp: string;
	platform: "x" | "instagram";
	images?: string[];
};

export type ApiSettings = {
	searchProvider?: "google" | "brave" | "tavily";
	braveApiKey?: string;
	tavilyApiKey?: string;
	geminiApiKey?: string;
	geminiModel?: string;
	apifyApiKey?: string;
	maxSources?: number;
};

export type AnalysisRequest = TweetContext & { action: Action; settings?: ApiSettings };

export type AnalysisResponse = {
	requestId: string;
	action: Action;
	status: "completed";
	message: string;
	input: TweetContext;
	search: SearchResponse;
	analysis: AnalysisResult;
	evidence: EvidenceSummary;
};

export type EvidenceSummary = {
	independentDomains: number;
	officialSources: number;
	agreementRatio: number;
	conflicts: number;
	strength: "high" | "medium" | "low";
};

export type ClaimType = "fact" | "opinion" | "prediction" | "question" | "mixed";
export type Verdict = "true" | "false" | "misleading" | "unverifiable";

export type VideoContext = {
	transcript?: string;
	visualContext?: string;
	onScreenText?: string;
	claims?: string[];
};

export type AnalysisResult = {
	summary: string;
	background: string;
	related: string[];
	claimType?: ClaimType;
	claims?: string[];
	verdict?: Verdict;
	reasoning?: string;
	videoContext?: VideoContext;
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
