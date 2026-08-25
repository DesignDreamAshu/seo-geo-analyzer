/**
 * Consolidation, Cannibalization Resolution & Multi-Factor Primary URL Selection Engine.
 * Evaluates overlapping pages, differentiates search intents, and provides transparent multi-dimensional equity breakdowns.
 */

import {
  ConsolidationBrief,
  ConsolidationConfidence,
  HistoricalPerformanceSummary,
  PrimaryUrlEquityBreakdown,
} from "./types";
import { ContentLifecyclePolicy, DEFAULT_CONTENT_LIFECYCLE_POLICY } from "./config";

export interface CandidateUrlEquity {
  url: string;
  historicalPerformance: HistoricalPerformanceSummary;
  referringDomainsCount: number;
  internalInlinksCount: number;
  isIndexIndexed: boolean;
  isCanonicalSelfReferencing: boolean;
  contentCompletenessWordCount?: number;
  conversionOrBusinessImportanceScore?: number;
  urlPathRelevanceScore?: number;
  isLocationSpecificPage?: boolean;
  locationCityOrRegion?: string;
  isLanguageOrRegionalVariant?: boolean;
  languageLocaleCode?: string;
  isHreflangSibling?: boolean;
  isMigratedSourceUrl?: boolean;
  hasComplianceRequirement?: boolean;
}

export interface ConsolidationEvaluationInput {
  competingUrls: CandidateUrlEquity[];
  overlappingClusterLabels: string[];
  isIntentGenuinelyDifferent?: boolean;
  intentDifferentiationRationale?: string;
  isRedirectDestinationHighlyRelevant?: boolean;
  policy?: ContentLifecyclePolicy;
}

export interface ConsolidationEvaluationResult {
  strategy: "CONSOLIDATE_AND_MERGE" | "DIFFERENTIATE_INTENT" | "KEEP_SEPARATE" | "PRIMARY_URL_MANUAL_REVIEW";
  recommendedPrimaryUrl?: string;
  primarySelectionRationale?: string;
  consolidationConfidence?: ConsolidationConfidence;
  requiresManualRedirectApproval?: boolean;
  equityBreakdowns?: Record<string, PrimaryUrlEquityBreakdown>;
  consolidationBrief?: ConsolidationBrief;
}

