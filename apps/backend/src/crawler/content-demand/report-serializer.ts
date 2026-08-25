/**
 * Master Content & Search Demand Intelligence Report Serializer.
 * Formats first-party demand, clustering, content decisions, cannibalization, and trends into an actionable Markdown report.
 * Explicitly surfaces all 16 user-visible evidence and governance fields.
 */

import { ContentDemandIntelligenceReport } from "./types";
import { buildStableActionId } from "../opportunity/deduplicator";

export function serializeContentDemandReportMarkdown(report: ContentDemandIntelligenceReport): string {
  const s = report.summary;
  const policy = report.policyUsed;

  let md = `# CONTENT & SEARCH DEMAND INTELLIGENCE

**Generated:** ${report.generatedAt}  
**Project:** \`${report.projectId}\`  
**Evaluated Period:** \`${report.periodRange}\` (Data Quality: \`${report.dataQuality}\`, Retrieval: \`${report.retrievalStatus}\`)  
**Policy Used:** \`${policy.policyName}\` (\`${policy.clusteringAlgorithmVersion}\`)  
**Total Evaluated Queries:** **${s.totalEvaluatedQueries}** across **${s.totalClusters} query clusters**  
**Total Observed GSC Demand:** **${s.totalObservedImpressions.toLocaleString()} impressions** (${s.totalClicks.toLocaleString()} clicks)

---

## 1. Demand & Content Decision Summary

| Metric / Dimension | Value | Strategic Implication |
|---|---|---|
| **Total Query Clusters** | **${s.totalClusters}** | Consolidated topic demand groups |
| **Branded Demand** | **${s.brandedClustersCount} clusters** | Core brand navigation & reputation queries |
| **Non-Branded Demand** | **${s.nonBrandedClustersCount} clusters** | Non-branded commercial & informational intent |
| **🛠️ Improve Existing Pages** | **${s.improveExistingCount}** | Existing relevant URLs requiring topic expansion |
| **✨ New Page Candidates** | **${s.createNewCandidateCount}** | Distinct search intent with zero dedicated coverage |
| **⚠️ Cannibalization Risks** | **${s.cannibalizationCandidatesCount}** | Multiple URLs competing for identical intent |
| **🚀 Emerging Demand Clusters** | **${s.emergingDemandCount}** | Fast-growing or newly observed search topics |
| **❓ Question-Form Demand** | **${s.questionDemandCount}** | High-intent question queries (GEO/AEO answer targets) |

---

`;

  // 2. Existing Pages to Improve
  const improveAssessments = report.coverageAssessments.filter((c) => c.decision === "IMPROVE_EXISTING_PAGE");
  if (improveAssessments.length > 0) {
    md += `## 2. 🛠️ Existing Pages to Improve (Prioritize over creating new pages)\n\n`;
    for (const item of improveAssessments) {
      const clusterObj = report.queryClusters.find((q) => q.clusterId === item.clusterId);
      const actionId = buildStableActionId("IMPROVE_PAGE", item.clusterId, item.dominantLandingPage || "page");

      md += `### ${item.representativeLabel}\n`;
      md += `- **Cluster ID:** \`${item.clusterId}\` (Algorithm: \`${policy.clusteringAlgorithmVersion}\`)\n`;
      md += `- **Phase 11 Action ID:** \`${actionId}\`\n`;
      md += `- **Raw Query Examples:** ${(clusterObj?.rawQueries || [item.representativeLabel]).slice(0, 3).map((q) => `"${q}"`).join(", ")}\n`;
      md += `- **Primary Landing Page:** [${item.dominantLandingPage}](${item.dominantLandingPage})\n`;
      md += `- **Landing Page Fit:** \`${item.landingPageFit}\` (Confidence: \`${item.landingPageFitConfidence}\`)\n`;
      md += `- **Query/Page Stability:** \`${item.queryPageStability}\`\n`;
      md += `- **Coverage State:** \`${item.coverageState}\` | **Decision:** \`${item.decision}\` (Confidence: \`${item.confidence}\`)\n`;
      md += `- **Observed GSC Impressions:** **${item.observedImpressions.toLocaleString()}** (Period: \`${report.periodRange}\`)\n`;
      md += `- **Why:** ${item.decisionRationale}\n`;
      if (item.missingTopicAreas && item.missingTopicAreas.length > 0) {
        md += `- **Recommended Topic Expansions:** ${item.missingTopicAreas.map((t) => `\`${t}\``).join(", ")} *(Provenance: GSC query modifiers & cluster tokens)*\n`;
      }
      if (item.technicalBlockers && item.technicalBlockers.length > 0) {
        md += `- 🔒 **Technical Blockers:** ${item.technicalBlockers.map((b) => `\`${b}\``).join(", ")} *(Upstream technical fix required first)*\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  }

  // 3. New Page Candidates
  const newPageAssessments = report.coverageAssessments.filter(
    (c) => c.decision === "CREATE_NEW_PAGE_CANDIDATE" || c.decision === "VALIDATION_REQUIRED"
  );
  if (newPageAssessments.length > 0) {
    md += `## 3. ✨ New Page Candidates (Justified by observed demand)\n\n`;
    for (const item of newPageAssessments) {
      const clusterObj = report.queryClusters.find((q) => q.clusterId === item.clusterId);
      const actionId = buildStableActionId("NEW_PAGE", item.clusterId, item.representativeLabel);

      md += `### ${item.representativeLabel}\n`;
      md += `- **Cluster ID:** \`${item.clusterId}\`\n`;
      md += `- **Phase 11 Action ID:** \`${actionId}\`\n`;
      md += `- **Raw Query Examples:** ${(clusterObj?.rawQueries || [item.representativeLabel]).slice(0, 3).map((q) => `"${q}"`).join(", ")}\n`;
      md += `- **Intent:** \`${item.primaryIntent}\` (Confidence: \`${clusterObj?.intentConfidence || "HIGH_CONFIDENCE"}\`)\n`;
      md += `- **Current Suboptimal Page:** \`${item.dominantLandingPage || "None"}\` (Fit: \`${item.landingPageFit}\`, Confidence: \`${item.landingPageFitConfidence}\`)\n`;
      md += `- **Query/Page Stability:** \`${item.queryPageStability}\`\n`;
      md += `- **Coverage State:** \`${item.coverageState}\` | **Decision:** \`${item.decision}\` (Confidence: \`${item.confidence}\`)\n`;
      md += `- **Observed First-Party Demand:** **${item.observedImpressions.toLocaleString()} impressions** (Period: \`${report.periodRange}\`)\n`;
      md += `- **Strategic Justification:** ${item.decisionRationale}\n`;
      md += `- **Business Relevance Validated:** \`${item.isBusinessRelevanceValidated}\`\n\n`;
    }
    md += `---\n\n`;
  }

  // 4. Cannibalization Candidates
  if (report.cannibalizationAssessments.length > 0) {
    md += `## 4. ⚠️ Query Cannibalization & Intent Overlap\n\n`;
    for (const can of report.cannibalizationAssessments) {
      const actionId = buildStableActionId("CANNIBALIZATION", can.clusterId, can.competingUrls[0] || "site");

      md += `### ${can.representativeLabel} [${can.state}]\n`;
      md += `- **Cluster ID:** \`${can.clusterId}\`\n`;
      md += `- **Phase 11 Action ID:** \`${actionId}\`\n`;
      md += `- **Competing URLs:** ${can.competingUrls.map((u) => `\`${u}\``).join(", ")}\n`;
      md += `- **Intent Similarity:** \`${can.intentSimilarity}\` | **Content Overlap:** \`${can.contentOverlap}\`\n`;
      md += `- **Remediation Recommendation:** \`${can.remediationRecommendation}\` (${can.remediationDetails})\n`;
      if (can.protectAgainstMergingNote) {
        md += `- 🛡️ **Protection Note:** ${can.protectAgainstMergingNote}\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  }

  // 5. Emerging & Trend Topics
  const emerging = report.trendAssessments.filter((t) => t.trendState === "EMERGING_DEMAND" || t.trendState === "GROWING_DEMAND");
  if (emerging.length > 0) {
    md += `## 5. 🚀 Emerging & Growing Search Demand\n\n`;
    for (const t of emerging) {
      md += `- **${t.representativeLabel}** (\`${t.trendState}\`): ${t.rationale}\n`;
    }
    md += `\n---\n\n`;
  }

  // 6. Data Limitations & Governance
  md += `## 6. ℹ️ Data Limitations & Governance\n\n`;
  for (const lim of report.dataLimitations) {
    md += `- ${lim}\n`;
  }

  return md;
}
