package com.example.makoto.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.makoto.data.*
import com.example.makoto.ui.components.EvidenceBadges
import com.example.makoto.ui.components.SourceCard
import com.example.makoto.ui.components.VerdictBadge
import com.example.makoto.viewmodel.AnalysisUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalysisScreen(
    uiState: AnalysisUiState,
    inputText: String,
    action: String,
    onRetry: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val title = if (action == "claim") "Analyse Claim" else "Know Context"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = if (inputText.length > 200) inputText.take(200) + "..." else inputText,
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            Spacer(modifier = Modifier.height(16.dp))

            when (uiState) {
                is AnalysisUiState.Idle -> { /* Nothing */ }
                is AnalysisUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(uiState.statusMessage)
                        }
                    }
                }
                is AnalysisUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(uiState.message, color = MaterialTheme.colorScheme.error)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = onRetry) {
                                Text("Try Again")
                            }
                        }
                    }
                }
                is AnalysisUiState.Success -> {
                    val response = uiState.response
                    val analysis = response.analysis
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        if (action == "claim") {
                            item {
                                VerdictBadge(
                                    verdict = analysis.verdict,
                                    claimType = analysis.claimType
                                )
                            }
                        }
                        item {
                            EvidenceBadges(evidence = response.evidence)
                        }
                        item {
                            SectionHeader("Summary")
                            Text(analysis.summary)
                        }
                        if (analysis.reasoning != null) {
                            item {
                                SectionHeader("Reasoning")
                                Text(analysis.reasoning)
                            }
                        }
                        item {
                            SectionHeader("Background")
                            Text(analysis.background)
                        }
                        val videoContext = analysis.videoContext
                        if (videoContext != null && (
                            !videoContext.transcript.isNullOrBlank() ||
                            !videoContext.visualContext.isNullOrBlank() ||
                            !videoContext.onScreenText.isNullOrBlank()
                        )) {
                            item {
                                Card(
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text(
                                            text = "🎥 Reel Video Intelligence",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        if (!videoContext.transcript.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = "Audio Transcript",
                                                style = MaterialTheme.typography.labelLarge,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = videoContext.transcript,
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                        }
                                        if (!videoContext.visualContext.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = "Visual Context",
                                                style = MaterialTheme.typography.labelLarge,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = videoContext.visualContext,
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                        }
                                        if (!videoContext.onScreenText.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = "On-Screen Text",
                                                style = MaterialTheme.typography.labelLarge,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = videoContext.onScreenText,
                                                style = MaterialTheme.typography.bodyMedium
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        if (!analysis.claims.isNullOrEmpty()) {
                            item {
                                SectionHeader("Claims")
                                analysis.claims.forEachIndexed { index, claim ->
                                    Text("${index + 1}. $claim")
                                }
                            }
                        }
                        if (response.search.results.isNotEmpty()) {
                            item {
                                SectionHeader("Sources")
                            }
                            items(response.search.results) { source ->
                                SourceCard(
                                    source = source,
                                    onClick = {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(source.url))
                                        context.startActivity(intent)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
    )
}
