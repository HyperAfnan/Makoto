package com.example.makoto.data

import android.content.Context
import android.content.SharedPreferences

class SettingsStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("makoto_settings", Context.MODE_PRIVATE)

    var backendUrl: String
        get() = prefs.getString("backendUrl", "http://10.0.2.2:8787") ?: "http://10.0.2.2:8787"
        set(value) = prefs.edit().putString("backendUrl", value).apply()

    var searchProvider: String
        get() = prefs.getString("searchProvider", "brave") ?: "brave"
        set(value) = prefs.edit().putString("searchProvider", value).apply()

    var braveApiKey: String
        get() = prefs.getString("braveApiKey", "") ?: ""
        set(value) = prefs.edit().putString("braveApiKey", value).apply()

    var tavilyApiKey: String
        get() = prefs.getString("tavilyApiKey", "") ?: ""
        set(value) = prefs.edit().putString("tavilyApiKey", value).apply()

    var geminiApiKey: String
        get() = prefs.getString("geminiApiKey", "") ?: ""
        set(value) = prefs.edit().putString("geminiApiKey", value).apply()

    var geminiModel: String
        get() = prefs.getString("geminiModel", "gemini-2.0-flash") ?: "gemini-2.0-flash"
        set(value) = prefs.edit().putString("geminiModel", value).apply()

    var maxSources: Int
        get() = prefs.getInt("maxSources", 5)
        set(value) = prefs.edit().putInt("maxSources", value).apply()

    fun toApiSettings(): ApiSettings {
        return ApiSettings(
            searchProvider = searchProvider,
            braveApiKey = braveApiKey.takeIf { it.isNotBlank() },
            tavilyApiKey = tavilyApiKey.takeIf { it.isNotBlank() },
            geminiApiKey = geminiApiKey.takeIf { it.isNotBlank() },
            geminiModel = geminiModel.takeIf { it.isNotBlank() },
            maxSources = maxSources
        )
    }
}
