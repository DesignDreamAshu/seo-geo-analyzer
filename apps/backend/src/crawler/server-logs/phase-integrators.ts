/**
 * Phase 11 Canonical Actions Bridge & Authority Boundary for Server Log Intelligence.
 * Supplies verified server log evidence and context to Phase 11 while respecting Phase 11's final priority authority.
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import { ErrorBurstFinding, FacetPatternFinding } from "./pattern-detector";

export function bridgeServerLogOpportunitiesToPhase11(params: {
  projectId: string;
  errorBursts: ErrorBurstFinding[];
  facetPatterns: FacetPatternFinding[];
  unobservedImportantUrls: string[];
  existingActions?: SeoActionItem[];
}): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set((params.existingActions || []).map((a) => a.actionId));

  // 1. 5xx Error Bursts
  for (const burst of params.errorBursts) {
    const actionId = buildStableActionId("BOT_5XX_BURST_OBSERVED", burst.affectedUrls[0] || "server_root", burst.statusCode.toString());
    if (!existingActionIds.has(actionId)) {
      actions.push({
        actionId,
        projectId: params.projectId,
        type: "TECHNICAL_FIX",
        nature: "DETERMINISTIC_FIX",
        title: `Server Reliability: ${burst.requestsCount} search bot requests encountered HTTP ${burst.statusCode}`,
        description: `Search engines encountered a cluster of ${burst.requestsCount} server errors between ${burst.timestampStart} and ${burst.timestampEnd}. Affected URLs include: ${burst.affectedUrls.slice(0, 3).join(", ")}.`,
        underlyingRuleCodes: ["STATUS_500_INTERNAL_SERVER_ERROR"],
        monitoringSignals: [],
        sourceSignals: ["SERVER_LOG_BURST_DETECTION"],
        affectedUrls: burst.affectedUrls,
        representativeUrls: burst.affectedUrls.slice(0, 5),
        affectedUrlsCount: burst.affectedUrls.length,
        estimatedRealEdits: 1,
        technicalSeverity: "critical",
        actionPriority: "CRITICAL",
        whyThisPriority: ["Persistent 5xx errors impede search bot crawlability and risk deindexing."],
        effort: "MEDIUM",
        effortRationale: "Investigate backend / database timeout / origin configuration.",
        primaryOwner: "Developer",
        secondaryOwners: ["SEO"],
        owners: ["Developer", "SEO"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: false,
        timelineBucket: "DO_NOW",
        blockedByActionIds: [],
        blockingActionIds: [],
        whereToFix: "Web Server / Application Hosting Infrastructure",
        recommendedAction: "Review application error logs around the burst window to resolve server crashes or origin timeouts.",
        verificationInstructions: "Verify server responses return clean HTTP 200 without 5xx errors.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from server log analysis." }],
      });
    }
  }

  // 2. Facet Expansion Review
  for (const facet of params.facetPatterns) {
    if (facet.recommendedReviewType !== "NO_ACTION" && facet.variantCount >= 100) {
      const actionId = buildStableActionId("FACET_CRAWL_EXPANSION_REVIEW", facet.basePath, params.projectId);
      if (!existingActionIds.has(actionId)) {
        actions.push({
          actionId,
          projectId: params.projectId,
          type: "CONTENT_STRUCTURE_OPPORTUNITY",
          nature: "REVIEW_RECOMMENDED",
          title: `Crawl Efficiency: Facet & parameter review on [${facet.basePath}] (${facet.variantCount} variants)`,
          description: `Search bots spent ${facet.requestsCount} requests across ${facet.variantCount} parameter combinations. Review type: ${facet.recommendedReviewType}.`,
          underlyingRuleCodes: ["CRAWL_EFFICIENCY_REVIEW"],
          monitoringSignals: [],
          sourceSignals: ["SERVER_LOG_FACET_ANALYSIS"],
          affectedUrls: [facet.basePath],
          representativeUrls: [facet.basePath],
          affectedUrlsCount: facet.variantCount,
          estimatedRealEdits: 1,
          technicalSeverity: "medium",
          actionPriority: "MEDIUM",
          whyThisPriority: ["Consolidate search bot requests toward indexable primary landing pages."],
          effort: "LOW",
          effortRationale: "Configure canonical tag to point to clean base URL or add robots parameter directive.",
          primaryOwner: "SEO",
          secondaryOwners: ["Developer"],
          owners: ["SEO", "Developer"],
          ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
          pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
          isQuickWin: true,
          timelineBucket: "DO_NEXT",
          blockedByActionIds: [],
          blockingActionIds: [],
          whereToFix: "Template Canonical Tags / Robots.txt",
          recommendedAction: facet.guidance,
          verificationInstructions: "Verify parameter URLs specify self-canonical or clean canonical to base page.",
          actionStatus: "OPEN",
          statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from server log facet analysis." }],
        });
      }
    }
  }

  return actions;
}
