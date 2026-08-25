/**
 * Phase 22: SEO Experimentation, Controlled Testing & Causal Learning Intelligence Types.
 * Final Hardened Type Matrix.
 */

export type ExperimentType =
  | "TITLE_TEST"
  | "META_DESCRIPTION_TEST"
  | "CONTENT_REFRESH_TEST"
  | "CONTENT_EXPANSION_TEST"
  | "INTERNAL_LINKING_TEST"
  | "STRUCTURED_DATA_TEST"
  | "TEMPLATE_CHANGE_TEST"
  | "UX_CONTENT_TEST"
  | "INFORMATION_ARCHITECTURE_TEST"
  | "CONSOLIDATION_TEST"
  | "CUSTOM_SEO_TEST";

export type ExperimentabilityStatus =
  | "HIGH_EXPERIMENTABILITY"
  | "MODERATE_EXPERIMENTABILITY"
  | "LOW_EXPERIMENTABILITY"
  | "NOT_SUITABLE_FOR_EXPERIMENT"
  | "NOT_SUITABLE_FOR_EXPERIMENT_REQUIRED_FIX";

export type ExperimentUnit =
  | "URL"
  | "URL_COHORT"
  | "TEMPLATE"
  | "QUERY_CLUSTER"
  | "SECTION_MODULE"
  | "CATEGORY"
  | "LOCATION_PAGE_COHORT"
  | "PRODUCT_COHORT";

export type TreatmentIsolationLevel =
  | "ISOLATED_TREATMENT"
  | "MULTI_CHANGE_TREATMENT"
  | "CONFOUNDED_TREATMENT";

export type ControlQualityLevel =
  | "STRONG_CONTROL"
  | "MODERATE_CONTROL"
  | "WEAK_CONTROL"
  | "NO_VALID_CONTROL";

export type PreTrendStatus =
  | "PARALLEL_TRENDS_STRONG"
  | "PARALLEL_TRENDS_ACCEPTABLE"
  | "PARALLEL_TRENDS_WEAK"
  | "PARALLEL_TRENDS_VALID"
  | "PRE_TREND_MISMATCH"
  | "INSUFFICIENT_PRE_TREND_DATA";

export type SampleSufficiency =
  | "SUFFICIENT_EXPERIMENT_EVIDENCE"
  | "LIMITED_EXPERIMENT_EVIDENCE"
  | "INSUFFICIENT_EXPERIMENT_EVIDENCE";

export type PrimaryMetricType =
  | "ORGANIC_CLICKS"
  | "IMPRESSIONS"
  | "CTR"
  | "AVERAGE_POSITION"
  | "QUERY_COVERAGE"
  | "CONVERSION_METRIC"
  | "QUALIFIED_ORGANIC_CONVERSIONS"
  | "CUSTOM_BUSINESS_METRIC";

export type CausalLanguageLevel =
  | "OBSERVED_CHANGE"
  | "TREATMENT_ASSOCIATED_CHANGE"
  | "CONTROL_ADJUSTED_CHANGE"
  | "STRONG_CONTROL_ADJUSTED_EVIDENCE"
  | "STRONG_CAUSAL_EVIDENCE";

export type EvidenceQualityLevel =
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "INCONCLUSIVE";

export type ConfounderType =
  | "SERP_VOLATILITY_CONFOUNDER"
  | "ALGORITHM_EVENT_CONFOUNDER"
  | "INDEXATION_CONFOUNDER"
  | "MIGRATION_CONFOUNDER"
  | "CONCURRENT_CHANGE_CONFOUNDER"
  | "CONTROL_CONTAMINATION"
  | "CROSS_COHORT_CONTAMINATION"
  | "SEASONALITY_CONFOUNDER"
  | "DEMAND_GROWTH_CONFOUNDER"
  | "PAID_SEARCH_CONFOUNDER"
  | "NETWORK_SPILLOVER_RISK"
  | "TEMPLATE_SPILLOVER_RISK"
  | "REGRESSION_TO_MEAN_RISK"
  | "TREATMENT_SELECTION_BIAS_RISK"
  | "TREATMENT_EXPOSURE_UNCERTAIN";

export type TreatmentAdherenceStatus =
  | "TREATMENT_APPLIED"
  | "TREATMENT_PARTIALLY_APPLIED"
  | "TREATMENT_NOT_APPLIED"
  | "TREATMENT_EXPOSURE_UNKNOWN";

export type SerpExposureStatus =
  | "DEPLOYED_TREATMENT"
  | "OBSERVED_SERP_TREATMENT"
  | "TREATMENT_EXPOSURE_UNCERTAIN";

export type TransferabilityScope =
  | "APPLICABLE_TO_COMPARABLE_COHORT"
  | "LIMITED_TRANSFERABILITY"
  | "NOT_TRANSFERABLE";

export type ExperimentStatus =
  | "DRAFT"
  | "DESIGN_READY"
  | "BLOCKED"
  | "RUNNING"
  | "MEASUREMENT_NOT_READY"
  | "READY_FOR_ANALYSIS"
  | "COMPLETED"
  | "INCONCLUSIVE"
  | "INVALIDATED"
  | "CANCELLED";

