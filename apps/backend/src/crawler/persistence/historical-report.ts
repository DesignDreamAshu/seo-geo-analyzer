/**
 * Phase 24: Historical Report Reconstruction Engine.
 * Regenerates exact point-in-time reports from structured persisted SQLite evidence.
 */

import {
  AuditRunEntity,
  AuditPageEntity,
  AuditFindingEntity,
  AuditMetricEntity,
  AuditComparisonResult,
} from "./types";

export const REPORT_RENDERER_VERSION = "1.0.0";

export interface HistoricalReportInput {
  projectName: string;
  auditRun: AuditRunEntity;
  pages: AuditPageEntity[];
  findings: AuditFindingEntity[];
  metrics?: AuditMetricEntity | null;
  comparisonWithPrevious?: AuditComparisonResult | null;
}

export function reconstructHistoricalReportMarkdown(input: HistoricalReportInput): string {
  const { projectName, auditRun, pages, findings, metrics, comparisonWithPrevious } = input;
  const lines: string[] = [];

  lines.push(`# HISTORICAL SEO AUDIT REPORT — ${projectName.toUpperCase()}`);
  lines.push(`> 📸 **Historical Snapshot** observed at \`${auditRun.startedAt}\` | Report Renderer: \`v${REPORT_RENDERER_VERSION}\``);
  lines.push("");
  lines.push(`**Audit:** #${auditRun.sequenceNumber} (\`${auditRun.auditRunId}\`)`);
  lines.push(`**Started At:** ${auditRun.startedAt} | **Completed At:** ${auditRun.completedAt || "In Progress"}`);
  lines.push(`**Trigger:** \`${auditRun.trigger}\` | **Status:** \`${auditRun.status}\``);
  lines.push(`**Crawler Version:** \`${auditRun.crawlerVersion}\` | **Rule Inventory:** \`${auditRun.ruleInventoryVersion}\` (${auditRun.productionRuleCount} Certified Production Rules)`);
  lines.push("");

  lines.push("## 1. AUDIT SUMMARY METRICS");
  lines.push(`- **Pages Crawled:** ${metrics?.pagesCrawled || pages.length}`);
  lines.push(`- **Indexable Pages:** ${metrics?.pagesIndexable || pages.filter((p) => p.indexability === "INDEXABLE").length}`);
  lines.push(`- **Total Findings:** ${metrics?.totalFindings || findings.length}`);
  if (metrics?.seoScore !== undefined) {
    lines.push(`- **SEO Health Score:** ${metrics.seoScore}/100`);
  }
  lines.push("");

  lines.push("### Finding Severity Breakdown:");
  lines.push(`- **Critical:** ${metrics?.criticalCount || findings.filter((f) => f.severity === "CRITICAL").length}`);
  lines.push(`- **High:** ${metrics?.highCount || findings.filter((f) => f.severity === "HIGH").length}`);
  lines.push(`- **Medium:** ${metrics?.mediumCount || findings.filter((f) => f.severity === "MEDIUM").length}`);
  lines.push(`- **Low:** ${metrics?.lowCount || findings.filter((f) => f.severity === "LOW").length}`);
  lines.push(`- **Informational:** ${metrics?.informationalCount || findings.filter((f) => f.severity === "INFORMATIONAL").length}`);
  lines.push("");

  if (comparisonWithPrevious) {
    lines.push(`## 2. CHANGE INTELLIGENCE (SINCE AUDIT #${comparisonWithPrevious.baselineSequenceNumber})`);
    lines.push(`- **Previous Issues:** ${comparisonWithPrevious.previousIssueCount}`);
    lines.push(`- **Current Issues:** ${comparisonWithPrevious.currentIssueCount}`);
    lines.push(`- **Fixed:** ${comparisonWithPrevious.fixedCount}`);
    lines.push(`- **New:** ${comparisonWithPrevious.newCount}`);
    lines.push(`- **Unchanged:** ${comparisonWithPrevious.unchangedCount}`);
    lines.push(`- **Reopened (Regressed):** ${comparisonWithPrevious.reopenedCount}`);
    lines.push(`- **Changed Evidence:** ${comparisonWithPrevious.changedCount}`);
    if (comparisonWithPrevious.severityIncreasedCount > 0) {
      lines.push(`- **Severity Increased:** ${comparisonWithPrevious.severityIncreasedCount}`);
    }
    if (comparisonWithPrevious.severityDecreasedCount > 0) {
      lines.push(`- **Severity Decreased:** ${comparisonWithPrevious.severityDecreasedCount}`);
    }
    if (comparisonWithPrevious.uncomparableCount > 0) {
      lines.push(`- **Uncomparable:** ${comparisonWithPrevious.uncomparableCount}`);
    }
    lines.push("");
  } else {
    lines.push("## 2. CHANGE INTELLIGENCE");
    lines.push("> **BASELINE AUDIT**: No previous comparable audit available.");
    lines.push("");
  }

  lines.push("## 3. FINDINGS INVENTORY");
  lines.push("| Severity | Rule ID | URL | Message |");
  lines.push("| :--- | :--- | :--- | :--- |");
  const sampleFindings = findings.slice(0, 50); // Top 50 sample
  for (const f of sampleFindings) {
    lines.push(`| **${f.severity}** | \`${f.ruleId}\` | \`${f.normalizedUrl}\` | ${f.message.replace(/\|/g, "\\|")} |`);
  }
  if (findings.length > 50) {
    lines.push(`| ... | ... | ... | *[${findings.length - 50} additional findings persisted in database]* |`);
  }
  lines.push("");

  lines.push("## 4. AUDIT CONFIGURATION CONTEXT");
  const cfg = auditRun.configurationSnapshot;
  lines.push(`- **Country Context:** ${cfg.countryContext || "Default"}`);
  lines.push(`- **Device Context:** ${cfg.deviceContext || "Mobile (Googlebot)"}`);
  lines.push(`- **Max Crawl Depth:** ${cfg.crawlSettings?.maxDepth || "Unlimited"}`);
  lines.push(`- **Robots.txt Enforced:** ${cfg.crawlSettings?.respectRobotsTxt !== false ? "Yes" : "No"}`);
  if (cfg.experimentContext) {
    lines.push(`- **Active Experiment:** \`${cfg.experimentContext.experimentId}\` (${cfg.experimentContext.variant})`);
  }
  if (cfg.migrationContext) {
    lines.push(`- **Active Migration:** \`${cfg.migrationContext.migrationId}\` (${cfg.migrationContext.phase})`);
  }

  return lines.join("\n");
}
