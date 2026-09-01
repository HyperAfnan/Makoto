package com.example.makoto

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

/**
 * Transparent activity triggered from the text selection toolbar for "Know Context".
 * Extracts the selected text and forwards it to MainActivity with action = "context".
 */
class ProcessTextContextActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val selectedText = intent?.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
        if (!selectedText.isNullOrBlank()) {
            val forward = Intent(this, MainActivity::class.java).apply {
                putExtra(MainActivity.EXTRA_TEXT, selectedText)
                putExtra(MainActivity.EXTRA_ACTION, "context")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(forward)
        }
        finish()
    }
}
