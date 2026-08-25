/**
 * Master Monitoring & Regression Report Serializer.
 * Correctly distinguishes underlying production rules from monitoring transition signals.
 */

import { MonitoringAuditResult } from "./types";

export function serializeMonitoringReportMarkdown(result: MonitoringAuditResult): string {
  const s = result.summary;
  const c = result.comparability;

  let md = `# SEO CHANGE & REGRESSION INTELLIGENCE REPORT

**Generated:** ${result.comparedAt}  
**Current Snapshot:** \`${result.currentSnapshotId}\`  
**Baseline Snapshot:** \`${result.baselineSnapshotId || "NONE"}\` (\`${result.baselineType}\` - \`${result.baselineSupportStatus}\`)  
**Comparability Status:** \`${c.status}\`  
**Alert Tier:** \`${result.alertTier}\`

---

## 1. Executive Monitoring Summary

| Metric | Count | Status / Notes |
|---|---|---|
| **Evaluated URLs** | ${s.totalUrlsCurrent} | Baseline had ${s.totalUrlsBaseline} URLs |
| **New Regressions** | **${s.totalNewRegressions}** | Newly introduced since baseline crawl |
| **Changed Findings** | **${s.totalChangedFindings}** | Persisting findings with material evidence changes |
| **Reopened Issues** | **${s.totalReopenedRegressions}** | Previously resolved issues that recurred |
| **Systemic Groups** | **${s.totalSystemicGroups}** | Multi-page regressions sharing a single template root cause |
| **Resolved Issues** | **${s.totalResolvedFindings}** | Verified resolved in current crawl |
| **Persisting Backlog** | ${s.totalPersistingFindings} | Unchanged historical issues |
| **Newly Detectable** | ${s.totalNewlyDetectable} | Findings from newly introduced diagnostic rules |

---

`;

  // 2. Alert Highlights
  if (result.alertSummary.length > 0) {
    md += `## 2. Priority Alert Summary\n`;
    for (const alert of result.alertSummary) {
      md += `- ⚠️ **${alert}**\n`;
    }
    md += `\n---\n\n`;
  }

  // 3. Systemic Regressions Section
  if (result.systemicRegressions.length > 0) {
    md += `## 3. Systemic Template Regressions (High Leverage)\n\n`;
    for (const sg of result.systemicRegressions) {
      md += `### 🚨 ${sg.title}\n`;
      md += `- **Underlying Production Rule:** \`${sg.ruleCode}\`\n`;
      md += `- **Monitoring Transition Signal:** \`${sg.monitoringSignalCode}\`\n`;
      md += `- **Regression Priority:** \`${sg.regressionPriority}\`\n`;
      md += `- **Root-Cause Confidence:** \`${sg.rootCauseConfidence}\`\n`;
      md += `- **Affected Pages:** **${sg.affectedUrlsCount} URLs** (e.g. \`${sg.affectedUrls[0]}\`)\n`;
      md += `- **Root-Cause Hypothesis:** ${sg.rootCauseHypothesis}\n`;
      md += `- **Estimated Real Changes:** **~${sg.estimatedRealEdits} edit** (Fix template to resolve all ${sg.affectedUrlsCount} pages)\n`;
      md += `- **Where to Fix:** ${sg.whereToFix}\n`;
      md += `- **Verification:** ${sg.verificationInstructions}\n\n`;
    }
    md += `---\n\n`;
  }

  // 4. New, Changed & Reopened Regressions
  const activeRegressions = result.findingChanges.filter(
    (f) => f.lifecycle === "NEW" || f.lifecycle === "REOPENED" || f.lifecycle === "CHANGED"
  );
  if (activeRegressions.length > 0) {
    md += `## 4. New, Changed & Reopened Regressions Breakdown\n\n`;
    for (const f of activeRegressions.slice(0, 20)) {
      md += `- **[${f.lifecycle}] \`${f.ruleCode}\`** (Signal: \`${f.monitoringSignalCode}\`) on [${f.url}](${f.url})\n`;
      md += `  - *Technical Severity:* \`${f.technicalSeverity.toUpperCase()}\` | *Priority:* \`${f.regressionPriority}\`\n`;
      if (f.previousEvidence) {
        md += `  - *Previous Evidence:* ${f.previousEvidence}\n`;
      }
      md += `  - *Current Evidence:* ${f.currentEvidence}\n`;
      md += `  - *Remediation:* ${f.remediationSummary}\n`;
    }
    if (activeRegressions.length > 20) {
      md += `\n*... and ${activeRegressions.length - 20} additional individual regression instances.* (Refer to Systemic Groups above for template consolidation)\n`;
    }
    md += `\n---\n\n`;
  }

  // 5. Confirmed Resolved Issues
  const resolved = result.findingChanges.filter((f) => f.lifecycle === "RESOLVED");
  if (resolved.length > 0) {
    md += `## 5. Confirmed Resolved Issues\n\n`;
    for (const r of resolved.slice(0, 10)) {
      md += `- ✅ **\`${r.ruleCode}\`** resolved on [${r.url}](${r.url}) — *${r.currentEvidence}*\n`;
    }
    if (resolved.length > 10) {
      md += `\n*... and ${resolved.length - 10} additional verified resolutions.*\n`;
    }
    md += `\n---\n\n`;
  }

  // 6. Comparability Checks & Limitations
  md += `## 6. Comparability Assessment\n\n`;
  for (const chk of c.checks) {
    md += `- [${chk.satisfied ? "x" : " "}] **${chk.name}:** ${chk.details}\n`;
  }
  if (c.limitations.length > 0) {
    md += `\n**Limitations & Safeguards:**\n`;
    for (const lim of c.limitations) {
      md += `- ℹ️ ${lim}\n`;
    }
  }

  return md;
}
