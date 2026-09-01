package com.example.makoto.data

import kotlinx.serialization.Serializable

@Serializable
data class AnalysisRequest(
    val selection: String,
    val tweet: String,
    val url: String,
    val author: String,
    val timestamp: String,
    val platform: String = "x",
    val action: String, // "context" or "claim"
    val settings: ApiSettings? = null
)

@Serializable
data class ApiSettings(
    val searchProvider: String, // "brave" or "tavily"
    val braveApiKey: String? = null,
    val tavilyApiKey: String? = null,
    val geminiApiKey: String? = null,
    val geminiModel: String? = null,
    val maxSources: Int? = null
)

@Serializable
data class AnalysisResponse(
    val requestId: String,
    val action: String,
    val status: String,
    val message: String,
    val input: TweetInput,
    val search: SearchResponse,
    val analysis: AnalysisResult,
    val evidence: EvidenceSummary
)

@Serializable
data class TweetInput(
    val selection: String,
    val tweet: String,
    val url: String,
    val author: String,
    val timestamp: String,
    val platform: String
)

@Serializable
data class SearchResponse(
    val provider: String,
    val queries: List<String>,
    val rounds: Int,
    val results: List<SearchResult>,
    val errors: List<String>,
    val latencyMs: Long
)

@Serializable
data class SearchResult(
    val title: String,
    val snippet: String,
    val url: String,
    val domain: String
)

@Serializable
data class AnalysisResult(
    val summary: String,
    val background: String,
    val related: List<String>,
    val claimType: String? = null,
    val claims: List<String>? = null,
    val verdict: String? = null,
    val reasoning: String? = null
)

@Serializable
data class EvidenceSummary(
    val independentDomains: Int,
    val officialSources: Int,
    val agreementRatio: Double,
    val conflicts: Int,
    val strength: String // "high", "medium", "low"
)