export type ExperimentBlocker =
  | "INSUFFICIENT_BASELINE"
  | "NO_VALID_CONTROL"
  | "MIGRATION_ACTIVE"
  | "INDEXATION_UNSTABLE"
  | "TRAFFIC_TOO_LOW"
  | "TREATMENT_NOT_ISOLATED"
  | "BUSINESS_RISK_TOO_HIGH"
  | "REQUIRED_FIX_EXCLUSION"
  | "EXPERIMENT_COLLISION"
  | "TREATMENT_NOT_APPLIED";

export type OutcomeClassification =
  | "POSITIVE_EVIDENCE"
  | "NEGATIVE_EVIDENCE"
  | "NO_CLEAR_DIFFERENCE"
  | "INCONCLUSIVE"
  | "INVALID_EXPERIMENT";

export type ExperimentDecision =
  | "ROLL_OUT"
  | "ROLL_OUT_WITH_MONITORING"
  | "REPLICATE"
  | "CONTINUE_OBSERVATION"
  | "REVERT"
  | "DO_NOT_ROLL_OUT"
  | "INCONCLUSIVE_NO_ACTION"
  | "MANUAL_REVIEW";

export type ReplicationStatus =
  | "UNREPLICATED_FINDING"
  | "PARTIALLY_REPLICATED"
  | "REPLICATED_WITHIN_PROJECT"
  | "CROSS_PROJECT_EVIDENCE";

export type ExperimentRiskLevel =
  | "LOW_RISK"
  | "MODERATE_RISK"
  | "HIGH_RISK"
  | "NOT_APPROPRIATE";

export interface TreatmentDefinition {
  treatmentName: string;
  affectedElements: string[];
  description: string;
  isolationLevel: TreatmentIsolationLevel;
  simultaneousChangesDetected?: string[];
  adherenceStatus: TreatmentAdherenceStatus;
  serpExposureStatus: SerpExposureStatus;
  reversibility: "INSTANTLY_REVERSIBLE" | "REVERSIBLE_WITH_DELAY" | "DIFFICULT_TO_REVERT" | "IRREVERSIBLE";
  rollbackPlan?: string;
}

export interface MetricPerformanceSummary {
  impressions: number;
  clicks: number;
  ctr: number;
  averagePosition?: number;
  rankingQueryClustersCount?: number;
  conversionCount?: number;
  conversionRate?: number;
}

export interface CohortUrlMembership {
  url: string;
  pageType: string;
  templateId?: string;
  baselineTraffic: MetricPerformanceSummary;
  isHighValueMissionCritical?: boolean;
  country?: string;
  device?: string;
  clusterIds?: string[];
  isEnrolledInOtherExperiment?: boolean;
  isSelectedDueToRecentDrop?: boolean; // selection bias / regression to mean check
}

export interface ControlMatchingDimension {
  dimensionName: string;
  weight: number;
  treatmentValue: number | string;
  controlValue: number | string;
  distance: number;
}

export interface MatchedControlPair {
  treatmentUrl: string;
  controlUrl: string;
  overallDistance: number;
  matchingDimensions: ControlMatchingDimension[];
  quality: ControlQualityLevel;
}

export interface ControlBalanceReport {
  matchedRatio: number;
  baselineMetricBalance: "BALANCED" | "MODERATE_IMBALANCE" | "SEVERE_IMBALANCE";
  positionBalance: "BALANCED" | "IMBALANCED";
  queryIntentBalance: "BALANCED" | "IMBALANCED";
  pageTypeBalance: "BALANCED" | "IMBALANCED";
  varianceSimilarity: "SIMILAR" | "DIVERGENT";
  treatmentBaselineAverage: MetricPerformanceSummary;
  controlBaselineAverage: MetricPerformanceSummary;
}

export interface ControlMatchingResult {
  controlQuality: ControlQualityLevel;
  matchingMethod: "EXACT_STRATIFIED" | "WEIGHTED_DISTANCE" | "HEURISTIC_SIMILARITY" | "NO_CONTROL_OBSERVATIONAL";
  policyVersion: string;
  policyUsed: string;
  weightsUsed: Record<string, number>;
  matchedPairs: MatchedControlPair[];
  unmatchedTreatmentUrls: string[];
  excludedControlCandidates: { url: string; reason: string }[];
  balanceReport: ControlBalanceReport;
  explanation: string;
}

export interface PrePeriodValidation {
  prePeriodStart: string;
  prePeriodEnd: string;
  prePeriodDays: number;
  isDataComplete: boolean;
  preTrendStatus: PreTrendStatus;
  preTrendSlopeDifferencePercent?: number;
  preTrendMultiPeriodDirectionConsistent?: boolean;
  baselineLevelDifferencePercent?: number;
  anomaliesDetected: string[];
  isValidForExperiment: boolean;
  policyUsed: string;
  reason?: string;
}

export interface DiffInDiffMetricResult {
  metric: PrimaryMetricType;
  treatmentPre: number;
  treatmentPost: number;
  treatmentAbsoluteChange: number;
  treatmentRelativeChangePercent: number;

