package com.example.makoto

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.makoto.theme.MakotoTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val (text, action) = extractIntentData(intent)

        setContent {
            MakotoTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    MainNavigation(
                        initialText = text,
                        initialAction = action,
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Re-create the content when a new intent arrives while the activity is already running.
        val (text, action) = extractIntentData(intent)
        if (!text.isNullOrBlank()) {
            setContent {
                MakotoTheme {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background,
                    ) {
                        MainNavigation(
                            initialText = text,
                            initialAction = action,
                        )
                    }
                }
            }
        }
    }

    /**
     * Extract text and action from various intent sources:
     * - ACTION_SEND (share intent): text from EXTRA_TEXT, action is null (user picks)
     * - Forwarded from ProcessText activities: text + action from our custom extras
     * - Launcher: both null
     */
    private fun extractIntentData(intent: Intent?): Pair<String?, String?> {
        if (intent == null) return null to null

        // Forwarded from ProcessText activities
        val forwardedText = intent.getStringExtra(EXTRA_TEXT)
        val forwardedAction = intent.getStringExtra(EXTRA_ACTION)
        if (!forwardedText.isNullOrBlank() && !forwardedAction.isNullOrBlank()) {
            return forwardedText to forwardedAction
        }

        // Share intent (ACTION_SEND)
        if (intent.action == Intent.ACTION_SEND && intent.type == "text/plain") {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            // Action will be null — the user will pick via the share action chooser in the UI
            return sharedText to null
        }

        return null to null
    }

    companion object {
        const val EXTRA_TEXT = "com.example.makoto.EXTRA_TEXT"
        const val EXTRA_ACTION = "com.example.makoto.EXTRA_ACTION"
    }
}
