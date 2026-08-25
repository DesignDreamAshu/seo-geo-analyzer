/**
 * Content Lifecycle, Decay, Refresh & Consolidation Report Serializer.
 * Serializes multi-window lifecycle assessments, equity breakdowns, and exact evidence-backed briefs into Markdown.
 */

import { ContentLifecycleReport } from "./types";

export function serializeContentLifecycleReportMarkdown(report: ContentLifecycleReport): string {
  const lines: string[] = [];

  lines.push("# 🔄 CONTENT LIFECYCLE, DECAY & CONSOLIDATION INTELLIGENCE REPORT\n");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Project:** \`${report.projectId}\``);
  lines.push(`**Model Version:** \`${report.modelVersion}\` | **Policy Version:** \`${report.policyVersion}\`\n`);
  lines.push("---\n");

  // 1. Executive Summary & Inventory Distribution
  const inv = report.inventorySummary;
  lines.push("## 1. 📊 Executive Summary & Lifecycle Inventory Distribution\n");
  lines.push(`- **Total URLs Evaluated:** ${inv.totalEvaluatedUrls}`);
  lines.push(`- **Healthy / Stable Pages:** ${inv.healthyUrlsCount + inv.growingUrlsCount}`);
  lines.push(`- **Confirmed Content Decay (Refresh/Expand Candidates):** ${inv.decayedUrlsCount}`);
  lines.push(`- **Non-Content Declines (Seasonality / Demand / Technical / Indexation):** ${inv.seasonalDeclineCount + inv.demandDeclineCount + inv.technicalDeclineCount + inv.indexationDeclineCount}`);
  lines.push(`- **Consolidation & Merge Opportunities:** ${inv.consolidationCandidatesCount}`);
  lines.push(`- **Retirement Review Candidates:** ${inv.retirementReviewsCount}`);
  lines.push(`- **Compliance Protected Pages (Retirement Suppressed):** ${inv.complianceProtectedCount}\n`);

  // 2. Lifecycle Inventory Overview Table
  lines.push("## 2. 🗂️ Content Lifecycle Inventory Overview\n");
  lines.push("| URL | Page Type | Lifecycle State | Trend Shape | Primary Action | Change Risk | Confidence | Policy Source |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const a of report.assessments.slice(0, 15)) {
    lines.push(
      `| \`${a.url}\` | \`${a.pageType}\` | \`${a.lifecycleState}\` | \`${a.trendShape}\` | **${a.primaryAction}** | \`${a.changeRisk}\` | \`${a.confidence}\` | \`${a.policySource || "SYSTEM_DEFAULT"}\` |`
    );
  }
  lines.push("");

  // 3. High-Value Refresh Candidates & Exact Briefs
  if (inv.topHighValueRefreshCandidates.length > 0) {
    lines.push("## 3. 🎯 High-Value Refresh & Expansion Candidates\n");
    for (const item of inv.topHighValueRefreshCandidates.slice(0, 5)) {
      lines.push(`### 🔹 \`${item.url}\` (${item.lifecycleState} → **${item.primaryAction}**)`);
      lines.push(`- **Recent Traffic:** ${item.recentPerformance.monthlyClicks} clicks/mo (${item.recentPerformance.monthlyImpressions} imp/mo)`);
      lines.push(`- **Trigger Rationale:** ${item.reasonClassificationTriggered}`);
      if (item.refreshBrief) {
        const b = item.refreshBrief;
        lines.push(`- **WHY:** ${b.whyExplanation}`);
        lines.push(`- **WHAT:** ${b.whatGapsExist.join("; ")}`);
        lines.push(`- **WHERE:** ${b.whereSections.join(", ")}`);
        lines.push(`- **PRESERVE:** Backlinks (${b.preserveElements.inboundBacklinksCount} referring domains), canonical URL, and core sections: ${b.preserveElements.highPerformingSectionHeadings.join(", ")}`);
        lines.push(`- **SPECIFIC CHANGES:** ${b.specificChangesNeeded.join("; ")}`);
        lines.push(`- **MEASUREMENT WINDOW:** ${b.measurementWindowDays} days (${b.measurementWindowReason})`);
      }
      lines.push("");
    }
  }

  // 4. Consolidation & Primary URL Opportunities
  if (inv.topConsolidationOpportunities.length > 0) {
    lines.push("## 4. 🔀 Consolidation & Cannibalization Resolution Opportunities\n");
    for (const c of inv.topConsolidationOpportunities.slice(0, 5)) {
      lines.push(`### 🔹 Primary Target: \`${c.consolidationBrief?.recommendedPrimaryUrl || c.url}\``);
      if (c.consolidationBrief) {
        lines.push(`- **Competing URLs:** ${c.consolidationBrief.competingUrls.join(", ")}`);
        lines.push(`- **Consolidation Confidence:** \`${c.consolidationBrief.consolidationConfidence}\``);
        lines.push(`- **Primary URL Selection Rationale:** ${c.consolidationBrief.primarySelectionReason}`);
        lines.push(`- **Redirect Recommendation:** ${c.consolidationBrief.redirectRecommendation}`);
      }
      lines.push("");
    }
  }

  // 5. Retirement Reviews & Safeguards
  if (inv.retirementReviewCandidates.length > 0) {
    lines.push("## 5. 🛡️ Retirement Review Candidates (Manual Review Required)\n");
    for (const r of inv.retirementReviewCandidates.slice(0, 5)) {
      lines.push(`- **\`${r.url}\`**`);
      lines.push(`  - *Reason:* ${r.retirementBrief?.retirementReason}`);
      lines.push(`  - *Business / User Purpose:* ${r.retirementBrief?.businessOrUserPurposeEvaluated}`);
      lines.push(`  - *Backlinks:* ${r.retirementBrief?.referringDomainsCount} referring domains`);
      lines.push(`  - *Status:* **MANUAL_APPROVAL_REQUIRED** (Zero-traffic never automatically triggers deletion)`);
    }
    lines.push("");
  }

  // 6. Data Limitations & Governance
  lines.push("## 6. ℹ️ Data Limitations & Governance Principles\n");
  for (const lim of report.governanceLimitations) {
    lines.push(`- ${lim}`);
  }
  lines.push("");
  lines.push(`**${report.immutabilityStatement}**`);

  return lines.join("\n");
}