  controlPre: number;
  controlPost: number;
  controlAbsoluteChange: number;
  controlRelativeChangePercent: number;

  controlAdjustedAbsoluteChange: number;
  controlAdjustedRelativeChangePercent: number;

  uncertaintyType: "HEURISTIC_EFFECT_RANGE" | "STATISTICAL_CONFIDENCE_INTERVAL";
  uncertaintyInterval: {
    lowerBound: number;
    upperBound: number;
    confidenceLevelPercent: number;
  };
  sampleSufficiency: SampleSufficiency;
  sampleEvidenceNotes: string;
  statisticalMethod: string;
  statisticalAssumptions: string[];
}

export interface ConfounderAssessment {
  confounderType: ConfounderType;
  severity: "CRITICAL" | "MODERATE" | "MINOR" | "INFORMATIONAL";
  description: string;
  impactOnCausalConfidence: "INVALIDATE" | "REDUCE_TO_LOW" | "REDUCE_TO_MODERATE" | "NEGLIGIBLE";
  mitigationOrContext: string;
}

export interface ExperimentEvaluation {
  experimentId: string;
  projectId: string;
  experimentName: string;
  experimentType: ExperimentType;
  status: ExperimentStatus;
  hypothesis: string;
  isHypothesisLocked: boolean;
  primaryMetric: PrimaryMetricType;
  isPrimaryMetricLocked: boolean;
  secondaryMetrics: PrimaryMetricType[];
  guardrailMetrics: PrimaryMetricType[];

  treatmentDefinition: TreatmentDefinition;
  treatmentCohort: CohortUrlMembership[];
  controlCohort: CohortUrlMembership[];
  isCohortIdentityLocked: boolean;
  controlQuality: ControlQualityLevel;
  controlBalanceReport?: ControlBalanceReport;

  prePeriod: PrePeriodValidation;
  observationWindowDays: number;
  observationWindowPolicy: string;
  minimumObservationDaysMet: boolean;
  isSafetyStopTriggered: boolean;
  safetyStopReason?: string;

  primaryMetricResult: DiffInDiffMetricResult;
  secondaryMetricResults: DiffInDiffMetricResult[];
  guardrailBreaches: { metric: PrimaryMetricType; breachDescription: string; severity: "WARNING" | "CRITICAL" }[];

  confoundersDetected: ConfounderAssessment[];
  evidenceQuality: EvidenceQualityLevel;
  causalLanguageLevel: CausalLanguageLevel;
  outcomeClassification: OutcomeClassification;
  practicalSignificanceAssessment: string;
  practicalSignificanceThresholdPercent: number;
  businessImpactSummary?: string;

  riskLevel: ExperimentRiskLevel;
  controlOpportunityCostAssessment?: string;
  recommendedDecision: ExperimentDecision;
  rolloutSafetyConsiderations: string[];
  transferabilityScope: TransferabilityScope;
  limitations: string[];

  policyUsed: string;
  thresholdsUsed: Record<string, any>;
  modelVersion: string;
  policyVersion: string;
  evaluatedAt: string;
}

export interface ForecastCalibrationCandidate {
  candidateId: string;
  projectId: string;
  sourceExperimentId: string;
  treatmentType: ExperimentType;
  targetPageType: string;
  observedControlAdjustedEffectPercent: number;
  evidenceQuality: EvidenceQualityLevel;
  transferabilityScope: TransferabilityScope;
  contributingExperimentsCount: number;
  suggestedPhase20FactorAdjustment: number;
  isApprovedForForecasting: boolean;
  approvalVersion?: string;
  auditTrail: string;
}

export interface ProjectTreatmentLibraryEntry {
  entryId: string;
  projectId: string;
  treatmentName: string;
  experimentType: ExperimentType;
  primaryMetric: PrimaryMetricType;
  applicablePageTypes: string[];
  applicableIntents: string[];
  totalExperimentsCount: number;
  positiveOutcomesCount: number;
  negativeOutcomesCount: number;
  neutralOutcomesCount: number;
  inconclusiveOutcomesCount: number;
  replicationStatus: ReplicationStatus;
  transferabilityScope: TransferabilityScope;
  averageControlAdjustedEffectPercent: number;
  averageControlAdjustedAbsoluteEffect: number;
  evidenceConfidence: EvidenceQualityLevel;
  lastExperimentDate: string;
  isExcludedFromGeneralization: boolean;
  exclusionReason?: string;
}

export interface ExperimentSnapshot {
  snapshotId: string;
  experimentId: string;
  projectId: string;
  createdAt: string;
  evaluation: ExperimentEvaluation;
  modelVersion: string;
  policyVersion: string;
  immutabilityStatement: "RUNTIME_IMMUTABLE_FREEZE";
}

export interface ExperimentCandidateOpportunity {
  actionId: string;
  actionTitle: string;
  experimentType: ExperimentType;
  experimentability: ExperimentabilityStatus;
  eligibilityReason: string;
  suggestedUnit: ExperimentUnit;
  suggestedPrimaryMetric: PrimaryMetricType;
  candidateUrlsCount: number;
  blockers: ExperimentBlocker[];
  requiresManualApproval: boolean;
}
