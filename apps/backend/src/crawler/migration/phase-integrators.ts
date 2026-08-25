/**
 * Phase 11 Canonical Actions Bridge & Deduplication for Migrations.
 * Enriches existing technical actions and respects Phase 11 priority and lifecycle authority.
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import { RedirectIssue } from "./redirect-validator";
import { ParityIssue } from "./parity-validator";
import { UrlMappingEntry } from "./types";

export function bridgeMigrationOpportunitiesToPhase11(
  projectId: string,
  migrationId: string,
  redirectIssues: RedirectIssue[],
  parityIssues: ParityIssue[],
  mappings: UrlMappingEntry[],
  existingActions: SeoActionItem[] = []
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set(existingActions.map((a) => a.actionId));

  // 1. Redirect Issues (Deduplicated with existing 404/redirect actions)
  for (const issue of redirectIssues) {
    const actionId = buildStableActionId(issue.issueType, issue.sourceUrl, issue.destinationUrl);
    if (!existingActionIds.has(actionId)) {
      actions.push({
        actionId,
        projectId,
        type: "TECHNICAL_FIX",
        nature: "DETERMINISTIC_FIX",
        title: `Migration Blocker: ${issue.issueType.replace(/_/g, " ")} on [${issue.sourceUrl}]`,
        description: issue.details,
        underlyingRuleCodes: ["MIGRATION_REDIRECT_ERROR"],
        monitoringSignals: [],
        sourceSignals: ["MIGRATION_PRE_LAUNCH_AUDIT"],
        affectedUrls: [issue.sourceUrl, issue.destinationUrl],
        representativeUrls: [issue.sourceUrl, issue.destinationUrl],
        affectedUrlsCount: 2,
        estimatedRealEdits: 1,
        technicalSeverity: issue.blockerState === "LAUNCH_BLOCKER" ? "critical" : "high",
        actionPriority: issue.blockerState === "LAUNCH_BLOCKER" ? "CRITICAL" : "HIGH",
        whyThisPriority: [`Migration launch safety requires resolving redirect failures before traffic transfer.`],
        effort: "LOW",
        effortRationale: "Update server-side redirect rule.",
        primaryOwner: "Developer",
        secondaryOwners: ["SEO"],
        owners: ["Developer", "SEO"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: true,
        timelineBucket: "DO_NOW",
        blockedByActionIds: [],
        blockingActionIds: [],
        whereToFix: "Server Nginx/Apache/Cloudflare Redirect Rules",
        recommendedAction: issue.suggestedFix,
        verificationInstructions: "Verify curl -I returns HTTP 301 direct to target destination.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: `Generated from migration [${migrationId}] audit.` }],
      });
    }
  }

  // 2. Parity & Staging Leak Issues (Deduplicated with existing canonical/noindex actions)
  for (const pIssue of parityIssues) {
    const actionId = buildStableActionId(pIssue.issueType, pIssue.url, migrationId);
    if (!existingActionIds.has(actionId)) {
      actions.push({
        actionId,
        projectId,
        type: "TECHNICAL_FIX",
        nature: "DETERMINISTIC_FIX",
        title: `Migration Parity: ${pIssue.issueType.replace(/_/g, " ")} on [${pIssue.url}]`,
        description: pIssue.details,
        underlyingRuleCodes: ["MIGRATION_PARITY_ERROR"],
        monitoringSignals: [],
        sourceSignals: ["MIGRATION_PARITY_AUDIT"],
        affectedUrls: [pIssue.url],
        representativeUrls: [pIssue.url],
        affectedUrlsCount: 1,
        estimatedRealEdits: 1,
        technicalSeverity: pIssue.blockerState === "LAUNCH_BLOCKER" ? "critical" : "high",
        actionPriority: pIssue.blockerState === "LAUNCH_BLOCKER" ? "CRITICAL" : "HIGH",
        whyThisPriority: ["Prevent staging domain indexing or site-wide search visibility loss."],
        effort: "LOW",
        effortRationale: "Update template or configuration.",
        primaryOwner: "Developer",
        secondaryOwners: ["SEO"],
        owners: ["Developer", "SEO"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: true,
        timelineBucket: "DO_NOW",
        blockedByActionIds: [],
        blockingActionIds: [],
        whereToFix: "HTML Head Template / CMS Config",
        recommendedAction: pIssue.suggestedFix,
        verificationInstructions: "Verify canonical and robots directives point cleanly to production.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: `Generated from migration [${migrationId}] audit.` }],
      });
    }
  }

  return actions;
}
