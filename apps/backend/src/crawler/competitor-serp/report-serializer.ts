/**
 * Hardened Competitor & SERP Intelligence Report Serializer.
 * Surfaces all 22 evidence dimensions with sample-size transparency,
 * policy alignment, topic provenance, and governance limitations.
 */

import { CompetitorSerpIntelligenceReport } from "./types";

export function serializeCompetitorSerpReportMarkdown(report: CompetitorSerpIntelligenceReport): string {
  let md = `# COMPETITOR & SERP INTELLIGENCE

**Generated:** ${report.generatedAt}  
**Project:** \`${report.projectId}\`  
**Provider:** \`${report.provider}\` (Version: \`${report.providerVersion}\` | State: \`${report.providerImplementationState}\` | Status: \`${report.providerStatus}\`)  
**Locale / Device Context:** \`${report.country.toUpperCase()} / ${report.language} / ${report.device}\`  
**Tracked Query Demand:** **${report.totalTrackedClusters}** Query Clusters (**${report.totalSnapshots}** SERP Snapshots evaluated)  
**Applied Discovery Policy:** \`${report.appliedCompetitorPolicy.policyName}\` (Min Appearances: **${report.appliedCompetitorPolicy.minClusterAppearances}**, Min Cluster Share: **${Math.round(report.appliedCompetitorPolicy.minClusterShareRatio * 100)}%**, Min Top-10: **${report.appliedCompetitorPolicy.minTop10Appearances}**)

---

## 1. Executive Summary & Landscape Dimensions

| Metric / Dimension | Value | Strategic Meaning |
|---|---|---|
| **Discovered Search Competitors** | **${report.searchCompetitors.length} domains** | Consistently visible across tracked search demand under active policy |
| **SERP Feature Opportunities** | **${report.serpFeatureOpportunities.length} opportunities** | Advisory PAA, Snippet, and Local Pack targets with strict provenance |
| **Topic Gap Opportunities** | **${report.topicComparisons.reduce((acc, t) => acc + t.serpCoverageGaps.length, 0)} subtopics** | Consistently addressed by analyzed ranking competitors |
| **Own Differentiation Signals** | **${report.topicComparisons.reduce((acc, t) => acc + t.ownDifferentiationSignals.length, 0)} topics** | Unique proprietary coverage on own site |
| **SERP Landscape Volatility** | \`${report.serpVolatilityAssessment.volatilityState}\` | ${report.serpVolatilityAssessment.rationale} (${report.serpVolatilityAssessment.observationCount} observations) |

---

## 2. 🔍 Search Competitors vs Configured Business Competitors

`;

  if (report.searchCompetitors.length === 0) {
    md += `*No domains met the search competitor qualification threshold under ${report.appliedCompetitorPolicy.policyName}.*\n\n`;
  } else {
    for (const comp of report.searchCompetitors) {
      md += `### ${comp.rootDomain} [\`${comp.relationship}\`]\n`;
      md += `- **Search Overlap:** Observed in **${comp.trackedClustersAppearedIn} of ${comp.totalTrackedClusters}** tracked query clusters (**${Math.round(comp.clusterShareRatio * 100)}%** cluster share | **${comp.top10Appearances}** Top-10 rankings)\n`;
      md += `- **Average Position:** #${comp.averageObservedPosition} (Confidence: \`${comp.confidence}\` | Evidence Points: ${comp.evidenceCount})\n`;
      md += `- **Primary Result Types:** ${comp.primaryResultTypes.map((t) => `\`${t}\``).join(", ") || "None"}\n`;
      md += `- **Strategic Interpretation:** ${comp.interpretationNote}\n\n`;
    }
  }

  md += `---\n\n## 3. 📊 SERP Intent & Result-Type Landscape\n\n`;

  for (const item of report.serpIntentAssessments) {
    const id = item.intentDistribution;
    const rd = item.resultTypeDistribution;

    md += `### Query Cluster: ${item.representativeLabel} (\`${item.clusterId}\`)\n`;
    md += `- **Observed Dominant SERP Intent:** \`${id.dominantIntentState}\` (\`${id.dominantIntent}\`, ${Math.round(id.dominanceRatio * 100)}% dominance across ${id.sampleSize} results | Confidence: \`${id.confidence}\`)\n`;
    md += `- **Result-Type Distribution (${rd.sampleSize} results):** ${Object.entries(rd.typeCounts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => `\`${type}\`: ${count}`)
      .join(", ")}\n`;
    md += `- **Own Domain Visibility:** \`${item.ownVisibilityState}\`\n`;

    if (id.intentDisagreementWithPhase12) {
      md += `- ⚠️ **Intent Alignment Review:** ${id.intentDisagreementWithPhase12.rationale}\n`;
    }
    if (rd.formatMismatchCandidate) {
      md += `- 💡 **Page Format Insight:** ${rd.formatMismatchCandidate.rationale}\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 4. 📝 Topic Coverage & Differentiation Analysis\n\n`;

  for (const item of report.topicComparisons) {
    md += `### Topics for '${item.representativeLabel}' (\`${item.clusterId}\`)\n`;

    if (item.serpCoverageGaps.length > 0) {
      md += `- 🎯 **SERP-Supported Topic Gaps (Common on Competitor Pages):**\n`;
      for (const gap of item.serpCoverageGaps) {
        const tObj = item.topics.find((t) => t.topic === gap);
        md += `  - **${gap}** [\`${tObj?.observationState}\`] (Observed on **${tObj?.competitorPrevalenceFraction || "0 of 0"}** analyzed competitors) *(Provenance: Snapshot \`${tObj?.provenance.sourceSerpSnapshotIds.join(", ")}\`)*\n`;
      }
    }

    if (item.ownDifferentiationSignals.length > 0) {
      md += `- 🛡️ **Own Differentiation Signals (Unique to Own Site):**\n`;
      for (const diff of item.ownDifferentiationSignals) {
        md += `  - **${diff}** *(Covered on own site, not observed on analyzed competitor pages)*\n`;
      }
    }
    md += `\n`;
  }

  md += `---\n\n## 5. 💡 SERP Feature Opportunities (Advisory)\n\n`;

  if (report.serpFeatureOpportunities.length === 0) {
    md += `*No actionable SERP feature opportunities identified.*\n\n`;
  } else {
    for (const feat of report.serpFeatureOpportunities) {
      md += `### ${feat.opportunityName} on '${feat.representativeLabel}'\n`;
      md += `- **Feature Type:** \`${feat.featureType}\` | **Confidence:** \`${feat.confidence}\`\n`;
      md += `- **Guidance:** ${feat.advisoryNote}\n`;
      md += `- **Provenance:** Snapshot \`${feat.provenance.sourceSnapshotId}\`\n\n`;
    }
  }

  md += `---\n\n## 6. 📈 Position History & SERP Volatility\n\n`;

  if (report.positionHistory.length === 0) {
    md += `*Initial snapshot established. Subsequent runs will track relative position shifts.*\n\n`;
  } else {
    for (const pos of report.positionHistory) {
      md += `- **${pos.query}** ([${pos.url}]): \`${pos.state}\` — ${pos.rationale}\n`;
    }
  }

  md += `\n---\n\n## 7. ℹ️ Data Limitations & Governance Principles\n\n`;

  for (const lim of report.governanceLimitations) {
    md += `- ${lim}\n`;
  }

  return md;
}
