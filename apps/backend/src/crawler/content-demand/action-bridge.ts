/**
 * Phase 11 Action Plan Integration Bridge.
 * Emits canonical Phase 11 SeoActionItem instances from Phase 12 content demand findings
 * without creating a parallel prioritization or action architecture.
 */

import { SeoActionItem } from "../opportunity/types";
import { buildStableActionId } from "../opportunity/deduplicator";
import { ContentCoverageAssessment, CannibalizationAssessment } from "./types";

export function bridgeContentDemandToActions(
  projectId: string,
  coverageAssessments: ContentCoverageAssessment[],
  cannibalizationAssessments: CannibalizationAssessment[]
): SeoActionItem[] {
  const actions: SeoActionItem[] = [];

  // 1. Bridge Coverage Decisions (Improve Existing vs Create New)
  for (const cov of coverageAssessments) {
    if (cov.decision === "NO_ACTION" || cov.decision === "MANUAL_REVIEW") {
      continue;
    }

    if (cov.decision === "CREATE_NEW_PAGE_CANDIDATE" || cov.decision === "VALIDATION_REQUIRED") {
      const isValidationOnly = cov.decision === "VALIDATION_REQUIRED";
      const actionId = buildStableActionId("NEW_PAGE", cov.clusterId, cov.representativeLabel);

      actions.push({
        actionId,
        projectId,
        type: "CONTENT_STRUCTURE_OPPORTUNITY",
        nature: isValidationOnly ? "REVIEW_RECOMMENDED" : "CONTENT_RECOMMENDATION",
        title: isValidationOnly
          ? `Validate business offering relevance for '${cov.representativeLabel}'`
          : `Create dedicated content asset for '${cov.representativeLabel}'`,
        description: cov.decisionRationale,
        underlyingRuleCodes: [],
        monitoringSignals: [],
        sourceSignals: ["GSC_SEARCH_DEMAND_INTELLIGENCE"],
        affectedUrls: cov.dominantLandingPage ? [cov.dominantLandingPage] : [],
        representativeUrls: cov.dominantLandingPage ? [cov.dominantLandingPage] : [],
        affectedUrlsCount: 1,
        estimatedRealEdits: 1,
        technicalSeverity: "info",
        actionPriority: cov.observedImpressions >= 3000 ? "HIGH" : "MEDIUM",
        whyThisPriority: [
          `Observed first-party search demand: ${cov.observedImpressions.toLocaleString()} GSC impressions.`,
          `No existing dedicated URL satisfies this commercial/search intent.`,
        ],
        effort: isValidationOnly ? "LOW" : "HIGH",
        effortRationale: isValidationOnly
          ? "Strategic review of business capabilities before content production."
          : "Requires new page architecture, copy creation, and internal linking.",
        primaryOwner: "Content",
        secondaryOwners: ["SEO"],
        owners: ["Content", "SEO"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: false,
        timelineBucket: "DO_NEXT",
        blockedByActionIds: cov.technicalBlockers || [],
        blockingActionIds: [],
        whereToFix: "CMS / Content Structure",
        recommendedAction: isValidationOnly
          ? `Verify company offers services for '${cov.representativeLabel}' before allocating writing resources.`
          : `Draft and publish a dedicated page targeting '${cov.representativeLabel}'. Ensure unique value proposition before publishing.`,
        caution: "Validate service offering and business relevance before creating speculative content.",
        verificationInstructions: "Track GSC query impressions over subsequent 28-day window.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
      });
    }

    if (cov.decision === "IMPROVE_EXISTING_PAGE" && cov.dominantLandingPage) {
      const actionId = buildStableActionId("IMPROVE_PAGE", cov.clusterId, cov.dominantLandingPage);
      actions.push({
        actionId,
        projectId,
        type: "CONTENT_REFRESH_OPPORTUNITY",
        nature: "CONTENT_RECOMMENDATION",
        title: `Expand topic depth on ${cov.dominantLandingPage} for '${cov.representativeLabel}'`,
        description: cov.decisionRationale,
        underlyingRuleCodes: [],
        monitoringSignals: [],
        sourceSignals: ["GSC_SEARCH_DEMAND_INTELLIGENCE"],
        affectedUrls: [cov.dominantLandingPage],
        representativeUrls: [cov.dominantLandingPage],
        affectedUrlsCount: 1,
        estimatedRealEdits: 1,
        technicalSeverity: "info",
        actionPriority: cov.observedImpressions >= 3000 ? "HIGH" : "MEDIUM",
        whyThisPriority: [
          `Existing relevant page exists receiving ${cov.observedImpressions.toLocaleString()} GSC impressions.`,
          `Expand existing page rather than creating a competing duplicate page.`,
        ],
        effort: "LOW",
        effortRationale: "Content addition to existing published page.",
        primaryOwner: "Content",
        secondaryOwners: ["SEO"],
        owners: ["Content", "SEO"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: cov.observedImpressions >= 1000,
        quickWinRationale: cov.observedImpressions >= 1000 ? "Low-effort content expansion on high-demand existing page." : undefined,
        timelineBucket: "DO_NEXT",
        blockedByActionIds: cov.technicalBlockers || [],
        blockingActionIds: [],
        whereToFix: "Existing Page Body",
        recommendedAction: `Add subtopics (${(cov.missingTopicAreas || []).join(", ") || "core details"}) to existing page.`,
        caution: "Do NOT create a duplicate page; improve existing URL.",
        verificationInstructions: "Track ranking position improvement on targeted cluster.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
      });
    }
  }

  // 2. Bridge Cannibalization Findings
  for (const can of cannibalizationAssessments) {
    if (can.state === "LIKELY_CANNIBALIZATION") {
      const actionId = buildStableActionId("CANNIBALIZATION", can.clusterId, can.competingUrls[0] || "site");
      actions.push({
        actionId,
        projectId,
        type: "CONTENT_STRUCTURE_OPPORTUNITY",
        nature: "REVIEW_RECOMMENDED",
        title: `Review query cannibalization across ${can.competingUrls.length} pages for '${can.representativeLabel}'`,
        description: can.rationale,
        underlyingRuleCodes: [],
        monitoringSignals: [],
        sourceSignals: ["GSC_CANNIBALIZATION_DETECTOR"],
        affectedUrls: can.competingUrls,
        representativeUrls: can.competingUrls.slice(0, 2),
        affectedUrlsCount: can.competingUrls.length,
        estimatedRealEdits: 1,
        technicalSeverity: "info",
        actionPriority: "HIGH",
        whyThisPriority: [
          `Multiple URLs (${can.competingUrls.join(", ")}) alternate ranking dominance for '${can.representativeLabel}'.`,
        ],
        effort: "MEDIUM",
        effortRationale: "Editorial differentiation or canonical internal link consolidation.",
        primaryOwner: "SEO",
        secondaryOwners: ["Content"],
        owners: ["SEO", "Content"],
        ownerRoutingConfidence: "PRIMARY_AND_SECONDARY",
        pageImportanceStatus: "PAGE_IMPORTANCE_NOT_CONFIGURED",
        isQuickWin: false,
        timelineBucket: "DO_NEXT",
        blockedByActionIds: [],
        blockingActionIds: [],
        whereToFix: "Internal Links & Page Content",
        recommendedAction: can.remediationDetails,
        caution: can.protectAgainstMergingNote || "Do not automatically redirect either page.",
        verificationInstructions: "Verify stable primary URL dominance in GSC.",
        actionStatus: "OPEN",
        statusHistory: [{ status: "OPEN", timestamp: new Date().toISOString() }],
      });
    }
  }

  return actions;
}
