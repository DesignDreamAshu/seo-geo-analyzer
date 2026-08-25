/**
 * Phase 21: Content Lifecycle, Decay, Refresh & Consolidation Intelligence Types & Contracts.
 * Establishes foundational distinctions:
 * TRAFFIC_DECLINE ≠ CONTENT_DECAY
 * OLD_CONTENT ≠ STALE_CONTENT
 * ZERO_TRAFFIC ≠ USELESS_PAGE
 */

import { ActionPriority, ImplementationEffort, ActionOwner, TimelineBucket } from "../opportunity/types";

export type ContentLifecycleState =
  | "HEALTHY"
  | "GROWING"
  | "STABLE"
  | "EARLY_DECAY_SIGNAL"
  | "CONFIRMED_DECAY"
  | "SEASONAL_DECLINE"
  | "DEMAND_DECLINE"
  | "SERP_COMPETITIVE_LOSS"
  | "SERP_LAYOUT_CONFOUNDING"
  | "QUERY_COVERAGE_LOSS"
  | "CTR_DECAY"
  | "INDEXATION_DRIVEN_DECLINE"
  | "TECHNICAL_DECLINE"
  | "MIGRATION_RELATED_DECLINE"
  | "CONTENT_STALENESS_RISK"
  | "CANNIBALIZATION_PRESSURE"
  | "CONSOLIDATION_CANDIDATE"
  | "REFRESH_CANDIDATE"
  | "EXPANSION_CANDIDATE"
  | "RETIREMENT_REVIEW"
  | "RETIREMENT_NOT_APPLICABLE"
  | "BUSINESS_VALUE_UNKNOWN"
  | "INSUFFICIENT_EVIDENCE";

export type ContentLifecycleAction =
  | "KEEP_AS_IS"
  | "MONITOR"
  | "REFRESH"
  | "EXPAND"
  | "REOPTIMIZE_SNIPPET"
  | "EVALUATE_SERP_FEATURES"
  | "IMPROVE_INTERNAL_LINKING"
  | "CONSOLIDATE"
  | "MERGE_AND_REDIRECT"
  | "DIFFERENTIATE_INTENT"
  | "RESTORE_TECHNICAL_VISIBILITY"
  | "REPAIR_INDEXATION"
  | "UPDATE_FACTUAL_INFORMATION"
  | "UPDATE_YEAR_DATE_CONTEXT"
  | "REMOVE_OBSOLETE_SECTION"
  | "RETIRE_WITH_REDIRECT"
  | "RETIRE_WITHOUT_REDIRECT_REVIEW"
  | "MANUAL_REVIEW"
  | "PRIMARY_URL_MANUAL_REVIEW"
  | "MANUAL_FACT_VERIFICATION_REQUIRED";

export type FreshnessSensitivity =
  | "HIGH_FRESHNESS_SENSITIVITY"
  | "MODERATE_FRESHNESS_SENSITIVITY"
  | "LOW_FRESHNESS_SENSITIVITY"
  | "EVERGREEN";

export type TrendShape =
  | "GRADUAL_DECLINE"
  | "SUDDEN_CLIFF"
  | "STEP_CHANGE_DOWN"
  | "INTERMITTENT_VOLATILITY"
  | "SEASONAL_CYCLE"
  | "STABLE_PLATEAU"
  | "SUSTAINED_GROWTH"
  | "INCONCLUSIVE_TREND";

export type ContentChangeRisk = "LOW_CHANGE_RISK" | "MODERATE_CHANGE_RISK" | "HIGH_CHANGE_RISK";

export type ConsolidationConfidence =
  | "CONSOLIDATION_HIGH_CONFIDENCE"
  | "CONSOLIDATION_MODERATE_CONFIDENCE"
  | "CONSOLIDATION_LOW_CONFIDENCE"
  | "MANUAL_REVIEW";

