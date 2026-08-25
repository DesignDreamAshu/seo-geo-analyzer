/**
 * Phase 11 Canonical Actions Bridge & Deduplication for International SEO.
 * Enriches existing technical actions for broken targets and generates distinct actions for missing return links and canonical conflicts.
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import { HreflangCluster } from "./types";
import { TargetHealthIssue, CanonicalConflictFinding } from "./target-canonical-health";

export function bridgeInternationalOpportunitiesToPhase11(
  projectId: string,
  clusters: HreflangCluster[],
  targetIssues: TargetHealthIssue[],
  canonicalConflicts: CanonicalConflictFinding[],
  existingActions: SeoActionItem[] = []
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set(existingActions.map((a) => a.actionId));

  // 1. Missing Return Link Actions
  for (const cluster of clusters) {
    if (cluster.reciprocityState === "HREFLANG_RETURN_LINK_MISSING") {
      const rootUrl = cluster.pages[0]?.url || "root";
      const actionId = buildStableActionId("HREFLANG_MISSING_RETURN", rootUrl, cluster.clusterId);

      if (!existingActionIds.has(actionId)) {
        actions.push({
          actionId,
          projectId,
          type: "TECHNICAL_FIX",
          nature: "DETERMINISTIC_FIX",
          title: `Hreflang Reciprocity: Add missing reciprocal return annotations across cluster [${cluster.clusterId}]`,
          description: `Alternate hreflang cluster lacks bidirectional return links on one or more target localized URLs.`,
          underlyingRuleCodes: ["HREFLANG_MISSING_RETURN"],
          monitoringSignals: [],
          sourceSignals: ["INTERNATIONAL_HREFLANG_AUDIT"],
          affectedUrls: cluster.pages.map((p) => p.url),
          representativeUrls: cluster.pages.slice(0, 3).map((p) => p.url),
          affectedUrlsCount: cluster.pages.length,
          estimatedRealEdits: 1,
          technicalSeverity: "high",
          actionPriority: "HIGH",
          whyThisPriority: ["Google ignores hreflang clusters unless all localized versions reciprocally link to each other."],
          effort: "LOW",
          effortRationale: "Update template or XML sitemap to output full reciprocal hreflang set on all versions.",
          primaryOwner: "Developer",
          secondaryOwners: ["SEO"],
          owners: ["Developer", "SEO"],
          ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
          pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
          isQuickWin: true,
          timelineBucket: "DO_NOW",
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "HTML Head Template / Hreflang XML Sitemap",
          recommendedAction: `Add reciprocal hreflang alternate links to all ${cluster.pages.length} URLs in this locale cluster.`,
          verificationInstructions: "Verify all localized URLs declare reciprocal alternate tags for all cluster members.",
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 16 audit." }],
        });
      }
    }
  }

  // 2. Canonical Conflict Actions
  for (const conf of canonicalConflicts) {
    const actionId = buildStableActionId("HREFLANG_CANONICAL_CONFLICT", conf.url, conf.locale);
    if (!existingActionIds.has(actionId)) {
      actions.push({
        actionId,
        projectId,
        type: "CONTENT_STRUCTURE_OPPORTUNITY",
        nature: "REVIEW_RECOMMENDED",
        title: `International Canonical Conflict: Align canonical tag on [${conf.url}] (${conf.locale})`,
        description: conf.details,
        underlyingRuleCodes: ["CANONICAL_POINTS_TO_OTHER_LOCALE"],
        monitoringSignals: [],
        sourceSignals: ["INTERNATIONAL_CANONICAL_AUDIT"],
        affectedUrls: [conf.url],
        representativeUrls: [conf.url],
        affectedUrlsCount: 1,
        estimatedRealEdits: 1,
        technicalSeverity: "medium",
        actionPriority: "MEDIUM",
        whyThisPriority: ["Conflicting canonical and hreflang signals prevent proper indexing of independent regional variants."],
        effort: "LOW",
        effortRationale: "Update canonical tag to point to self if page is intended as an independent locale version.",
        primaryOwner: "SEO",
        secondaryOwners: ["Developer"],
        owners: ["SEO", "Developer"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: true,
        timelineBucket: "DO_NOW",
        blockedByActionIds: [],
        blockingActionIds: [],
        whereToFix: "HTML Head canonical tag / CMS settings",
        recommendedAction: `Update canonical URL on [${conf.url}] to self [${conf.url}].`,
        verificationInstructions: "Verify canonical URL matches the page's own URL.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 16 audit." }],
      });
    }
  }

  return actions;
}
