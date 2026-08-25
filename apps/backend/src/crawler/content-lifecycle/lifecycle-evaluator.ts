/**
 * Master Content Lifecycle Evaluator.
 * Orchestrates multi-window statistical trends, alternative non-content gating, staleness detection,
 * intent differentiation, and brief generation into an auditable lifecycle assessment.
 */

import {
  ContentLifecycleAssessment,
  ContentLifecycleState,
  ContentLifecycleAction,
  ContentChangeRisk,
  HistoricalPerformanceSummary,
  RefreshMeasurementEvaluation,
} from "./types";
import { analyzePerformanceTrends } from "./trend-analyzer";
import { evaluateNonContentDeclineGating } from "./gating-evaluator";
import { evaluateContentStaleness } from "./staleness-detector";
import { evaluateConsolidationAndPrimaryUrl, CandidateUrlEquity } from "./consolidation-engine";
import { generateExactRefreshBrief, generateRetirementBrief } from "./brief-generator";
import { ContentLifecyclePolicy, DEFAULT_CONTENT_LIFECYCLE_POLICY } from "./config";

export interface LifecycleEvaluationInput {
  projectId: string;
  url: string;
  pageType?: string;
  recentPerformance: HistoricalPerformanceSummary;
  baselinePerformance?: HistoricalPerformanceSummary;
  historicalIntervalMonthlyClicks?: number[];
  queryClusterBaselineImpressions?: Record<string, number>;
  queryClusterCurrentImpressions?: Record<string, number>;
  queryClusterLabels?: Record<string, string>;
  queryClusterBaselinePositions?: Record<string, number>;
  queryClusterCurrentPositions?: Record<string, number>;

  // Alternative Context Inputs
  isTechnicalDefectPresent?: boolean;
  technicalDefectReason?: string;
  isGoogleIndexBlocked?: boolean;
  googleIndexState?: string;
  isMigrationTransitionActive?: boolean;
  isSeasonallyCyclical?: boolean;
  isClusterDemandDeclining?: boolean;
  clusterDemandDropPercent?: number;
  isSerpCompetitorOvertaking?: boolean;
  serpCompetitorObservation?: string;
  isSerpLayoutChanged?: boolean;
  serpLayoutChangeDescription?: string;
  isCannibalizationActive?: boolean;

  // Staleness Inputs
  publishedDate?: string;
  lastUpdatedDate?: string;
  outdatedYearReferences?: number[];
  isHistoricalContext?: boolean;
  isArchivedEvent?: boolean;
  isTaxGuideForTaxYear?: boolean;
  isClaimingOutdatedYearIsCurrent?: boolean;
  isRecurringAnnualPage?: boolean;
  hasPricingOrServiceTiers?: boolean;
  hasRegulatoryOrLegalCommitments?: boolean;
  hasSoftwareVersionReferences?: boolean;
  hasUpcomingEventDates?: boolean;
  hasStockOrAvailabilitySignals?: boolean;
  hasDynamicBusinessPolicy?: boolean;
  isEvergreenDefinition?: boolean;
  outdatedPricingDetected?: boolean;
  currentPricingSource?: string;
  expiredEventDetected?: boolean;
  obsoleteSoftwareVersionDetected?: boolean;
  currentSoftwareVersionSource?: string;
  isFakeFreshnessAttemptDetected?: boolean;

  // Consolidation / Cannibalization Inputs
  competingUrls?: CandidateUrlEquity[];
  overlappingClusterLabels?: string[];
  isIntentGenuinelyDifferent?: boolean;
  intentDifferentiationRationale?: string;

  // Expansion & Content Gaps
  missingSubtopicGaps?: string[];
  isOwnQueryEvidenceSupported?: boolean;
  isSerpIntentRelevanceVerified?: boolean;
  highPerformingHeadings?: string[];
  excludedOutdatedSections?: string[];

  // Business & Retirement Inputs
  hasConversionValue?: boolean;
  hasLegalOrComplianceRole?: boolean;
  businessOrUserPurpose?: string;
  recommendedReplacementUrl?: string;
  isDestinationTopicMatched?: boolean;
  isSystemicTemplateException?: boolean;

