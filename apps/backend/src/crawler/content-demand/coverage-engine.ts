/**
 * Hardened Search Demand Coverage & Decision Engine.
 * Evaluates multi-signal content truth, enforces business relevance validation,
 * and prioritizes improving existing pages over creating new speculative pages.
 */

import {
  ContentCoverageAssessment,
  ContentDecision,
  DemandCoverageState,
  QueryCluster,
} from "./types";
import { evaluateLandingPageFit, evaluateQueryPageStability, PageMetadataSummary } from "./fit-evaluator";
import { DemandScalePolicy, DEFAULT_DEMAND_POLICY } from "./config";

export function assessContentCoverage(
  cluster: QueryCluster,
  pageSummary?: PageMetadataSummary,
  siteKnownUrls: string[] = [],
  previousPeriodDominantLp?: string,
  policy: DemandScalePolicy = DEFAULT_DEMAND_POLICY,
  isBusinessRelevanceValidated: boolean = false,
  isPeriodMismatched: boolean = false
): ContentCoverageAssessment {
  const fitRes = evaluateLandingPageFit(cluster, pageSummary);
  const stability = evaluateQueryPageStability(
    cluster,
    previousPeriodDominantLp,
    policy.minImpressionsForCannibalization,
    isPeriodMismatched
  );

  let coverageState: DemandCoverageState = "UNKNOWN";
  let decision: ContentDecision = "NO_ACTION";
  let decisionRationale = "";
  const missingTopicAreas: string[] = [];
  const technicalBlockers: string[] = [];

  // 1. Check Technical Blockers on Dominant Page
  if (pageSummary) {
    if (pageSummary.isNoindex) {
      technicalBlockers.push("INDEXABILITY_NOINDEX");
    }
    if (pageSummary.statusCode && pageSummary.statusCode >= 400) {
      technicalBlockers.push(`STATUS_${pageSummary.statusCode}`);
    }
  }

  // 2. Identify existing candidate URLs matching cluster topic
  const clusterWords = cluster.representativeLabel.toLowerCase().split(" ").filter((w) => w.length > 3);
  const candidateUrls = siteKnownUrls.filter((url) => {
    const p = url.toLowerCase();
    return clusterWords.some((w) => p.includes(w));
  });

  const hasDedicatedExistingPage = candidateUrls.length > 0;

  // 3. Multi-Signal Content Coverage Evaluation (NOT ranking position alone)
  // Well-served requires strong content fit + good ranking + stability + no technical defects
  if (
    fitRes.fit === "STRONG_FIT" &&
    cluster.averagePosition <= policy.maxRankingPositionForStrongFitBonus &&
    stability === "STABLE" &&
    technicalBlockers.length === 0
  ) {
    coverageState = "WELL_SERVED";
    decision = "NO_ACTION";
    decisionRationale = `Query cluster is well-served by dominant landing page (${cluster.dominantLandingPage}) with strong content fit and stable top ranking.`;
  } else if (fitRes.fit === "STRONG_FIT") {
    coverageState = "PARTIALLY_SERVED";
    decision = "IMPROVE_EXISTING_PAGE";
    const targetUrl = cluster.dominantLandingPage || candidateUrls[0];
    decisionRationale = `Existing relevant page exists ([${targetUrl}]). Expand topic depth and strengthen internal links rather than creating a competing duplicate page.`;

    // Extract weak subtopics from modifiers
    for (const mod of cluster.modifiers) {
      if (!((pageSummary?.title || "").toLowerCase().includes(mod))) {
        missingTopicAreas.push(mod);
      }
    }
  } else if (fitRes.fit === "PARTIAL_FIT") {
    coverageState = "PARTIALLY_SERVED";
    if (
      cluster.totalObservedImpressions >= policy.minImpressionsForNewPageCandidate &&
      cluster.primaryIntent === "COMMERCIAL_INVESTIGATION" &&
      !hasDedicatedExistingPage
    ) {
      if (isBusinessRelevanceValidated) {
        coverageState = "UNSERVED_CANDIDATE";
        decision = "CREATE_NEW_PAGE_CANDIDATE";
        decisionRationale = `Verified commercial demand (${cluster.totalObservedImpressions.toLocaleString()} impressions) with validated business offering and no dedicated page on site.`;
      } else {
        coverageState = "UNSERVED_CANDIDATE";
        decision = "VALIDATION_REQUIRED";
        decisionRationale = `Observed first-party demand (${cluster.totalObservedImpressions.toLocaleString()} impressions) with commercial intent, but business/service offering relevance requires manual validation before authoring.`;
      }
    } else {
      decision = "IMPROVE_EXISTING_PAGE";
      decisionRationale = `Broader parent category page exists. Add a dedicated section to [${cluster.dominantLandingPage}] before considering a new standalone URL.`;
    }
  } else if (fitRes.fit === "MISMATCH" || fitRes.fit === "WEAK_FIT") {
    if (cluster.totalObservedImpressions >= policy.minImpressionsForNewPageCandidate && !hasDedicatedExistingPage) {
      if (isBusinessRelevanceValidated) {
        coverageState = "UNSERVED_CANDIDATE";
        decision = "CREATE_NEW_PAGE_CANDIDATE";
        decisionRationale = `Significant observed search demand (${cluster.totalObservedImpressions.toLocaleString()} impressions) landing on generic/mismatched page. Business relevance validated. No dedicated page exists on site.`;
      } else {
        coverageState = "UNSERVED_CANDIDATE";
        decision = "VALIDATION_REQUIRED";
        decisionRationale = `Observed search demand (${cluster.totalObservedImpressions.toLocaleString()} impressions) landing on weak page. Requires business offering verification.`;
      }
    } else if (hasDedicatedExistingPage) {
      coverageState = "WEAKLY_SERVED";
      decision = "INTERNAL_LINK_EXISTING_PAGE";
      decisionRationale = `Demand is landing on weak URL, but a dedicated candidate exists ([${candidateUrls[0]}]). Strengthen internal links to direct authority to the proper page.`;
    } else {
      coverageState = "WEAKLY_SERVED";
      decision = "MANUAL_REVIEW";
      decisionRationale = `Demand is landing on weak page. Evaluate whether to expand an existing parent page or create a dedicated asset.`;
    }
  }

  return {
    clusterId: cluster.clusterId,
    representativeLabel: cluster.representativeLabel,
    observedImpressions: cluster.totalObservedImpressions,
    primaryIntent: cluster.primaryIntent,
    dominantLandingPage: cluster.dominantLandingPage,
    landingPageFit: fitRes.fit,
    landingPageFitConfidence: fitRes.confidence,
    queryPageStability: stability,
    coverageState,
    decision,
    decisionRationale,
    isBusinessRelevanceValidated,
    missingTopicAreas: missingTopicAreas.slice(0, 5),
    existingCandidateUrls: candidateUrls,
    confidence: cluster.clusteringConfidence === "HIGH_CONFIDENCE" ? "HIGH_CONFIDENCE" : "MEDIUM_CONFIDENCE",
    technicalBlockers: technicalBlockers.length > 0 ? technicalBlockers : undefined,
  };
}