export interface LifecycleSignal {
  signalType:
    | "CLICK_DECLINE"
    | "IMPRESSION_DECLINE"
    | "CTR_DROP"
    | "POSITION_DROP"
    | "LOST_QUERY_CLUSTERS"
    | "OUTDATED_FACTS"
    | "OUTDATED_YEAR"
    | "TECHNICAL_BLOCKER"
    | "INDEX_LOSS"
    | "CANNIBALIZATION_DETECTED"
    | "SERP_LAYOUT_SHIFT"
    | "SERP_LAYOUT_CONFOUNDING"
    | "VARIANCE_HIGH";
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  detectedValue?: string | number;
  baselineValue?: string | number;
}

export interface HistoricalPerformanceSummary {
  periodRange: string;
  monthlyImpressions: number;
  monthlyClicks: number;
  averageCtr: number;
  averagePosition?: number;
  rankingQueryClustersCount: number;
  topRankingClusterIds: string[];
  referringDomainsCount?: number;
  historicalVarianceScore?: number; // 0 (stable) to 1.0 (highly volatile)
  isBrandedQueryDominant?: boolean;
  device?: string;
  country?: string;
}

export interface QueryClusterCoverageShift {
  clusterId: string;
  clusterLabel: string;
  shiftState: "RETAINED" | "WEAKENED" | "LOST" | "NEW";
  baselineImpressions: number;
  currentImpressions: number;
  baselinePosition?: number;
  currentPosition?: number;
  isStatisticallyMeaningful: boolean;
  magnitudeDifference: number;
}

export interface ContentPreservationGuidance {
  preserveUrl: boolean;
  preserveCanonical: boolean;
  highPerformingSectionHeadings: string[];
  retainedQueryClusterLabels: string[];
  inboundBacklinksCount: number;
  cautionNotes: string[];
  excludedOutdatedSections: string[];
}

export interface StaleClaimEvidence {
  claimId: string;
  affectedSection: string;
  exactEvidence: string;
  whyOutdated: string;
  sourceOfCurrentTruth?: string;
  confidence: "HIGH" | "MODERATE" | "LOW";
  status: "CONFIRMED_STALE" | "MANUAL_FACT_VERIFICATION_REQUIRED";
}

export interface ExactRefreshBrief {
  whyExplanation: string;
  whatGapsExist: string[];
  whereSections: string[];
  preserveElements: ContentPreservationGuidance;
  specificChangesNeeded: string[];
  staleClaimsEvidence?: StaleClaimEvidence[];
  risksIdentified: string[];
  verificationPlan: string[];
  measurementWindowDays: number;
  measurementWindowReason: string;
}

export interface PrimaryUrlEquityBreakdown {
  clicksEquity: { value: number; weight: number; score: number };
  impressionsEquity: { value: number; weight: number; score: number };
  referringDomainsEquity: { value: number; weight: number; score: number };
  internalInlinksEquity: { value: number; weight: number; score: number };
  indexationEquity: { isIndexed: boolean; score: number };
  canonicalStabilityEquity: { isSelfCanonical: boolean; score: number };
  businessCriticalityEquity: { score: number };
  contentCompletenessEquity: { wordCount: number; score: number };
  urlRelevanceEquity: { score: number };
  totalEquityScore: number;
}

export interface ConsolidationBrief {
  competingUrls: string[];
  overlappingClusterLabels: string[];
  recommendedPrimaryUrl: string;
  primarySelectionReason: string;
  equityBreakdowns: Record<string, PrimaryUrlEquityBreakdown>;
  consolidationConfidence: ConsolidationConfidence;
  requiresManualRedirectApproval: boolean;
  uniqueContentToPreserve: string[];
  backlinkConsiderations: string;
  redirectRecommendation: string;
  internalLinkUpdatesNeeded: string[];
  sitemapCanonicalUpdates: string[];
  postConsolidationVerification: string[];
}

export interface RetirementBrief {
  retirementReason: string;
  historicalPeakClicks: number;
  referringDomainsCount: number;
  businessOrUserPurposeEvaluated: string;
  hasConversionValue?: boolean;
  hasLegalOrComplianceRole?: boolean;
  recommendedReplacementDestinationUrl?: string;
  redirectRelevanceAssessment: "RELEVANT_DESTINATION_CONFIRMED" | "NO_RELEVANT_DESTINATION_MANUAL_REVIEW";
  risksIdentified: string[];
  manualApprovalRequired: boolean;
}

