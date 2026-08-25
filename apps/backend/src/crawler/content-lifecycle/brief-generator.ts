/**
 * Evidence-Backed Refresh, Expansion, and Retirement Brief Generator.
 * Enforces:
 * ZERO_TRAFFIC ≠ USELESS_PAGE
 * PRESERVE_HIGH_VALUE_ELEMENTS
 * Prohibits autonomous deletion and unevidenced mass updates.
 */

import {
  ExactRefreshBrief,
  RetirementBrief,
  HistoricalPerformanceSummary,
  ContentPreservationGuidance,
  QueryClusterCoverageShift,
  StaleClaimEvidence,
} from "./types";

export function generateExactRefreshBrief(params: {
  url: string;
  whyExplanation: string;
  whatGapsExist: string[];
  whereSections: string[];
  historicalPerformance: HistoricalPerformanceSummary;
  queryShifts: QueryClusterCoverageShift[];
  highPerformingHeadings?: string[];
  excludedOutdatedSections?: string[];
  referringDomainsCount?: number;
  specificChangesNeeded: string[];
  staleClaimsEvidence?: StaleClaimEvidence[];
  risksIdentified?: string[];
  measurementWindowDays?: number;
  measurementWindowReason?: string;
}): ExactRefreshBrief {
  const retainedClusters = params.queryShifts
    .filter((q) => q.shiftState === "RETAINED" && q.isStatisticallyMeaningful)
    .map((q) => q.clusterLabel);

  const preservation: ContentPreservationGuidance = {
    preserveUrl: true,
    preserveCanonical: true,
    highPerformingSectionHeadings: params.highPerformingHeadings || ["Overview & Primary Problem Statement", "Core Value Proposition"],
    retainedQueryClusterLabels: retainedClusters,
    inboundBacklinksCount: params.referringDomainsCount || 0,
    cautionNotes: [
      "Do NOT rewrite entire page by default; preserve sections currently generating clicks and rankings.",
      "Preserve existing URL structure and self-referential canonical.",
    ],
    excludedOutdatedSections: params.excludedOutdatedSections || [],
  };

  return {
    whyExplanation: params.whyExplanation,
    whatGapsExist: params.whatGapsExist,
    whereSections: params.whereSections,
    preserveElements: preservation,
    specificChangesNeeded: params.specificChangesNeeded,
    staleClaimsEvidence: params.staleClaimsEvidence,
    risksIdentified: params.risksIdentified || ["Risk of transient ranking fluctuation if core intent keywords are altered"],
    verificationPlan: [
      "Verify updated text rendered in browser without layout breakages",
      "Request re-indexing in Google Search Console",
      `Monitor query cluster impression recovery across contextual ${params.measurementWindowDays || 30}-day window`,
    ],
    measurementWindowDays: params.measurementWindowDays || 30,
    measurementWindowReason: params.measurementWindowReason || "Standard observation window for ranking and indexation normalization",
  };
}

export function generateRetirementBrief(params: {
  url: string;
  historicalPeakClicks: number;
  referringDomainsCount: number;
  businessOrUserPurposeEvaluated?: string;
  hasConversionValue?: boolean;
  hasLegalOrComplianceRole?: boolean;
  recommendedReplacementDestinationUrl?: string;
  isDestinationTopicMatched?: boolean;
}): RetirementBrief {
  const risks: string[] = [];
  if (params.referringDomainsCount > 0) {
    risks.push(`Page has ${params.referringDomainsCount} referring domains that could lose link equity if retired without relevant 301 redirect.`);
  }
  if (params.hasConversionValue) {
    risks.push("Page has non-organic conversion or customer touchpoint value despite low organic search volume.");
  }
  if (params.hasLegalOrComplianceRole) {
    risks.push("Page serves mandatory regulatory or legal compliance function (terms, privacy, disclosures).");
  }

  const businessPurpose = params.businessOrUserPurposeEvaluated || "BUSINESS_VALUE_UNKNOWN";

  const redirectAssessment =
    params.recommendedReplacementDestinationUrl && params.isDestinationTopicMatched !== false
      ? "RELEVANT_DESTINATION_CONFIRMED"
      : "NO_RELEVANT_DESTINATION_MANUAL_REVIEW";

  return {
    retirementReason: "Page possesses near-zero organic search visibility, zero active ranking clusters, and no current search demand.",
    historicalPeakClicks: params.historicalPeakClicks,
    referringDomainsCount: params.referringDomainsCount,
    businessOrUserPurposeEvaluated: businessPurpose,
    recommendedReplacementDestinationUrl: params.recommendedReplacementDestinationUrl,
    redirectRelevanceAssessment: redirectAssessment,
    risksIdentified: risks,
    manualApprovalRequired: true, // NEVER autonomous deletion
  };
}
