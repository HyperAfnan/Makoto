package com.example.makoto

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable data object Home : NavKey

@Serializable data class Analysis(
    val text: String,
    val action: String, // "context" or "claim"
) : NavKey

@Serializable data object Settings : NavKey
