package com.example.makoto.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.makoto.data.AnalysisRequest
import com.example.makoto.data.AnalysisResponse
import com.example.makoto.data.MakotoApi
import com.example.makoto.data.SettingsStore
import com.example.makoto.data.SseEvent
import com.example.makoto.utils.UrlUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant

/** UI state for the analysis screen. */
sealed interface AnalysisUiState {
    data object Idle : AnalysisUiState
    data class Loading(val statusMessage: String) : AnalysisUiState
    data class Success(val response: AnalysisResponse) : AnalysisUiState
    data class Error(val message: String) : AnalysisUiState
}

class AnalysisViewModel(
    private val settingsStore: SettingsStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow<AnalysisUiState>(AnalysisUiState.Idle)
    val uiState: StateFlow<AnalysisUiState> = _uiState.asStateFlow()

    private var currentText: String = ""
    private var currentAction: String = "context"

    fun start(text: String, action: String) {
        currentText = text
        currentAction = action
        analyze()
    }

    fun retry() {
        analyze()
    }

    private fun analyze() {
        val text = currentText
        val action = currentAction
        if (text.isBlank()) {
            _uiState.value = AnalysisUiState.Error("No text provided.")
            return
        }

        _uiState.value = AnalysisUiState.Loading("Connecting...")

        val baseUrl = settingsStore.backendUrl.trimEnd('/')
        val settings = settingsStore.toApiSettings()
        val instagramUrl = UrlUtils.findInstagramUrl(text)
        val platform = if (instagramUrl != null) "instagram" else "x"
        val requestUrl = instagramUrl ?: (UrlUtils.extractUrl(text) ?: "https://x.com/selection")

        val request = AnalysisRequest(
            selection = (instagramUrl ?: text).take(2000),
            tweet = text.take(5000),
            url = requestUrl,
            author = "",
            timestamp = Instant.now().toString(),
            platform = platform,
            action = action,
            settings = settings,
        )

        viewModelScope.launch {
            try {
                MakotoApi.analyze(baseUrl, action, request).collect { event ->
                    when (event) {
                        is SseEvent.Status -> {
                            _uiState.value = AnalysisUiState.Loading(event.message)
                        }
                        is SseEvent.Completed -> {
                            _uiState.value = AnalysisUiState.Success(event.response)
                        }
                        is SseEvent.Error -> {
                            _uiState.value = AnalysisUiState.Error(event.message)
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.value = AnalysisUiState.Error(
                    e.message ?: "An unexpected error occurred."
                )
            }
        }
    }
}
