/**
 * Phase 23: Automation & Autonomous Operations Report Serializer.
 * Generates user-visible Markdown reports for operational health, jobs, approvals, and safe mode status.
 */

import { OperationalHealthSummary, AutomationJob, ApprovalRecord, AutomationAlert } from "./types";

export interface AutomationReportInput {
  projectId: string;
  projectName?: string;
  healthSummary: OperationalHealthSummary;
  activeJobs?: AutomationJob[];
  pendingApprovals?: ApprovalRecord[];
  activeAlerts?: AutomationAlert[];
  governanceLimitations?: string[];
}

export function serializeAutomationReportMarkdown(input: AutomationReportInput): string {
  const lines: string[] = [];
  const h = input.healthSummary;

  lines.push("# SEO AUTOMATION & AUTONOMOUS-BUT-SAFE OPERATIONS REPORT");
  lines.push(`**Project:** ${input.projectName || input.projectId} (\`${input.projectId}\`)`);
  lines.push(`**Scheduler Health:** \`${h.schedulerHealth}\` | **Safe Mode Scope:** \`${h.safeModeState}\``);
  lines.push(`**Policy Version:** \`${h.policyVersion}\` | **Storage Guarantee:** \`${h.storageGuarantee}\``);
  lines.push(`**Last Evaluated At:** ${h.lastEvaluatedAt}`);
  lines.push("");

  lines.push("## 1. OPERATIONAL HEALTH & PROVIDER FRESHNESS");
  lines.push(`- **Automated Workflows:** ${h.automationCoverage.automatedWorkflowsCount}`);
  lines.push(`- **Monitored Workflows:** ${h.automationCoverage.monitoredWorkflowsCount}`);
  lines.push(`- **Manual/Governed Workflows:** ${h.automationCoverage.manualWorkflowsCount}`);
  lines.push(`- **Verification Backlog:** ${h.verificationBacklogCount} action(s) implemented pending verification`);
  lines.push(`- **Approval Backlog:** ${h.approvalBacklogCount} action(s) awaiting human decision`);
  const budgetStr = h.budgetStatus.dailyBudgetLimit !== undefined ? `$${h.budgetStatus.dailyCostSpent.toFixed(2)} / $${h.budgetStatus.dailyBudgetLimit.toFixed(2)}` : `$${h.budgetStatus.dailyCostSpent.toFixed(2)} (BUDGET_UNCONFIGURED)`;
  lines.push(`- **Daily Cost Spent:** ${budgetStr} [Confidence: \`${h.budgetStatus.costConfidence}\`]`);
  lines.push("");

  lines.push("### Provider Data Freshness & Completeness:");
  lines.push("| Provider | Freshness State | Completeness | Status |");
  lines.push("| :--- | :--- | :--- | :--- |");
  for (const [p, state] of Object.entries(h.providerHealth)) {
    lines.push(`| **${p}** | \`${state.freshness}\` | \`${state.completeness}\` | ${state.freshness === "FRESH" || state.freshness === "ACCEPTABLE" ? "✓ Operational" : "⚠ Degraded / Stale"} |`);
  }
  lines.push("");

  if (h.safeModeState !== "NORMAL_OPERATION") {
    lines.push("## 2. ⚠ SAFE MODE ACTIVE");
    lines.push(`- **Scope:** \`${h.safeModeState}\` | **Trigger Class:** \`${h.safeModeTriggerClass || "TECHNICAL_CATASTROPHE"}\``);
    lines.push(`- **Confidence:** \`${h.safeModeConfidence || "SAFE_MODE_TRIGGER_CONFIRMED"}\``);
    lines.push(`- **Reason:** ${h.safeModeReason || "Anomaly detected"}`);
    lines.push("- **Enforcement:** Production mutations for the affected scope are strictly halted.");
    lines.push("- **Monitoring:** Diagnostic crawls and read-only observation continue active.");
    lines.push("");
  }

  if (input.pendingApprovals && input.pendingApprovals.length > 0) {
    lines.push("## 3. PENDING APPROVALS BACKLOG");
    lines.push("| Approval ID | Action ID | Action Version | Scope | Target URLs Count | Expires At |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const app of input.pendingApprovals) {
      lines.push(`| \`${app.approvalId}\` | \`${app.actionId}\` | \`${app.actionVersion}\` | \`${app.approvedScope}\` | ${app.targetUrls.length} | ${app.expiresAt} |`);
    }
    lines.push("");
  }

  if (input.activeAlerts && input.activeAlerts.length > 0) {
    lines.push("## 4. ACTIVE ALERTS & ESCALATIONS");
    lines.push("| Severity | Urgency | Issue Code | Lifecycle | Materiality | Suppressed | Title |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const al of input.activeAlerts) {
      lines.push(`| **${al.severity}** | \`${al.operationalUrgency}\` | \`${al.issueCode}\` | \`${al.lifecycleState}\` | \`${al.materiality}\` | ${al.isSuppressed ? "Yes (Cooldown)" : "No (Active)"} | ${al.title} |`);
    }
    lines.push("");
  }

  lines.push("## 5. GOVERNANCE & SAFETY LIMITATIONS");
  const limits = input.governanceLimitations || [
    "Autonomous execution is strictly limited to allowlisted, low-risk, deterministic, reversible operations.",
    "Sitewide and template changes cannot execute autonomously and require explicit human authorization.",
    "Marking an action implemented does not constitute resolution; verification against fresh evidence is required.",
    "Provider data staleness or outages never trigger false recovery or false SEO deterioration claims.",
  ];
  for (const lim of limits) {
    lines.push(`- ${lim}`);
  }

  return lines.join("\n");
}
