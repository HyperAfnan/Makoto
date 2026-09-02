package com.example.makoto

import com.example.makoto.utils.UrlUtils
import org.junit.Assert.*
import org.junit.Test

class UrlUtilsTest {

    @Test
    fun testFindInstagramReelUrl() {
        val input = "Check out this reel https://www.instagram.com/reel/C-xyz123/?igsh=MWQ1ZGUxMzBkMA== it is crazy"
        val expected = "https://www.instagram.com/reel/C-xyz123/?igsh=MWQ1ZGUxMzBkMA=="
        assertEquals(expected, UrlUtils.findInstagramUrl(input))
        assertTrue(UrlUtils.isInstagramUrl(input))
    }

    @Test
    fun testFindInstagramPostUrl() {
        val input = "https://instagram.com/p/DB12345/"
        val expected = "https://instagram.com/p/DB12345/"
        assertEquals(expected, UrlUtils.findInstagramUrl(input))
        assertTrue(UrlUtils.isInstagramUrl(input))
    }

    @Test
    fun testFindInstagramShortUrl() {
        val input = "Look at this https://instagr.am/reel/ABC-123_xyz/"
        val expected = "https://instagr.am/reel/ABC-123_xyz/"
        assertEquals(expected, UrlUtils.findInstagramUrl(input))
        assertTrue(UrlUtils.isInstagramUrl(input))
    }

    @Test
    fun testFindInstagramShareReelUrl() {
        val input = "https://www.instagram.com/share/reel/C987654321"
        val expected = "https://www.instagram.com/share/reel/C987654321"
        assertEquals(expected, UrlUtils.findInstagramUrl(input))
        assertTrue(UrlUtils.isInstagramUrl(input))
    }

    @Test
    fun testNonInstagramText() {
        val input = "React is dying. Here is why..."
        assertNull(UrlUtils.findInstagramUrl(input))
        assertFalse(UrlUtils.isInstagramUrl(input))
    }

    @Test
    fun testGenericUrlExtraction() {
        val input = "Read this article https://example.com/news/123 for context"
        assertEquals("https://example.com/news/123", UrlUtils.extractUrl(input))
    }
}
