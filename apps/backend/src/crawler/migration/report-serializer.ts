/**
 * Migration SEO Report Serializer.
 * Generates Planning, Pre-Launch, and Post-Launch Markdown reports.
 */

import { MigrationIntelligenceReport } from "./types";

export type ReportMode = "PLANNING" | "PRE_LAUNCH" | "POST_LAUNCH";

export function serializeMigrationReportMarkdown(
  report: MigrationIntelligenceReport,
  mode: ReportMode = "PRE_LAUNCH"
): string {
  const modeTitle =
    mode === "PLANNING"
      ? "MIGRATION PLANNING & URL MAPPING REPORT"
      : mode === "POST_LAUNCH"
      ? "POST-LAUNCH SEO RECOVERY & MONITORING REPORT"
      : "PRE-LAUNCH SEO MIGRATION VALIDATION REPORT";

  let md = `# ${modeTitle}

**Generated:** ${report.generatedAt}  
**Migration ID:** \`${report.migrationId}\`  
**Project:** \`${report.projectId}\`  
**Migration Type:** \`${report.migrationType}\`  
**Migration Status:** \`${report.status}\`  
**Launch Readiness:** \`${report.readinessState}\` (${report.readinessRationale})

---

## 1. Executive Summary & Migration Scope

| Dimension / Metric | Value | Strategic Meaning |
|---|---|---|
| **Total Source URLs** | **${report.scopeSummary.totalSourceUrls} URLs** | Complete pre-migration inventory from crawl, GSC, and sitemaps |
| **Successfully Mapped** | **${report.scopeSummary.mappedUrlsCount} URLs** | URLs with verified destination targets |
| **Unchanged URLs** | **${report.scopeSummary.unchangedUrlsCount} URLs** | URLs preserved identically on the destination structure |
| **Intentionally Removed** | **${report.scopeSummary.intentionallyRemovedCount} URLs** | Content deliberately retired with no replacement |
| **Unmapped Source URLs** | **${report.scopeSummary.unmappedUrlsCount} URLs** | Source URLs missing destination mapping |
| **High-Value URLs Protection** | **${report.scopeSummary.highValueMappedPercentage}% mapped** | Coverage of critical traffic/backlink driver pages (${report.scopeSummary.highValueUrlsCount} total) |
| **Active Launch Blockers** | **${report.launchBlockers.length} blockers** | Critical technical defects that prevent safe launch |

---

## 2. 🚨 Pre-Launch Blockers & High-Risk Items

`;

  if (report.launchBlockers.length === 0) {
    md += `*Zero critical launch blockers detected in evaluated migration scope.*\n\n`;
  } else {
    for (const b of report.launchBlockers) {
      md += `### [${b.blockerState}] \`${b.issueType}\` on \`${b.url}\`\n`;
      md += `- **Problem:** ${b.description}\n`;
      md += `- **Remediation:** ${b.suggestedFix}\n\n`;
    }
  }

  md += `---\n\n## 3. 🔀 Redirect Validation Summary\n\n`;
  md += `- **Clean Permanent (301/308) Redirects:** ${report.redirectValidationSummary.cleanPermanentRedirectsCount}\n`;
  md += `- **Temporary (302/307) Redirects:** ${report.redirectValidationSummary.temporaryRedirectsCount}\n`;
  md += `- **Redirect Chains (>= 2 hops):** ${report.redirectValidationSummary.redirectChainsCount}\n`;
  md += `- **Redirect Loops:** ${report.redirectValidationSummary.redirectLoopsCount}\n`;
  md += `- **Broken Targets (404/410):** ${report.redirectValidationSummary.brokenTargetCount}\n`;
  md += `- **Non-Indexable Targets (noindex):** ${report.redirectValidationSummary.nonIndexableTargetCount}\n\n`;

  md += `---\n\n## 4. 🔍 Content & Structural Parity\n\n`;
  md += `- **Strong Content Parity:** ${report.contentAndStructureParity.strongParityCount} pages\n`;
  md += `- **Partial Content Parity:** ${report.contentAndStructureParity.partialParityCount} pages\n`;
  md += `- **Weak Content Parity:** ${report.contentAndStructureParity.weakParityCount} pages\n`;
  md += `- **Staging Reference Leaks:** ${report.contentAndStructureParity.stagingLeaksCount}\n`;
  md += `- **Stale Canonical References:** ${report.contentAndStructureParity.staleCanonicalCount}\n`;
  md += `- **Legacy Internal Links:** ${report.contentAndStructureParity.legacyInternalLinksCount}\n\n`;

  if (mode === "POST_LAUNCH") {
    md += `---\n\n## 5. 📈 Post-Launch GSC Recovery Tracking\n\n`;
    md += `**Recovery State:** \`${report.gscRecoveryTracking.recoveryState}\`  \n`;
    md += `- **Pre-Migration Baseline:** ${report.gscRecoveryTracking.preMigrationTotalClicks.toLocaleString()} clicks  \n`;
    md += `- **Post-Migration Volume:** ${report.gscRecoveryTracking.postMigrationTotalClicks.toLocaleString()} clicks  \n`;
    md += `- **Click Transfer Ratio:** ${Math.round(report.gscRecoveryTracking.observedClickTransferRatio * 100)}%  \n`;
    md += `- **Analysis:** ${report.gscRecoveryTracking.recoveryDetails}\n\n`;
  }

  md += `---\n\n## 6. ℹ️ Data Limitations & Governance Principles\n\n`;
  for (const lim of report.governanceLimitations) {
    md += `- ${lim}\n`;
  }

  md += `\n**Immutability Guarantee:** ${report.immutabilityStatement}\n`;

  return md;
}
