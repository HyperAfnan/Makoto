package com.example.makoto

import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.makoto.data.SettingsStore
import com.example.makoto.ui.screens.AnalysisScreen
import com.example.makoto.ui.screens.HomeScreen
import com.example.makoto.ui.screens.SettingsScreen
import com.example.makoto.viewmodel.AnalysisViewModel

@Composable
fun MainNavigation(
    initialText: String? = null,
    initialAction: String? = null,
) {
    val context = LocalContext.current
    val settingsStore = SettingsStore(context)

    // If we received both text + action (from PROCESS_TEXT), go straight to analysis.
    // If text only (from share intent), go to Home pre-filled so user can pick action.
    // Otherwise, go to Home.
    val startKey: NavKey = if (!initialText.isNullOrBlank() && !initialAction.isNullOrBlank()) {
        Analysis(text = initialText, action = initialAction)
    } else {
        Home
    }

    val backStack = rememberNavBackStack(startKey)

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<Home> {
                HomeScreen(
                    onAnalyze = { text, action ->
                        backStack.add(Analysis(text = text, action = action))
                    },
                    onOpenSettings = {
                        backStack.add(Settings)
                    },
                    // Pass shared text so it's pre-filled on the home screen
                    initialText = if (initialAction.isNullOrBlank()) initialText else null,
                    modifier = Modifier.safeDrawingPadding(),
                )
            }
            entry<Analysis> { key ->
                val vm: AnalysisViewModel = viewModel {
                    AnalysisViewModel(settingsStore).also { it.start(key.text, key.action) }
                }
                val uiState by vm.uiState.collectAsStateWithLifecycle()
                AnalysisScreen(
                    uiState = uiState,
                    inputText = key.text,
                    action = key.action,
                    onRetry = { vm.retry() },
                    onBack = { backStack.removeLastOrNull() },
                )
            }
            entry<Settings> {
                SettingsScreen(
                    settingsStore = settingsStore,
                    onBack = { backStack.removeLastOrNull() },
                )
            }
        },
    )
}
