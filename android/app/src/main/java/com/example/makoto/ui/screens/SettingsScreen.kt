package com.example.makoto.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.makoto.data.MakotoApi
import com.example.makoto.data.SettingsStore
import kotlinx.coroutines.launch

sealed interface ConnectionStatus {
    data object Idle : ConnectionStatus
    data object Testing : ConnectionStatus
    data class Success(val message: String) : ConnectionStatus
    data class Error(val message: String) : ConnectionStatus
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settingsStore: SettingsStore,
    onBack: () -> Unit
) {
    val scrollState = rememberScrollState()
    val coroutineScope = rememberCoroutineScope()

    var backendUrl by remember { mutableStateOf(settingsStore.backendUrl) }
    var searchProvider by remember { mutableStateOf(settingsStore.searchProvider) }
    var braveKey by remember { mutableStateOf(settingsStore.braveApiKey) }
    var tavilyKey by remember { mutableStateOf(settingsStore.tavilyApiKey) }
    var geminiKey by remember { mutableStateOf(settingsStore.geminiApiKey) }
    var geminiModel by remember { mutableStateOf(settingsStore.geminiModel) }
    var maxSources by remember { mutableFloatStateOf(settingsStore.maxSources.toFloat()) }

    var connectionStatus by remember { mutableStateOf<ConnectionStatus>(ConnectionStatus.Idle) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
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
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = backendUrl,
                onValueChange = {
                    backendUrl = it
                    connectionStatus = ConnectionStatus.Idle
                },
                label = { Text("Backend URL") },
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedButton(
                    onClick = {
                        if (backendUrl.isNotBlank()) {
                            connectionStatus = ConnectionStatus.Testing
                            coroutineScope.launch {
                                val result = MakotoApi.testConnection(backendUrl)
                                connectionStatus = result.fold(
                                    onSuccess = { ConnectionStatus.Success(it) },
                                    onFailure = { ConnectionStatus.Error(it.message ?: "Connection failed") }
                                )
                            }
                        }
                    },
                    enabled = backendUrl.isNotBlank() && connectionStatus !is ConnectionStatus.Testing
                ) {
                    if (connectionStatus is ConnectionStatus.Testing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Testing...")
                    } else {
                        Text("Test Connection")
                    }
                }
            }

            when (val status = connectionStatus) {
                is ConnectionStatus.Success -> {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Color(0xFF4CAF50),
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = status.message,
                            color = Color(0xFF2E7D32),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
                is ConnectionStatus.Error -> {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = status.message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
                else -> {}
            }

            var expandedProvider by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = expandedProvider,
                onExpandedChange = { expandedProvider = it }
            ) {
                OutlinedTextField(
                    value = searchProvider,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Search Provider") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedProvider) },
                    modifier = Modifier.menuAnchor().fillMaxWidth()
                )
                ExposedDropdownMenu(
                    expanded = expandedProvider,
                    onDismissRequest = { expandedProvider = false }
                ) {
                    DropdownMenuItem(text = { Text("brave") }, onClick = { searchProvider = "brave"; expandedProvider = false })
                    DropdownMenuItem(text = { Text("tavily") }, onClick = { searchProvider = "tavily"; expandedProvider = false })
                }
            }

            OutlinedTextField(
                value = braveKey,
                onValueChange = { braveKey = it },
                label = { Text("Brave API Key") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = tavilyKey,
                onValueChange = { tavilyKey = it },
                label = { Text("Tavily API Key") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = geminiKey,
                onValueChange = { geminiKey = it },
                label = { Text("Gemini API Key") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )

            var expandedModel by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = expandedModel,
                onExpandedChange = { expandedModel = it }
            ) {
                OutlinedTextField(
                    value = geminiModel,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Gemini Model") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedModel) },
                    modifier = Modifier.menuAnchor().fillMaxWidth()
                )
                ExposedDropdownMenu(
                    expanded = expandedModel,
                    onDismissRequest = { expandedModel = false }
                ) {
                    DropdownMenuItem(text = { Text("gemini-2.0-flash") }, onClick = { geminiModel = "gemini-2.0-flash"; expandedModel = false })
                    DropdownMenuItem(text = { Text("gemini-2.5-flash") }, onClick = { geminiModel = "gemini-2.5-flash"; expandedModel = false })
                }
            }

            Text("Max Sources: ${maxSources.toInt()}")
            Slider(
                value = maxSources,
                onValueChange = { maxSources = it },
                valueRange = 1f..20f,
                steps = 18
            )

            Button(
                onClick = {
                    settingsStore.backendUrl = backendUrl
                    settingsStore.searchProvider = searchProvider
                    settingsStore.braveApiKey = braveKey
                    settingsStore.tavilyApiKey = tavilyKey
                    settingsStore.geminiApiKey = geminiKey
                    settingsStore.geminiModel = geminiModel
                    settingsStore.maxSources = maxSources.toInt()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Save Settings")
            }
        }
    }
}
