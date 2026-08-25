/**
 * Phase 11 Canonical Action Integration Bridge for Phase 13.
 * Emits canonical SeoActionItem instances for SERP-supported content opportunities & feature reviews.
 * Enforces deduplication with Phase 11/12 actions and maintains Phase 11 priority authority.
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import { SerpFeatureOpportunity } from "./types";

export function bridgeSerpIntelligenceToActions(
  projectId: string,
  featureOpportunities: SerpFeatureOpportunity[],
  topicOpportunities: Array<{ clusterId: string; representativeLabel: string; targetUrl: string; gaps: string[]; technicalBlockers?: string[] }>,
  existingActions: SeoActionItem[] = []
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];
  const existingActionIds = new Set(existingActions.map((a) => a.actionId));

  // 1. Topic Gaps / SERP Content Opportunities
  for (const item of topicOpportunities) {
    if (item.gaps.length === 0) continue;

    const actionId = buildStableActionId("SERP_CONTENT", item.clusterId, item.targetUrl);

    // If an action already exists for this exact target URL and cluster, deduplicate
    if (existingActionIds.has(actionId)) {
      continue;
    }

    const blockedBy = item.technicalBlockers && item.technicalBlockers.length > 0 ? [...item.technicalBlockers] : [];

    actions.push({
      actionId,
      projectId,
      type: "CONTENT_REFRESH_OPPORTUNITY",
      nature: "CONTENT_RECOMMENDATION",
      title: `SERP Topic Gap: Expand '${item.representativeLabel}' with observed competitor topics`,
      description: `Top ranking competitor pages consistently address subtopics missing from [${item.targetUrl}]: ${item.gaps.slice(0, 4).join(", ")}.`,
      underlyingRuleCodes: [],
      monitoringSignals: [],
      sourceSignals: ["SERP_COMPETITOR_INTELLIGENCE"],
      affectedUrls: [item.targetUrl],
      representativeUrls: [item.targetUrl],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "info",
      actionPriority: "MEDIUM",
      whyThisPriority: [
        `Competitors ranking in top SERP positions frequently cover: ${item.gaps.slice(0, 3).join(", ")}.`,
        `Expanding relevant topic depth on existing URL improves intent fulfillment.`,
      ],
      effort: "MEDIUM",
      effortRationale: "Requires researching and writing dedicated subheadings and paragraphs on the existing page.",
      primaryOwner: "Content",
      secondaryOwners: ["SEO"],
      owners: ["Content", "SEO"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
      pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
      isQuickWin: false,
      timelineBucket: "DO_NEXT",
      blockedByActionIds: blockedBy,
      blockingActionIds: [],
      whereToFix: `Content body of ${item.targetUrl}`,
      recommendedAction: `Add sections addressing: ${item.gaps.map((g) => `\`${g}\``).join(", ")}.`,
      verificationInstructions: `Verify updated copy naturally incorporates subtopics without keyword stuffing.`,
      actionStatus: "OPEN",
      statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 13 SERP intelligence." }],
    });
  }

  // 2. SERP Feature Opportunities (PAA, Snippet)
  for (const feat of featureOpportunities) {
    const actionId = buildStableActionId("SERP_FEATURE", feat.queryClusterId || "global", feat.opportunityName);

    if (existingActionIds.has(actionId)) {
      continue;
    }

    actions.push({
      actionId,
      projectId,
      type: "CONTENT_STRUCTURE_OPPORTUNITY",
      nature: "CONTENT_RECOMMENDATION",
      title: `SERP Feature: Optimize for ${feat.featureType.replace(/_/g, " ")} on '${feat.representativeLabel}'`,
      description: feat.advisoryNote,
      underlyingRuleCodes: [],
      monitoringSignals: [],
      sourceSignals: ["SERP_FEATURE_INTELLIGENCE"],
      affectedUrls: [],
      representativeUrls: [],
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      technicalSeverity: "info",
      actionPriority: "LOW",
      whyThisPriority: [
        `SERP displays an active ${feat.featureType.replace(/_/g, " ")} module.`,
        `Advisory format opportunity to improve direct search visibility.`,
      ],
      effort: "LOW",
      effortRationale: "Formatting and adding concise FAQ or direct answer blocks.",
      primaryOwner: "Content",
      secondaryOwners: ["CMS Editor"],
      owners: ["Content", "CMS Editor"],
      ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
      pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
      isQuickWin: true,
      timelineBucket: "DO_NEXT",
      blockedByActionIds: [],
      blockingActionIds: [],
      whereToFix: "Answer block / FAQ section",
      recommendedAction: feat.advisoryNote,
      verificationInstructions: "Validate structured FAQ or definition block formatting.",
      actionStatus: "OPEN",
      statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString(), note: "Generated from Phase 13 SERP feature analysis." }],
    });
  }

  return actions;
}