export interface RefreshMeasurementEvaluation {
  isMeasurementReady: boolean;
  readinessBlockers: string[];
  evaluatedWindowDays: number;
  contentChangeImplemented: boolean;
  technicalValidationPassed: boolean;
  queryCoverageShiftSummary: string;
  ctrChangePercent: number;
  indexationStable: boolean;
  trafficChangePercent: number;
  attributionConfidence: "HIGH" | "MODERATE" | "LOW" | "CONFOUNDED";
  confoundingFactorsObserved: string[];
}

export interface ContentLifecycleAssessment {
  projectId: string;
  url: string;
  pageType: string;
  freshnessSensitivity: FreshnessSensitivity;

  lifecycleState: ContentLifecycleState;
  primaryAction: ContentLifecycleAction;
  changeRisk: ContentChangeRisk;

  trendShape: TrendShape;
  observedSignals: LifecycleSignal[];

  recentPerformance: HistoricalPerformanceSummary;
  baselinePerformance?: HistoricalPerformanceSummary;

  queryClusterShifts: QueryClusterCoverageShift[];

  // Multi-Phase Context Flags
  isTechnicalBlocked: boolean;
  technicalBlockerReason?: string;
  isGoogleIndexBlocked: boolean;
  indexationBlockerReason?: string;
  isMigrationTransition: boolean;
  isSeasonallyDriven: boolean;
  isDemandDriven: boolean;
  isSerpCompetitorDriven: boolean;
  isSerpLayoutConfounded: boolean;
  isCannibalizationPressure: boolean;
  isComplianceProtected: boolean;
  isSystemicTemplateException?: boolean;

  // Evidence Briefs
  refreshBrief?: ExactRefreshBrief;
  consolidationBrief?: ConsolidationBrief;
  retirementBrief?: RetirementBrief;
  postRefreshMeasurement?: RefreshMeasurementEvaluation;

  confidence: "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_EVIDENCE";
  uncertaintyReasons: string[];

  // Policy & Versioning Metadata
  policySelected: string;
  thresholdsUsed: Record<string, any>;
  policySource: string;
  reasonClassificationTriggered: string;
  modelVersion: string;
  policyVersion: string;
}

export interface ContentLifecycleInventorySummary {
  projectId: string;
  totalEvaluatedUrls: number;
  healthyUrlsCount: number;
  growingUrlsCount: number;
  decayedUrlsCount: number;
  seasonalDeclineCount: number;
  demandDeclineCount: number;
  technicalDeclineCount: number;
  indexationDeclineCount: number;
  refreshCandidatesCount: number;
  consolidationCandidatesCount: number;
  retirementReviewsCount: number;
  insufficientEvidenceCount: number;
  complianceProtectedCount: number;

  topHighValueRefreshCandidates: ContentLifecycleAssessment[];
  topConsolidationOpportunities: ContentLifecycleAssessment[];
  retirementReviewCandidates: ContentLifecycleAssessment[];
}

export interface ContentLifecycleSnapshot {
  snapshotId: string;
  projectId: string;
  capturedAt: string;
  modelVersion: string;
  policyVersion: string;
  thresholdPolicyVersion: string;
  primaryUrlPolicyVersion: string;
  freshnessPolicyVersion: string;
  measurementPolicyVersion: string;
  totalUrlsCount: number;
  inventorySummary: ContentLifecycleInventorySummary;
  assessments: ContentLifecycleAssessment[];
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface ContentLifecycleReport {
  generatedAt: string;
  projectId: string;
  modelVersion: string;
  policyVersion: string;
  inventorySummary: ContentLifecycleInventorySummary;
  assessments: ContentLifecycleAssessment[];
  governanceLimitations: string[];
  immutabilityStatement: string;
}
