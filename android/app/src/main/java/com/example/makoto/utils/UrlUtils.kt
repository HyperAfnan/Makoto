package com.example.makoto.utils

import java.util.regex.Pattern

object UrlUtils {
    // Regex matching Instagram Reels, Posts, and Share URLs
    private val INSTAGRAM_PATTERN = Pattern.compile(
        "https?://(?:www\\.)?(?:instagram\\.com|instagr\\.am)/(?:reel|reels|p|share/reel)/[A-Za-z0-9_.-]+/?(?:\\?[^\\s]*)?",
        Pattern.CASE_INSENSITIVE
    )

    // Regex matching generic HTTP/HTTPS URLs
    private val GENERIC_URL_PATTERN = Pattern.compile(
        "https?://[^\\s]+",
        Pattern.CASE_INSENSITIVE
    )

    /**
     * Finds and returns the first Instagram Reel/Post URL present in [text], or null if none found.
     */
    fun findInstagramUrl(text: String?): String? {
        if (text.isNullOrBlank()) return null
        val matcher = INSTAGRAM_PATTERN.matcher(text)
        return if (matcher.find()) matcher.group(0) else null
    }

    /**
     * Checks if the given [text] contains an Instagram Reel/Post URL.
     */
    fun isInstagramUrl(text: String?): Boolean {
        return findInstagramUrl(text) != null
    }

    /**
     * Finds and returns the first HTTP/HTTPS URL present in [text], or null if none found.
     */
    fun extractUrl(text: String?): String? {
        if (text.isNullOrBlank()) return null
        val matcher = GENERIC_URL_PATTERN.matcher(text)
        return if (matcher.find()) matcher.group(0) else null
    }
}
