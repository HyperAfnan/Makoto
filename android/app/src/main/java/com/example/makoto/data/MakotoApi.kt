package com.example.makoto.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

sealed class SseEvent {
    data class Status(val message: String) : SseEvent()
    data class Completed(val response: AnalysisResponse) : SseEvent()
    data class Error(val message: String) : SseEvent()
}

object MakotoApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun testConnection(baseUrl: String): Result<String> = withContext(Dispatchers.IO) {
        val formattedBaseUrl = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl
        val request = Request.Builder()
            .url("$formattedBaseUrl/health")
            .get()
            .build()

        try {
            val quickClient = client.newBuilder()
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .build()

            val response = quickClient.newCall(request).execute()
            if (response.isSuccessful) {
                Result.success("Connected successfully (${response.code} OK)")
            } else {
                Result.failure(IOException("Server returned HTTP ${response.code} ${response.message}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun analyze(baseUrl: String, action: String, request: AnalysisRequest): Flow<SseEvent> = flow {
        val requestJson = json.encodeToString(request)
        val requestBody = requestJson.toRequestBody("application/json".toMediaType())
        
        val formattedBaseUrl = if (baseUrl.endsWith("/")) baseUrl.dropLast(1) else baseUrl

        val httpRequest = Request.Builder()
            .url("$formattedBaseUrl/api/$action")
            .post(requestBody)
            .addHeader("Accept", "text/event-stream")
            .build()

        try {
            val response = withContext(Dispatchers.IO) {
                client.newCall(httpRequest).execute()
            }
            
            if (!response.isSuccessful) {
                emit(SseEvent.Error("HTTP Error: ${response.code} ${response.message}"))
                return@flow
            }

            val body = response.body
            if (body == null) {
                emit(SseEvent.Error("Empty response body"))
                return@flow
            }

            body.byteStream().bufferedReader().use { reader ->
                var eventType = ""
                var eventData = java.lang.StringBuilder()

                var line = reader.readLine()
                while (line != null) {
                    if (line.isEmpty()) {
                        // End of event
                        if (eventType.isNotEmpty() && eventData.isNotEmpty()) {
                            val dataString = eventData.toString()
                            when (eventType) {
                                "status" -> {
                                    try {
                                        val jsonElement = json.parseToJsonElement(dataString)
                                        val message = jsonElement.jsonObject["message"]?.jsonPrimitive?.content ?: dataString
                                        emit(SseEvent.Status(message))
                                    } catch (e: Exception) {
                                        emit(SseEvent.Status(dataString))
                                    }
                                }
                                "completed" -> {
                                    try {
                                        val analysisResponse = json.decodeFromString<AnalysisResponse>(dataString)
                                        emit(SseEvent.Completed(analysisResponse))
                                    } catch (e: Exception) {
                                        emit(SseEvent.Error("Failed to parse completion data: ${e.message}"))
                                    }
                                }
                                "error" -> {
                                    emit(SseEvent.Error(dataString))
                                }
                            }
                        }
                        eventType = ""
                        eventData.clear()
                    } else if (line.startsWith("event:")) {
                        eventType = line.substringAfter("event:").trim()
                    } else if (line.startsWith("data:")) {
                        val dataLine = line.substringAfter("data:").trim()
                        if (eventData.isNotEmpty()) {
                            eventData.append("\n")
                        }
                        eventData.append(dataLine)
                    }
                    line = reader.readLine()
                }
            }
        } catch (e: IOException) {
            emit(SseEvent.Error("Network error: ${e.message}"))
        } catch (e: Exception) {
            emit(SseEvent.Error("Unknown error: ${e.message}"))
        }
    }
}