  // Post-Refresh Measurement Verification Inputs
  isImplementationVerified?: boolean;
  isPageCrawlableAndIndexable?: boolean;
  hasGscDataCompleteness?: boolean;
  minimumObservationDaysMet?: boolean;
  hasUnresolvedMigrationBlocker?: boolean;
  postRefreshObservedClicksChangePercent?: number;
  postRefreshObservedCtrChangePercent?: number;
  confoundingFactorsObserved?: string[];

  policy?: ContentLifecyclePolicy;
}

export function evaluateContentLifecycle(input: LifecycleEvaluationInput): ContentLifecycleAssessment {
  const policy = input.policy || DEFAULT_CONTENT_LIFECYCLE_POLICY;
  const pageType = input.pageType || "blog";
  const typePolicy = policy.pageTypePolicies[pageType] || policy.pageTypePolicies.blog;
  const uncertaintyReasons: string[] = [];

  const isCompliancePage =
    Boolean(input.hasLegalOrComplianceRole) ||
    pageType === "legal" ||
    pageType === "terms" ||
    pageType === "privacy" ||
    input.url.includes("/privacy") ||
    input.url.includes("/terms") ||
    input.url.includes("/legal") ||
    input.url.includes("/accessibility");

  // 1. Evidence Quality Check
  const isZeroTraffic = input.recentPerformance.monthlyClicks <= 2 && input.recentPerformance.monthlyImpressions < 50;
  const isLowVolumeSample =
    !input.baselinePerformance &&
    input.recentPerformance.monthlyImpressions < policy.minMonthlyImpressionsForEvaluation &&
    !isZeroTraffic &&
    !isCompliancePage;

  if (isLowVolumeSample) {
    return {
      projectId: input.projectId,
      url: input.url,
      pageType,
      freshnessSensitivity: typePolicy.defaultFreshnessSensitivity,
      lifecycleState: "INSUFFICIENT_EVIDENCE",
      primaryAction: "MONITOR",
      changeRisk: "LOW_CHANGE_RISK",
      trendShape: "INCONCLUSIVE_TREND",
      observedSignals: [],
      recentPerformance: input.recentPerformance,
      queryClusterShifts: [],
      isTechnicalBlocked: !!input.isTechnicalDefectPresent,
      isGoogleIndexBlocked: !!input.isGoogleIndexBlocked,
      isMigrationTransition: !!input.isMigrationTransitionActive,
      isSeasonallyDriven: false,
      isDemandDriven: false,
      isSerpCompetitorDriven: false,
      isSerpLayoutConfounded: false,
      isCannibalizationPressure: false,
      isComplianceProtected: false,
      isSystemicTemplateException: input.isSystemicTemplateException,
      confidence: "INSUFFICIENT_EVIDENCE",
      uncertaintyReasons: ["Insufficient search volume and baseline observation data for lifecycle diagnosis"],
      policySelected: policy.policyName,
      thresholdsUsed: { minMonthlyImpressions: policy.minMonthlyImpressionsForEvaluation },
      policySource: policy.policySource,
      reasonClassificationTriggered: "INSUFFICIENT_EVIDENCE: Volume below statistical threshold",
      modelVersion: policy.modelVersion,
      policyVersion: policy.policyVersion,
    };
  }

  // 2. Multi-Window Trend Analysis
  const trends = analyzePerformanceTrends({
    recent: input.recentPerformance,
    baseline: input.baselinePerformance,
    historicalIntervalMonthlyClicks: input.historicalIntervalMonthlyClicks,
    queryClusterBaselineImpressions: input.queryClusterBaselineImpressions,
    queryClusterCurrentImpressions: input.queryClusterCurrentImpressions,
    queryClusterLabels: input.queryClusterLabels,
    queryClusterBaselinePositions: input.queryClusterBaselinePositions,
    queryClusterCurrentPositions: input.queryClusterCurrentPositions,
    policy,
  });

  // 3. Non-Content Alternative Explanation Gating
  const isCtrDominant =
    trends.ctrChangePercent <= -policy.pageTypePolicies[pageType]?.maxAcceptableCtrDropPercent &&
    Math.abs(trends.impressionChangePercent) < 20 &&
    (input.recentPerformance.monthlyImpressions >= policy.minImpressionsForCtrDecayEvaluation || (input.baselinePerformance?.monthlyImpressions || 0) >= policy.minImpressionsForCtrDecayEvaluation) &&
    Math.abs(trends.positionChange) <= policy.maxPositionVarianceForCtrDecay &&
    !input.isSerpLayoutChanged;

  const gating = evaluateNonContentDeclineGating({
    url: input.url,
    isTechnicalDefectPresent: input.isTechnicalDefectPresent,
    technicalDefectReason: input.technicalDefectReason,
    isGoogleIndexBlocked: input.isGoogleIndexBlocked,
    googleIndexState: input.googleIndexState,
    isMigrationTransitionActive: input.isMigrationTransitionActive,
    isSeasonallyCyclical: input.isSeasonallyCyclical,
    isClusterDemandDeclining: input.isClusterDemandDeclining,
    clusterDemandDropPercent: input.clusterDemandDropPercent,
    isSerpCompetitorOvertaking: input.isSerpCompetitorOvertaking,
    serpCompetitorObservation: input.serpCompetitorObservation,
    isSerpLayoutChanged: input.isSerpLayoutChanged,
    serpLayoutChangeDescription: input.serpLayoutChangeDescription,
    isCtrDropDominant: isCtrDominant,
    ctrDropImpressionsVolume: input.recentPerformance.monthlyImpressions,
    positionVariance: Math.abs(trends.positionChange),
    isCannibalizationActive: input.isCannibalizationActive,
    policy,
  });

  // 4. Content Staleness & Fake Freshness
  const staleness = evaluateContentStaleness({
    url: input.url,
    pageType,
    publishedDate: input.publishedDate,
    lastUpdatedDate: input.lastUpdatedDate,
    freshnessSensitivity: typePolicy.defaultFreshnessSensitivity,
    outdatedYearReferences: input.outdatedYearReferences,
    isHistoricalContext: input.isHistoricalContext,
    isArchivedEvent: input.isArchivedEvent,
    isTaxGuideForTaxYear: input.isTaxGuideForTaxYear,
    isClaimingOutdatedYearIsCurrent: input.isClaimingOutdatedYearIsCurrent,
    isRecurringAnnualPage: input.isRecurringAnnualPage,
    hasPricingOrServiceTiers: input.hasPricingOrServiceTiers,
    hasRegulatoryOrLegalCommitments: input.hasRegulatoryOrLegalCommitments,
    hasSoftwareVersionReferences: input.hasSoftwareVersionReferences,
    hasUpcomingEventDates: input.hasUpcomingEventDates,
    hasStockOrAvailabilitySignals: input.hasStockOrAvailabilitySignals,
    hasDynamicBusinessPolicy: input.hasDynamicBusinessPolicy,
    isEvergreenDefinition: input.isEvergreenDefinition,
    outdatedPricingDetected: input.outdatedPricingDetected,
    currentPricingSource: input.currentPricingSource,
    expiredEventDetected: input.expiredEventDetected,
    obsoleteSoftwareVersionDetected: input.obsoleteSoftwareVersionDetected,
    currentSoftwareVersionSource: input.currentSoftwareVersionSource,
    isFakeFreshnessAttemptDetected: input.isFakeFreshnessAttemptDetected,
  });

  if (staleness.fakeFreshnessWarning) {
    uncertaintyReasons.push(staleness.fakeFreshnessWarning);
  }

  // 5. Determine Primary Lifecycle State & Action
  let lifecycleState: ContentLifecycleState = "HEALTHY";
  let primaryAction: ContentLifecycleAction = "KEEP_AS_IS";
  let changeRisk: ContentChangeRisk = "LOW_CHANGE_RISK";
  let confidence: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_EVIDENCE" = trends.confidenceAdjustment;
  let reasonClassificationTriggered = "Page performance metrics are stable within expected baseline parameters.";

  // A. Check Compliance Protection First for Low/Zero Traffic Pages
  if (isCompliancePage) {
    lifecycleState = "RETIREMENT_NOT_APPLICABLE";
    primaryAction = "KEEP_AS_IS";
    changeRisk = "LOW_CHANGE_RISK";
    confidence = "HIGH";
    reasonClassificationTriggered = "Page serves mandatory compliance, legal, terms, or privacy function. Retirement is suppressed.";
  } else if (gating.isGatedByAlternativeExplanation && gating.gatedLifecycleState && gating.gatedRecommendedAction) {
    // B. Check Gated Alternative Explanations
    lifecycleState = gating.gatedLifecycleState;
    primaryAction = gating.gatedRecommendedAction;
    reasonClassificationTriggered = gating.explanation;
    uncertaintyReasons.push(gating.explanation);
    if (lifecycleState === "SERP_LAYOUT_CONFOUNDING") {
      confidence = "MODERATE";
    }
  } else if (input.competingUrls && input.competingUrls.length >= 2) {
    // C. Consolidation / Cannibalization Flow
    const consolRes = evaluateConsolidationAndPrimaryUrl({
      competingUrls: input.competingUrls,
      overlappingClusterLabels: input.overlappingClusterLabels || [],
      isIntentGenuinelyDifferent: input.isIntentGenuinelyDifferent,
      intentDifferentiationRationale: input.intentDifferentiationRationale,
      policy,
    });

    if (consolRes.strategy === "KEEP_SEPARATE") {
      lifecycleState = "HEALTHY";
      primaryAction = "KEEP_AS_IS";
      reasonClassificationTriggered = consolRes.primarySelectionRationale || "Local or international safety gates protect URLs from consolidation.";
    } else if (consolRes.strategy === "DIFFERENTIATE_INTENT") {
      lifecycleState = "CANNIBALIZATION_PRESSURE";
      primaryAction = "DIFFERENTIATE_INTENT";
      changeRisk = "MODERATE_CHANGE_RISK";
      reasonClassificationTriggered = consolRes.primarySelectionRationale || "Pages serve distinct user search intents; differentiate content and headings.";
    } else if (consolRes.strategy === "PRIMARY_URL_MANUAL_REVIEW") {
      lifecycleState = "CONSOLIDATION_CANDIDATE";
      primaryAction = "PRIMARY_URL_MANUAL_REVIEW";
      changeRisk = "HIGH_CHANGE_RISK";
      confidence = "MANUAL_REVIEW" as any;
      reasonClassificationTriggered = "Strongly conflicting equity evidence across competing URLs. Manual primary selection review required.";
    } else {
      lifecycleState = "CONSOLIDATION_CANDIDATE";
      primaryAction = "CONSOLIDATE";
      changeRisk = "HIGH_CHANGE_RISK";
      reasonClassificationTriggered = consolRes.primarySelectionRationale || "Intent redundancy identified; consolidate equity to primary URL.";
    }
  } else if (trends.isMaterialDecline && trends.clickChangePercent <= -typePolicy.decayMinTrafficDropPercent) {
    // D. Material Content Decay
    if (staleness.isContentStale) {
      lifecycleState = "CONFIRMED_DECAY";
      primaryAction = "REFRESH";
      reasonClassificationTriggered = `Confirmed content decay (${trends.clickChangePercent}% click drop) combined with factual staleness.`;
    } else if (input.missingSubtopicGaps && input.missingSubtopicGaps.length > 0 && (input.isOwnQueryEvidenceSupported || input.isSerpIntentRelevanceVerified)) {
      lifecycleState = "EXPANSION_CANDIDATE";
      primaryAction = "EXPAND";
      reasonClassificationTriggered = `Content coverage gap identified with verified own-query or SERP intent relevance (${input.missingSubtopicGaps.length} gaps).`;
    } else {
      lifecycleState = "CONFIRMED_DECAY";
      primaryAction = "REFRESH";
      reasonClassificationTriggered = `Confirmed progressive traffic decay (${trends.clickChangePercent}% click drop) across multiple intervals.`;
    }
    changeRisk = input.recentPerformance.monthlyClicks > 200 ? "MODERATE_CHANGE_RISK" : "LOW_CHANGE_RISK";
  } else if (staleness.isContentStale) {
    // E. Factual Staleness Risk (Early Warning)
    lifecycleState = "CONTENT_STALENESS_RISK";
    const hasUnverifiedClaims = staleness.staleClaims.some((c) => c.status === "MANUAL_FACT_VERIFICATION_REQUIRED");
    primaryAction = hasUnverifiedClaims ? "MANUAL_FACT_VERIFICATION_REQUIRED" : "UPDATE_FACTUAL_INFORMATION";
    changeRisk = "LOW_CHANGE_RISK";
    reasonClassificationTriggered = "Factual staleness detected (outdated pricing, past dates, or software version references).";
  } else if (isZeroTraffic) {
    // F. Zero-Traffic Page Evaluation
    if (!input.businessOrUserPurpose && !input.hasConversionValue) {
      lifecycleState = "BUSINESS_VALUE_UNKNOWN";
      primaryAction = "MANUAL_REVIEW";
      changeRisk = "MODERATE_CHANGE_RISK";
      reasonClassificationTriggered = "Zero organic traffic with unknown business/conversion/navigation role. Manual review required.";
    } else {
      lifecycleState = "RETIREMENT_REVIEW";
      primaryAction = "MANUAL_REVIEW";
      changeRisk = "MODERATE_CHANGE_RISK";
      reasonClassificationTriggered = "Near-zero organic search volume evaluated with documented business purpose. Prohibits autonomous deletion.";
    }
  } else if (trends.trendShape === "SUSTAINED_GROWTH") {
    lifecycleState = "GROWING";
    primaryAction = "KEEP_AS_IS";
    reasonClassificationTriggered = `Sustained growth trend observed (+${trends.clickChangePercent}% clicks).`;
  } else {
    lifecycleState = "STABLE";
    primaryAction = "KEEP_AS_IS";
    reasonClassificationTriggered = "Stable plateau performance observed across evaluation windows.";
  }

  // 6. Brief Generation
  let refreshBrief = undefined;
  if (primaryAction === "REFRESH" || primaryAction === "EXPAND" || primaryAction === "UPDATE_FACTUAL_INFORMATION" || primaryAction === "MANUAL_FACT_VERIFICATION_REQUIRED") {
    const gaps: string[] = [];
    if (staleness.staleSections.length > 0) gaps.push(`Factual updates needed: ${staleness.staleSections.join(", ")}`);
    if (input.missingSubtopicGaps) gaps.push(...input.missingSubtopicGaps);

    refreshBrief = generateExactRefreshBrief({
      url: input.url,
      whyExplanation: `Performance trend shows ${trends.clickChangePercent}% click change across ${trends.queryShifts.filter((q) => q.shiftState === "LOST" && q.isStatisticallyMeaningful).length} lost query clusters.`,
      whatGapsExist: gaps.length > 0 ? gaps : ["Content topical depth and intent alignment update"],
      whereSections: staleness.staleSections.length > 0 ? staleness.staleSections : ["Main Body & Subtopic Sections"],
      historicalPerformance: input.baselinePerformance || input.recentPerformance,
      queryShifts: trends.queryShifts,
      highPerformingHeadings: input.highPerformingHeadings,
      excludedOutdatedSections: input.excludedOutdatedSections,
      referringDomainsCount: input.recentPerformance.referringDomainsCount,
      specificChangesNeeded: [
        "Update stale factual information and date context",
        "Address missing intent subtopics identified in verified search query evidence",
        "Preserve existing high-performing core headings and canonical URL",
      ],
      staleClaimsEvidence: staleness.staleClaims,
      measurementWindowDays: typePolicy.measurementWindowDays,
      measurementWindowReason: typePolicy.measurementWindowReason,
    });
  }

  let consolidationBrief = undefined;
  if ((primaryAction === "CONSOLIDATE" || primaryAction === "PRIMARY_URL_MANUAL_REVIEW") && input.competingUrls && input.competingUrls.length >= 2) {
    const consolRes = evaluateConsolidationAndPrimaryUrl({
      competingUrls: input.competingUrls,
      overlappingClusterLabels: input.overlappingClusterLabels || [],
      isIntentGenuinelyDifferent: input.isIntentGenuinelyDifferent,
      intentDifferentiationRationale: input.intentDifferentiationRationale,
      policy,
    });
    consolidationBrief = consolRes.consolidationBrief;
  }

  let retirementBrief = undefined;
  if (lifecycleState === "RETIREMENT_REVIEW" || lifecycleState === "BUSINESS_VALUE_UNKNOWN") {
    retirementBrief = generateRetirementBrief({
      url: input.url,
      historicalPeakClicks: input.baselinePerformance?.monthlyClicks || input.recentPerformance.monthlyClicks,
      referringDomainsCount: input.recentPerformance.referringDomainsCount || 0,
      businessOrUserPurposeEvaluated: input.businessOrUserPurpose,
      hasConversionValue: input.hasConversionValue,
      hasLegalOrComplianceRole: input.hasLegalOrComplianceRole,
      recommendedReplacementDestinationUrl: input.recommendedReplacementUrl,
      isDestinationTopicMatched: input.isDestinationTopicMatched,
    });
  }

  // 7. Post-Refresh Measurement Readiness Evaluation
  let postRefreshMeasurement: RefreshMeasurementEvaluation | undefined = undefined;
  if (input.isImplementationVerified !== undefined) {
    const blockers: string[] = [];
    if (!input.isImplementationVerified) blockers.push("Implementation changes not yet verified on live site");
    if (!input.isPageCrawlableAndIndexable) blockers.push("Page is currently blocked from crawling or unindexed");
    if (!input.hasGscDataCompleteness) blockers.push("Search Console data completeness window not yet met");
    if (!input.minimumObservationDaysMet) blockers.push(`Minimum observation period (${typePolicy.measurementWindowDays} days) not yet reached`);
    if (input.hasUnresolvedMigrationBlocker) blockers.push("Unresolved migration redirect blocker active");

    const isMeasurementReady = blockers.length === 0;

    postRefreshMeasurement = {
      isMeasurementReady,
      readinessBlockers: blockers,
      evaluatedWindowDays: typePolicy.measurementWindowDays,
      contentChangeImplemented: Boolean(input.isImplementationVerified),
      technicalValidationPassed: Boolean(input.isPageCrawlableAndIndexable),
      queryCoverageShiftSummary: `${trends.queryShifts.filter((q) => q.shiftState === "NEW").length} new, ${trends.queryShifts.filter((q) => q.shiftState === "RETAINED").length} retained`,
      ctrChangePercent: input.postRefreshObservedCtrChangePercent || 0,
      indexationStable: Boolean(input.isPageCrawlableAndIndexable),
      trafficChangePercent: input.postRefreshObservedClicksChangePercent || 0,
      attributionConfidence: input.confoundingFactorsObserved && input.confoundingFactorsObserved.length > 0 ? "CONFOUNDED" : "HIGH",
      confoundingFactorsObserved: input.confoundingFactorsObserved || [],
    };
  }

  const allSignals = [...trends.signals, ...gating.gatingSignals, ...staleness.stalenessSignals];

  return {
    projectId: input.projectId,
    url: input.url,
    pageType,
    freshnessSensitivity: staleness.freshnessSensitivity,
    lifecycleState,
    primaryAction,
    changeRisk,
    trendShape: trends.trendShape,
    observedSignals: allSignals,
    recentPerformance: input.recentPerformance,
    baselinePerformance: input.baselinePerformance,
    queryClusterShifts: trends.queryShifts,
    isTechnicalBlocked: !!input.isTechnicalDefectPresent,
    technicalBlockerReason: input.technicalDefectReason,
    isGoogleIndexBlocked: !!input.isGoogleIndexBlocked,
    indexationBlockerReason: input.googleIndexState,
    isMigrationTransition: !!input.isMigrationTransitionActive,
    isSeasonallyDriven: !!input.isSeasonallyCyclical,
    isDemandDriven: !!input.isClusterDemandDeclining,
    isSerpCompetitorDriven: !!input.isSerpCompetitorOvertaking,
    isSerpLayoutConfounded: !!input.isSerpLayoutChanged,
    isCannibalizationPressure: !!input.isCannibalizationActive,
    isComplianceProtected: isCompliancePage,
    isSystemicTemplateException: input.isSystemicTemplateException,
    refreshBrief,
    consolidationBrief,
    retirementBrief,
    postRefreshMeasurement,
    confidence,
    uncertaintyReasons,
    policySelected: policy.policyName,
    thresholdsUsed: {
      minMonthlyImpressions: policy.minMonthlyImpressionsForEvaluation,
      minMonthlyClicks: policy.minMonthlyClicksForEvaluation,
      decayMinTrafficDropPercent: typePolicy.decayMinTrafficDropPercent,
      measurementWindowDays: typePolicy.measurementWindowDays,
    },
    policySource: policy.policySource,
    reasonClassificationTriggered,
    modelVersion: policy.modelVersion,
    policyVersion: policy.policyVersion,
  };
}
