package com.example.makoto.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.makoto.data.*

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EvidenceBadges(evidence: EvidenceSummary, modifier: Modifier = Modifier) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        val strengthColor = when (evidence.strength.lowercase()) {
            "high" -> Color(0xFF4CAF50)
            "medium" -> Color(0xFFFFC107)
            "low" -> Color(0xFFF44336)
            else -> MaterialTheme.colorScheme.onSurfaceVariant
        }
        AssistChip(
            onClick = { },
            label = { Text("Strength: ${evidence.strength}") },
            colors = AssistChipDefaults.assistChipColors(labelColor = strengthColor)
        )
        AssistChip(onClick = { }, label = { Text("${evidence.independentDomains} domains") })
        AssistChip(onClick = { }, label = { Text("${evidence.officialSources} official") })
        AssistChip(onClick = { }, label = { Text("${(evidence.agreementRatio * 100).toInt()}% agreement") })
        if (evidence.conflicts > 0) {
            AssistChip(
                onClick = { },
                label = { Text("${evidence.conflicts} conflicts") },
                colors = AssistChipDefaults.assistChipColors(labelColor = MaterialTheme.colorScheme.error)
            )
        }
    }
}