export function evaluateConsolidationAndPrimaryUrl(
  input: ConsolidationEvaluationInput
): ConsolidationEvaluationResult {
  const policy = input.policy || DEFAULT_CONTENT_LIFECYCLE_POLICY;
  const weights = policy.primaryUrlEquityWeights;
  const urls = input.competingUrls;

  if (urls.length < 2) {
    return { strategy: "KEEP_SEPARATE" };
  }

  // 1. Local & International Safety Gates
  const isLocationMismatch = urls.some((u) => u.isLocationSpecificPage) && new Set(urls.map((u) => u.locationCityOrRegion).filter(Boolean)).size > 1;
  const isLocaleMismatch = urls.some((u) => u.isLanguageOrRegionalVariant) && new Set(urls.map((u) => u.languageLocaleCode).filter(Boolean)).size > 1;
  const isHreflangGroup = urls.some((u) => u.isHreflangSibling);

  if (isLocationMismatch || isLocaleMismatch || isHreflangGroup) {
    return {
      strategy: "KEEP_SEPARATE",
      primarySelectionRationale: "Pages represent distinct localized branch locations or international language editions. Consolidation is prohibited to protect local/international SEO rankings.",
    };
  }

  // 2. Intent Differentiation Gate
  if (input.isIntentGenuinelyDifferent) {
    return {
      strategy: "DIFFERENTIATE_INTENT",
      primarySelectionRationale:
        input.intentDifferentiationRationale ||
        "Pages serve distinct search intents (e.g. informational guide vs commercial solution). Differentiate titles, internal links, and headings rather than merging.",
    };
  }

  // 3. Transparent Multi-Factor Primary URL Scoring Breakdown
  const equityBreakdowns: Record<string, PrimaryUrlEquityBreakdown> = {};
  let bestUrl = urls[0];
  let bestScore = -1;

  for (const item of urls) {
    const clicksVal = item.historicalPerformance.monthlyClicks;
    const clicksScore = clicksVal * weights.clicksWeight;

    const impVal = item.historicalPerformance.monthlyImpressions;
    const impScore = Math.round(impVal * weights.impressionsWeight);

    const rdVal = item.referringDomainsCount;
    const rdScore = rdVal * weights.referringDomainsWeight;

    const inlinksVal = item.internalInlinksCount;
    const inlinksScore = inlinksVal * weights.internalInlinksWeight;

    const indexScore = item.isIndexIndexed ? weights.indexationBonus : 0;
    const canonScore = item.isCanonicalSelfReferencing ? weights.canonicalStabilityBonus : 0;
    const bizScore = (item.conversionOrBusinessImportanceScore || 0) * weights.businessImportanceMultiplier;
    const wordCountVal = item.contentCompletenessWordCount || 0;
    const wordScore = Math.round(wordCountVal * weights.contentCompletenessMultiplier);
    const urlRelScore = (item.urlPathRelevanceScore || 0) * weights.urlRelevanceBonus;

    const totalEquityScore =
      clicksScore + impScore + rdScore + inlinksScore + indexScore + canonScore + bizScore + wordScore + urlRelScore;

    equityBreakdowns[item.url] = {
      clicksEquity: { value: clicksVal, weight: weights.clicksWeight, score: clicksScore },
      impressionsEquity: { value: impVal, weight: weights.impressionsWeight, score: impScore },
      referringDomainsEquity: { value: rdVal, weight: weights.referringDomainsWeight, score: rdScore },
      internalInlinksEquity: { value: inlinksVal, weight: weights.internalInlinksWeight, score: inlinksScore },
      indexationEquity: { isIndexed: item.isIndexIndexed, score: indexScore },
      canonicalStabilityEquity: { isSelfCanonical: item.isCanonicalSelfReferencing, score: canonScore },
      businessCriticalityEquity: { score: bizScore },
      contentCompletenessEquity: { wordCount: wordCountVal, score: wordScore },
      urlRelevanceEquity: { score: urlRelScore },
      totalEquityScore,
    };

    if (totalEquityScore > bestScore) {
      bestScore = totalEquityScore;
      bestUrl = item;
    }
  }

  // 4. Check for Strong Evidence Conflict (e.g. URL A dominates traffic, URL B dominates backlinks / business importance)
  const totalClicks = urls.reduce((acc, u) => acc + u.historicalPerformance.monthlyClicks, 0);
  const totalRds = urls.reduce((acc, u) => acc + u.referringDomainsCount, 0);

  const trafficLeader = urls.find((u) => totalClicks > 0 && u.historicalPerformance.monthlyClicks / totalClicks >= 0.7);
  const backlinkLeader = urls.find((u) => totalRds > 0 && u.referringDomainsCount / totalRds >= 0.7);

  const hasStrongConflict = Boolean(trafficLeader && backlinkLeader && trafficLeader.url !== backlinkLeader.url);

  let strategy: "CONSOLIDATE_AND_MERGE" | "DIFFERENTIATE_INTENT" | "KEEP_SEPARATE" | "PRIMARY_URL_MANUAL_REVIEW" = "CONSOLIDATE_AND_MERGE";
  let confidence: ConsolidationConfidence = "CONSOLIDATION_HIGH_CONFIDENCE";

  if (hasStrongConflict) {
    strategy = "PRIMARY_URL_MANUAL_REVIEW";
    confidence = "MANUAL_REVIEW";
  } else if (input.overlappingClusterLabels.length <= 1) {
    confidence = "CONSOLIDATION_MODERATE_CONFIDENCE";
  }

  // 5. Check High-Value Redirect Approval Requirement
  const secondaryUrls = urls.filter((u) => u.url !== bestUrl.url);
  const requiresManualRedirectApproval = secondaryUrls.some(
    (s) =>
      s.historicalPerformance.monthlyClicks >= 100 ||
      s.referringDomainsCount >= 5 ||
      s.hasComplianceRequirement ||
      Boolean(s.isMigratedSourceUrl)
  );

  const isRelevant = input.isRedirectDestinationHighlyRelevant !== false;
  const rationale = hasStrongConflict
    ? `Strong evidence conflict: '${trafficLeader?.url}' commands dominant search traffic (${trafficLeader?.historicalPerformance.monthlyClicks} clicks), while '${backlinkLeader?.url}' commands dominant backlink authority (${backlinkLeader?.referringDomainsCount} RDs). Primary destination requires manual human review.`
    : `Primary URL '${bestUrl.url}' selected based on highest cumulative equity score (${bestScore} pts). Score breakdown: Clicks (+${equityBreakdowns[bestUrl.url].clicksEquity.score}), Backlinks (+${equityBreakdowns[bestUrl.url].referringDomainsEquity.score}), Inlinks (+${equityBreakdowns[bestUrl.url].internalInlinksEquity.score}), Indexation (+${equityBreakdowns[bestUrl.url].indexationEquity.score}).`;

  const consolidationBrief: ConsolidationBrief = {
    competingUrls: urls.map((u) => u.url),
    overlappingClusterLabels: input.overlappingClusterLabels,
    recommendedPrimaryUrl: bestUrl.url,
    primarySelectionReason: rationale,
    equityBreakdowns,
    consolidationConfidence: confidence,
    requiresManualRedirectApproval,
    uniqueContentToPreserve: [
      `Unique subtopics and case examples from secondary URLs: ${secondaryUrls.map((s) => s.url).join(", ")}`,
      "High-value query cluster headings with demonstrated search demand",
    ],
    backlinkConsiderations: `Preserve ${bestUrl.referringDomainsCount} referring domains on primary; 301 redirect secondary pages possessing inbound links.`,
    redirectRecommendation: isRelevant
      ? `Implement permanent 301 redirects from [${secondaryUrls.map((s) => s.url).join(", ")}] to primary destination '${bestUrl.url}'. (Manual Approval: ${requiresManualRedirectApproval ? "REQUIRED" : "NOT_REQUIRED"})`
      : "Destination topic mismatch: Secondary page retirement requires manual review before configuring redirect.",
    internalLinkUpdatesNeeded: secondaryUrls.map(
      (s) => `Update all internal inlinks pointing to '${s.url}' to point directly to '${bestUrl.url}'`
    ),
    sitemapCanonicalUpdates: [
      `Ensure '${bestUrl.url}' is in XML sitemap with self-referential rel=canonical`,
      ...secondaryUrls.map((s) => `Remove '${s.url}' from XML sitemaps once 301 redirect is deployed`),
    ],
    postConsolidationVerification: [
      "Verify 301 HTTP status code with 0 redirect chains",
      "Verify primary URL indexation and ranking retention in Google Search Console",
      "Validate internal link equity transfer across updated anchor texts",
    ],
  };

  return {
    strategy,
    recommendedPrimaryUrl: bestUrl.url,
    primarySelectionRationale: rationale,
    consolidationConfidence: confidence,
    requiresManualRedirectApproval,
    equityBreakdowns,
    consolidationBrief,
  };
}
