/**
 * Hardened Cannibalization Intelligence Engine.
 * Detects harmful query overlap while strictly protecting intentional multi-page visibility.
 * Provides staged remediation without destructive automated redirect prescriptions.
 */

import { CannibalizationAssessment, CannibalizationState, QueryCluster } from "./types";
import { DemandScalePolicy, DEFAULT_DEMAND_POLICY } from "./config";

export function evaluateCannibalization(
  cluster: QueryCluster,
  previousPeriodDominantLp?: string,
  policy: DemandScalePolicy = DEFAULT_DEMAND_POLICY
): CannibalizationAssessment | null {
  // 1. If only 1 landing page -> No multi-page cannibalization
  if (cluster.landingPages.length <= 1) {
    return null;
  }

  // 2. Low Volume Sample Guard
  if (cluster.totalObservedImpressions < policy.minImpressionsForCannibalization) {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      competingUrls: cluster.landingPages,
      state: "INSUFFICIENT_DATA",
      intentSimilarity: "LOW",
      contentOverlap: "LOW",
      hasStableDominantUrl: true,
      dominantUrl: cluster.dominantLandingPage,
      confidence: "LOW_CONFIDENCE",
      remediationRecommendation: "NO_ACTION",
      remediationDetails: "No action required; sample volume too low to assess cannibalization.",
      rationale: `Cluster volume (${cluster.totalObservedImpressions} impressions) is below policy threshold (${policy.minImpressionsForCannibalization}).`,
    };
  }

  const urls = cluster.landingPages;

  // 3. Safeguard A: Branded Search (Homepage + About / Contact / Careers)
  if (cluster.brandState === "BRANDED") {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      competingUrls: urls,
      state: "HEALTHY_MULTI_PAGE_VISIBILITY",
      intentSimilarity: "LOW",
      contentOverlap: "LOW",
      hasStableDominantUrl: true,
      dominantUrl: cluster.dominantLandingPage,
      confidence: "HIGH_CONFIDENCE",
      remediationRecommendation: "NO_ACTION",
      remediationDetails: "No action required. Natural branded multi-page visibility.",
      rationale: "Multiple brand pages ranking for brand queries is expected and healthy.",
      protectAgainstMergingNote: "Do not merge or redirect distinct brand assets (Homepage, About, Contact).",
    };
  }

  // 4. Safeguard B: Service + Case Study Synergy
  const hasService = urls.some((u) => u.includes("/services/"));
  const hasCaseStudy = urls.some((u) => u.includes("/case-studies/") || u.includes("/case-study/"));
  if (hasService && hasCaseStudy && urls.length === 2) {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      competingUrls: urls,
      state: "QUERY_INTENT_SPLIT",
      intentSimilarity: "MEDIUM",
      contentOverlap: "LOW",
      hasStableDominantUrl: true,
      dominantUrl: cluster.dominantLandingPage,
      confidence: "HIGH_CONFIDENCE",
      remediationRecommendation: "NO_ACTION",
      remediationDetails: "No action. Distinct commercial (service) and proof (case study) intents.",
      rationale: "Service page and case study serve complementary commercial vs social-proof user intents.",
      protectAgainstMergingNote: "Do not merge case study into core service page.",
    };
  }

  // 5. Safeguard C: Category Hub + Product / Specific Subtopic / Parent-Child URL hierarchy
  const isParentChild = urls.some((u1) =>
    urls.some((u2) => u1 !== u2 && u2.startsWith(u1.replace(/\/$/, "") + "/"))
  );
  const hasSpecificItem = urls.some((u) => u.includes("/post") || u.includes("/item") || u.includes("/product"));
  if ((isParentChild || hasSpecificItem) && urls.length === 2) {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      competingUrls: urls,
      state: "HEALTHY_MULTI_PAGE_VISIBILITY",
      intentSimilarity: "MEDIUM",
      contentOverlap: "LOW",
      hasStableDominantUrl: true,
      dominantUrl: cluster.dominantLandingPage,
      confidence: "HIGH_CONFIDENCE",
      remediationRecommendation: "NO_ACTION",
      remediationDetails: "No action. Standard category hub and specific child item hierarchy.",
      rationale: "Parent category and child detail page hierarchy.",
    };
  }

  // 6. Safeguard D: Guide + FAQ Synergy
  const hasGuide = urls.some((u) => u.includes("/guide") || u.includes("/article"));
  const hasFaq = urls.some((u) => u.includes("/faq"));
  if (hasGuide && hasFaq && urls.length === 2) {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      competingUrls: urls,
      state: "HEALTHY_MULTI_PAGE_VISIBILITY",
      intentSimilarity: "MEDIUM",
      contentOverlap: "LOW",
      hasStableDominantUrl: true,
      dominantUrl: cluster.dominantLandingPage,
      confidence: "HIGH_CONFIDENCE",
      remediationRecommendation: "NO_ACTION",
      remediationDetails: "No action. Structured FAQ and in-depth guide hierarchy.",
      rationale: "FAQ item and comprehensive guide serve distinct search intents.",
    };
  }

  // 7. Detected True Cannibalization: Similar URLs switching dominance
  const isSwitching = previousPeriodDominantLp && cluster.dominantLandingPage && previousPeriodDominantLp !== cluster.dominantLandingPage;
  const state: CannibalizationState = isSwitching ? "LIKELY_CANNIBALIZATION" : "CANNIBALIZATION_CANDIDATE";

  return {
    clusterId: cluster.clusterId,
    representativeLabel: cluster.representativeLabel,
    competingUrls: urls,
    state,
    intentSimilarity: "HIGH",
    contentOverlap: "HIGH",
    hasStableDominantUrl: !isSwitching,
    dominantUrl: cluster.dominantLandingPage,
    confidence: isSwitching ? "HIGH_CONFIDENCE" : "MEDIUM_CONFIDENCE",
    remediationRecommendation: isSwitching ? "REVIEW_INTENT_DIFFERENTIATION" : "INTERNAL_LINK_TARGET_REVIEW",
    remediationDetails: "Review page differentiation and designate a single canonical search target via internal linking.",
    rationale: `Multiple pages (${urls.join(", ")}) share high content overlap for '${cluster.representativeLabel}' without clear intent differentiation.`,
    protectAgainstMergingNote: "Do NOT automatically redirect either page; evaluate editorial differentiation first.",
  };
}
