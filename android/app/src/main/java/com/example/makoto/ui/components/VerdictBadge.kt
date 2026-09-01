package com.example.makoto.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun VerdictBadge(verdict: String?, claimType: String?, modifier: Modifier = Modifier) {
    if (verdict == null) return

    val containerColor = when (verdict.lowercase()) {
        "true" -> Color(0xFFE8F5E9)
        "false" -> Color(0xFFFFEBEE)
        "misleading" -> Color(0xFFFFF8E1)
        else -> Color(0xFFF5F5F5) // unverifiable or other
    }

    val contentColor = when (verdict.lowercase()) {
        "true" -> Color(0xFF2E7D32)
        "false" -> Color(0xFFC62828)
        "misleading" -> Color(0xFFF9A825)
        else -> Color(0xFF616161)
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = containerColor, contentColor = contentColor),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = verdict.uppercase(),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            if (claimType != null) {
                Text(
                    text = "Claim type: $claimType",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
