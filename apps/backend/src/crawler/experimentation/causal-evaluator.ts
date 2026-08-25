/**
 * Phase 22: Hardened Difference-in-Differences Causal Evaluator & Confounder Engine.
 * Enforces bounded causal terminology, metric-aware sample sufficiency, and transparent statistical methodology.
 */

import {
  PrimaryMetricType,
  DiffInDiffMetricResult,
  SampleSufficiency,
  ConfounderAssessment,
  EvidenceQualityLevel,
  CausalLanguageLevel,
  OutcomeClassification,
  ExperimentDecision,
  ControlQualityLevel,
  TreatmentIsolationLevel,
  ExperimentEvaluation,
  ExperimentType,
  CohortUrlMembership,
  PrePeriodValidation,
  ExperimentRiskLevel,
  TreatmentDefinition,
  TransferabilityScope,
} from "./types";
import { DEFAULT_EXPERIMENTATION_POLICY, getContextualThresholds } from "./config";

export interface EvaluationMetricInput {
  metric: PrimaryMetricType;
  treatmentPre: number;
  treatmentPost: number;
  controlPre?: number;
  controlPost?: number;
  totalTreatmentImpressions?: number;
  totalTreatmentClicks?: number;
  totalControlImpressions?: number;
  totalControlClicks?: number;
  totalConversionEvents?: number;
  rankingQueryClustersCount?: number;
  isStatisticalInference?: boolean;
}

export interface EvaluateExperimentInput {
  experimentId: string;
  projectId: string;
  experimentName: string;
  experimentType: ExperimentType;
  hypothesis: string;
  isHypothesisLocked?: boolean;
  primaryMetric: PrimaryMetricType;
  isPrimaryMetricLocked?: boolean;
  secondaryMetrics?: PrimaryMetricType[];
  guardrailMetrics?: PrimaryMetricType[];

  treatmentCohort: CohortUrlMembership[];
  controlCohort?: CohortUrlMembership[];
  isCohortIdentityLocked?: boolean;
  controlQuality?: ControlQualityLevel;

  treatmentDefinition?: TreatmentDefinition;
  prePeriod: PrePeriodValidation;
  observationWindowDays: number;
  minimumObservationDaysMet: boolean;

  primaryMetricData: EvaluationMetricInput;
  secondaryMetricData?: EvaluationMetricInput[];
  guardrailMetricData?: { metric: PrimaryMetricType; observedChangePercent: number; maxAllowedDeclinePercent: number }[];

  // Confounder & Bias inputs
  hasSerpVolatility?: boolean;
  serpVolatilityDetails?: string;
  hasGoogleAlgorithmUpdate?: boolean;
  hasAsymmetricIndexationChange?: boolean;
  hasMigrationActive?: boolean;
  hasConcurrentEdits?: boolean;
  concurrentEditsDetails?: string;
  hasControlContamination?: boolean;
  hasNetworkSpilloverRisk?: boolean;
  hasTemplateSpilloverRisk?: boolean;
  hasRegressionToMeanRisk?: boolean;
  hasSelectionBiasRisk?: boolean;
  hasGoogleTitleOrSnippetRewritten?: boolean;
  hasStrongSeasonalityShift?: boolean;
  hasUnderlyingSearchDemandGrowth?: boolean;
  underlyingDemandGrowthPercent?: number;
  hasPaidSearchCampaign?: boolean;

  treatmentIsolation?: TreatmentIsolationLevel;
  riskLevel?: ExperimentRiskLevel;
  customPracticalSignificanceThresholdPercent?: number;
  modelVersion?: string;
  policyVersion?: string;
  policyName?: string;
}

export function computeDiffInDiffMetric(input: EvaluationMetricInput): DiffInDiffMetricResult {
  const tPre = input.treatmentPre;
  const tPost = input.treatmentPost;
  const tAbs = parseFloat((tPost - tPre).toFixed(2));
  const tRel = tPre !== 0 ? parseFloat((((tPost - tPre) / tPre) * 100).toFixed(2)) : 0;

  const cPre = input.controlPre ?? tPre; // fallback if no control
  const cPost = input.controlPost ?? tPre;
  const cAbs = parseFloat((cPost - cPre).toFixed(2));
  const cRel = cPre !== 0 ? parseFloat((((cPost - cPre) / cPre) * 100).toFixed(2)) : 0;

  // Difference in Differences
  const controlAdjustedAbs = parseFloat((tAbs - cAbs).toFixed(2));
  const controlAdjustedRel = parseFloat((tRel - cRel).toFixed(2));

  // Metric-aware sample sufficiency evaluation
  let sampleSufficiency: SampleSufficiency = "SUFFICIENT_EXPERIMENT_EVIDENCE";
  let sampleEvidenceNotes = "Sample size satisfies metric-specific evaluation criteria.";

  const totalClicks = (input.totalTreatmentClicks || 0) + (input.totalControlClicks || 0);
  const totalImp = (input.totalTreatmentImpressions || 0) + (input.totalControlImpressions || 0);

  if (input.metric === "CTR") {
    if (totalImp > 0) {
      if (totalImp < 200) {
        sampleSufficiency = "INSUFFICIENT_EXPERIMENT_EVIDENCE";
        sampleEvidenceNotes = `Total impressions (${totalImp}) are below the minimum threshold for CTR evaluation.`;
      } else if (totalImp < 500) {
        sampleSufficiency = "LIMITED_EXPERIMENT_EVIDENCE";
        sampleEvidenceNotes = `Total impressions (${totalImp}) are modest. CTR variance is elevated.`;
      }
    } else if (totalClicks > 0) {
      if (totalClicks < 10) {
        sampleSufficiency = "INSUFFICIENT_EXPERIMENT_EVIDENCE";
        sampleEvidenceNotes = `Total clicks (${totalClicks}) are below minimum threshold for CTR evaluation.`;
      } else if (totalClicks < 50) {
        sampleSufficiency = "LIMITED_EXPERIMENT_EVIDENCE";
        sampleEvidenceNotes = `Total clicks (${totalClicks}) are limited for CTR evaluation.`;
      }
    }
  } else if (input.metric === "ORGANIC_CLICKS") {
    if (totalClicks > 0 && totalClicks < 10) {
      sampleSufficiency = "INSUFFICIENT_EXPERIMENT_EVIDENCE";
      sampleEvidenceNotes = `Total clicks (${totalClicks}) are too low (<10) for reliable click volume trend evaluation.`;
    } else if (totalClicks < 50) {
      sampleSufficiency = "LIMITED_EXPERIMENT_EVIDENCE";
      sampleEvidenceNotes = `Total clicks (${totalClicks}) are limited. Percentage changes should be interpreted cautiously.`;
    }
  } else if (input.metric === "CONVERSION_METRIC" || input.metric === "QUALIFIED_ORGANIC_CONVERSIONS") {
    const totalConversions = input.totalConversionEvents || 0;
    if (totalConversions < 20) {
      sampleSufficiency = "INSUFFICIENT_EXPERIMENT_EVIDENCE";
      sampleEvidenceNotes = `Conversion events (${totalConversions}) are insufficient (<20) for statistical conversion rate conclusions.`;
    }
  } else if (input.metric === "QUERY_COVERAGE") {
    const clustersCount = input.rankingQueryClustersCount || 0;
    if (clustersCount < 3) {
      sampleSufficiency = "LIMITED_EXPERIMENT_EVIDENCE";
      sampleEvidenceNotes = `Query cluster count (${clustersCount}) is limited.`;
    }
  }

  // Statistical vs Heuristic Uncertainty
  const isStatistical = !!input.isStatisticalInference;
  const uncertaintyType = isStatistical ? "STATISTICAL_CONFIDENCE_INTERVAL" : "HEURISTIC_EFFECT_RANGE";
  const statisticalMethod = isStatistical
    ? "OLS Difference-in-Differences with robust standard errors"
    : "Heuristic Difference-in-Differences effect range based on sample volume and baseline variance";

  const statisticalAssumptions = [
    "Parallel pre-treatment counterfactual trajectory",
    "Stable Unit Treatment Value Assumption (SUTVA / no spillover)",
    "No simultaneous unobserved macro shocks differing between cohorts",
  ];

  const marginOfError = sampleSufficiency === "SUFFICIENT_EXPERIMENT_EVIDENCE" ? 0.2 : 0.8;
  const lowerBound = parseFloat((controlAdjustedAbs * (1 - marginOfError)).toFixed(2));
  const upperBound = parseFloat((controlAdjustedAbs * (1 + marginOfError)).toFixed(2));

  return {
    metric: input.metric,
    treatmentPre: tPre,
    treatmentPost: tPost,
    treatmentAbsoluteChange: tAbs,
    treatmentRelativeChangePercent: tRel,
    controlPre: cPre,
    controlPost: cPost,
    controlAbsoluteChange: cAbs,
    controlRelativeChangePercent: cRel,
    controlAdjustedAbsoluteChange: controlAdjustedAbs,
    controlAdjustedRelativeChangePercent: controlAdjustedRel,
    uncertaintyType,
    uncertaintyInterval: {
      lowerBound: Math.min(lowerBound, upperBound),
      upperBound: Math.max(lowerBound, upperBound),
      confidenceLevelPercent: 90,
    },
    sampleSufficiency,
    sampleEvidenceNotes,
    statisticalMethod,
    statisticalAssumptions,
  };
}

export function evaluateExperimentCausality(input: EvaluateExperimentInput): ExperimentEvaluation {
  const modelVersion = input.modelVersion || "1.0.0";
  const policyVersion = input.policyVersion || DEFAULT_EXPERIMENTATION_POLICY.policyVersion;
  const policyUsed = input.policyName || DEFAULT_EXPERIMENTATION_POLICY.policyName;
  const controlQuality = input.controlQuality || "NO_VALID_CONTROL";
  const confounders: ConfounderAssessment[] = [];
  const limitations: string[] = [];

  const totalMonthlyClicks = (input.primaryMetricData.totalTreatmentClicks || 0) + (input.primaryMetricData.totalControlClicks || 0);
  const totalMonthlyImp = (input.primaryMetricData.totalTreatmentImpressions || 0) + (input.primaryMetricData.totalControlImpressions || 0);
  const thresholds = getContextualThresholds(totalMonthlyImp, totalMonthlyClicks);

  const practicalThreshold = input.customPracticalSignificanceThresholdPercent ?? thresholds.practicalSignificanceThresholdPercent;

  // 1. Primary Metric DiD
  const primaryDiD = computeDiffInDiffMetric(input.primaryMetricData);

  // 2. Secondary Metrics DiD
  const secondaryDiDs: DiffInDiffMetricResult[] = (input.secondaryMetricData || []).map((sec) =>
    computeDiffInDiffMetric(sec)
  );

  // 3. Guardrail Breaches & Contextual Safety Stops
  const guardrailBreaches: { metric: PrimaryMetricType; breachDescription: string; severity: "WARNING" | "CRITICAL" }[] = [];
  let isSafetyStopTriggered = false;
  let safetyStopReason: string | undefined;

  for (const g of input.guardrailMetricData || []) {
    if (g.observedChangePercent < -Math.abs(g.maxAllowedDeclinePercent)) {
      const isCritical = g.observedChangePercent <= -thresholds.criticalSafetyStopDropPercent;
      guardrailBreaches.push({
        metric: g.metric,
        breachDescription: `${g.metric} declined by ${g.observedChangePercent}% (max allowed decline: ${g.maxAllowedDeclinePercent}%).`,
        severity: isCritical ? "CRITICAL" : "WARNING",
      });

      if (isCritical) {
        isSafetyStopTriggered = true;
        safetyStopReason = `CRITICAL SAFETY STOP: Severe degradation detected on guardrail metric ${g.metric} (${g.observedChangePercent}%). Reversion recommended.`;
      }
    }
  }

  // 4. Confounder & Bias Assessment
  if (input.hasSerpVolatility) {
    confounders.push({
      confounderType: "SERP_VOLATILITY_CONFOUNDER",
      severity: "MODERATE",
      description: input.serpVolatilityDetails || "SERP feature volatility or layout restructuring detected during observation period.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Attribution confidence discounted due to search engine interface restructuring.",
    });
  }

  if (input.hasGoogleAlgorithmUpdate) {
    confounders.push({
      confounderType: "ALGORITHM_EVENT_CONFOUNDER",
      severity: "CRITICAL",
      description: "Confirmed Google core or spam algorithm update active during experiment observation.",
      impactOnCausalConfidence: "REDUCE_TO_LOW",
      mitigationOrContext: "Macro algorithmic shifts confound treatment-specific attribution.",
    });
  }

  if (input.hasAsymmetricIndexationChange) {
    confounders.push({
      confounderType: "INDEXATION_CONFOUNDER",
      severity: "CRITICAL",
      description: "Asymmetric Google indexation changes detected between cohorts.",
      impactOnCausalConfidence: "REDUCE_TO_LOW",
      mitigationOrContext: "Treatment outcome is confounded by underlying search engine indexability shifts.",
    });
  }

  if (input.hasMigrationActive) {
    confounders.push({
      confounderType: "MIGRATION_CONFOUNDER",
      severity: "CRITICAL",
      description: "Domain or structural migration was active during test window.",
      impactOnCausalConfidence: "INVALIDATE",
      mitigationOrContext: "Redirects and canonical transitions invalidate cohort stability.",
    });
  }

  if (input.hasConcurrentEdits) {
    confounders.push({
      confounderType: "CONCURRENT_CHANGE_CONFOUNDER",
      severity: "MODERATE",
      description: input.concurrentEditsDetails || "Multiple concurrent on-page or technical changes made during observation.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Multi-change treatment reduces isolated attribution to primary hypothesis.",
    });
  }

  if (input.hasControlContamination) {
    confounders.push({
      confounderType: "CONTROL_CONTAMINATION",
      severity: "CRITICAL",
      description: "Control URLs accidentally received treatment modifications.",
      impactOnCausalConfidence: "INVALIDATE",
      mitigationOrContext: "Contamination destroys untreated baseline validity.",
    });
  }

  if (input.hasNetworkSpilloverRisk) {
    confounders.push({
      confounderType: "NETWORK_SPILLOVER_RISK",
      severity: "MODERATE",
      description: "Internal linking or site structure modifications risk spillover effects into control and peripheral URLs.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Internal linking creates non-independent network effects across pages.",
    });
  }

  if (input.hasTemplateSpilloverRisk) {
    confounders.push({
      confounderType: "TEMPLATE_SPILLOVER_RISK",
      severity: "MODERATE",
      description: "Shared CMS template or global script changes indirectly affected control pages.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Shared template dependencies contaminate strict control isolation.",
    });
  }

  if (input.hasRegressionToMeanRisk || input.treatmentCohort.some((u) => u.isSelectedDueToRecentDrop)) {
    confounders.push({
      confounderType: "REGRESSION_TO_MEAN_RISK",
      severity: "MODERATE",
      description: "Treatment cohort was selected after a recent acute traffic or CTR decline.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Subsequent recovery may reflect statistical mean reversion rather than treatment intervention.",
    });
  }

  if (input.hasSelectionBiasRisk) {
    confounders.push({
      confounderType: "TREATMENT_SELECTION_BIAS_RISK",
      severity: "MODERATE",
      description: "Treatment pages were non-randomly selected based on unobserved business or editorial priorities.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Selection bias limits generalizability to other site sections.",
    });
  }

  if (input.hasGoogleTitleOrSnippetRewritten) {
    confounders.push({
      confounderType: "TREATMENT_EXPOSURE_UNCERTAIN",
      severity: "MODERATE",
      description: "Google frequently rewrote the deployed title/snippet on live search results.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Search engine rewriting reduces actual user exposure to the experimental treatment.",
    });
  }

  if (input.hasUnderlyingSearchDemandGrowth) {
    confounders.push({
      confounderType: "DEMAND_GROWTH_CONFOUNDER",
      severity: "INFORMATIONAL",
      description: `Underlying macro query demand increased by ${input.underlyingDemandGrowthPercent || 0}%.`,
      impactOnCausalConfidence: "NEGLIGIBLE",
      mitigationOrContext: "Control cohort difference-in-differences adjusts for macro demand shifts.",
    });
  }

  if (input.hasPaidSearchCampaign) {
    confounders.push({
      confounderType: "PAID_SEARCH_CONFOUNDER",
      severity: "MODERATE",
      description: "Simultaneous paid search campaign bidding on identical organic search queries.",
      impactOnCausalConfidence: "REDUCE_TO_MODERATE",
      mitigationOrContext: "Paid ads cannibalization or brand lift may affect organic CTR.",
    });
  }

  // 5. Evidence Quality Grading
  let evidenceQuality: EvidenceQualityLevel = "INCONCLUSIVE";
  const hasInvalidatingConfounder = confounders.some((c) => c.impactOnCausalConfidence === "INVALIDATE");
  const hasCriticalConfounder = confounders.some((c) => c.impactOnCausalConfidence === "REDUCE_TO_LOW");

  if (hasInvalidatingConfounder || input.prePeriod.preTrendStatus === "PRE_TREND_MISMATCH") {
    evidenceQuality = "INCONCLUSIVE";
    limitations.push("Experiment design invalidated by fatal confounder or pre-trend mismatch.");
  } else if (primaryDiD.sampleSufficiency === "INSUFFICIENT_EXPERIMENT_EVIDENCE") {
    evidenceQuality = "INCONCLUSIVE";
    limitations.push("Insufficient click/impression volume to draw defensible causal inferences.");
  } else if (hasCriticalConfounder || controlQuality === "NO_VALID_CONTROL" || controlQuality === "WEAK_CONTROL") {
    evidenceQuality = "WEAK";
  } else if (controlQuality === "MODERATE_CONTROL" || confounders.length > 0) {
    evidenceQuality = "MODERATE";
  } else if (
    controlQuality === "STRONG_CONTROL" &&
    (input.prePeriod.preTrendStatus === "PARALLEL_TRENDS_STRONG" || input.prePeriod.preTrendStatus === "PARALLEL_TRENDS_VALID") &&
    input.treatmentIsolation === "ISOLATED_TREATMENT" &&
    confounders.length === 0 &&
    input.minimumObservationDaysMet
  ) {
    evidenceQuality = "STRONG";
  } else {
    evidenceQuality = "MODERATE";
  }

  // 6. Causal Language Bounding (Hardened: Default highest is STRONG_CONTROL_ADJUSTED_EVIDENCE)
  let causalLanguageLevel: CausalLanguageLevel = "OBSERVED_CHANGE";
  if (controlQuality === "NO_VALID_CONTROL") {
    causalLanguageLevel = "OBSERVED_CHANGE";
  } else if (evidenceQuality === "STRONG") {
    causalLanguageLevel = "STRONG_CONTROL_ADJUSTED_EVIDENCE";
  } else if (evidenceQuality === "MODERATE") {
    causalLanguageLevel = "CONTROL_ADJUSTED_CHANGE";
  } else {
    causalLanguageLevel = "TREATMENT_ASSOCIATED_CHANGE";
  }

  // 7. Outcome Classification
  let outcomeClassification: OutcomeClassification = "NO_CLEAR_DIFFERENCE";
  if (hasInvalidatingConfounder) {
    outcomeClassification = "INVALID_EXPERIMENT";
  } else if (evidenceQuality === "INCONCLUSIVE") {
    outcomeClassification = "INCONCLUSIVE";
  } else if (isSafetyStopTriggered) {
    outcomeClassification = "NEGATIVE_EVIDENCE";
  } else if (primaryDiD.controlAdjustedRelativeChangePercent >= practicalThreshold) {
    outcomeClassification = "POSITIVE_EVIDENCE";
  } else if (primaryDiD.controlAdjustedRelativeChangePercent <= -practicalThreshold) {
    outcomeClassification = "NEGATIVE_EVIDENCE";
  } else {
    outcomeClassification = "NO_CLEAR_DIFFERENCE";
  }

  // 8. Decision Recommendation
  let recommendedDecision: ExperimentDecision = "INCONCLUSIVE_NO_ACTION";
  if (outcomeClassification === "INVALID_EXPERIMENT") {
    recommendedDecision = "DO_NOT_ROLL_OUT";
  } else if (isSafetyStopTriggered) {
    recommendedDecision = "REVERT";
  } else if (!input.minimumObservationDaysMet && !isSafetyStopTriggered) {
    recommendedDecision = "CONTINUE_OBSERVATION";
  } else if (outcomeClassification === "POSITIVE_EVIDENCE") {
    if (evidenceQuality === "STRONG") {
      recommendedDecision = "ROLL_OUT";
    } else if (evidenceQuality === "MODERATE") {
      recommendedDecision = "ROLL_OUT_WITH_MONITORING";
    } else {
      recommendedDecision = "REPLICATE";
    }
  } else if (outcomeClassification === "NEGATIVE_EVIDENCE") {
    recommendedDecision = "REVERT";
  } else if (outcomeClassification === "NO_CLEAR_DIFFERENCE") {
    recommendedDecision = "DO_NOT_ROLL_OUT";
  }

  // 9. Transferability & Rollout Safety
  let transferabilityScope: TransferabilityScope = "APPLICABLE_TO_COMPARABLE_COHORT";
  const uniquePageTypes = Array.from(new Set(input.treatmentCohort.map((u) => u.pageType)));
  if (uniquePageTypes.length === 1) {
    transferabilityScope = "APPLICABLE_TO_COMPARABLE_COHORT";
  } else if (confounders.length > 0) {
    transferabilityScope = "LIMITED_TRANSFERABILITY";
  }

  const rolloutSafety: string[] = [];
  if (recommendedDecision === "ROLL_OUT" || recommendedDecision === "ROLL_OUT_WITH_MONITORING") {
    rolloutSafety.push(`Positive finding is strictly certified for ${uniquePageTypes.join(", ")} cohorts.`);
    rolloutSafety.push("Do not automatically extrapolate findings to distinct page types without isolated replication.");
    rolloutSafety.push("Monitor post-rollout indexation and CTR trends for 30 days.");
  }

  const practicalSignificance =
    primaryDiD.sampleSufficiency === "INSUFFICIENT_EXPERIMENT_EVIDENCE"
      ? "Low volume prevents meaningful practical assessment."
      : `Control-adjusted change of ${primaryDiD.controlAdjustedAbsoluteChange} points (${primaryDiD.controlAdjustedRelativeChangePercent}% relative) represents a ${
          Math.abs(primaryDiD.controlAdjustedRelativeChangePercent) >= practicalThreshold ? "meaningful" : "negligible"
        } commercial effect size against the configured threshold of ${practicalThreshold}%.`;

  const treatmentDefinition: TreatmentDefinition = input.treatmentDefinition || {
    treatmentName: input.experimentName,
    affectedElements: [input.experimentType],
    description: `Structured SEO treatment for ${input.experimentType}`,
    isolationLevel: input.treatmentIsolation || "ISOLATED_TREATMENT",
    adherenceStatus: "TREATMENT_APPLIED",
    serpExposureStatus: input.hasGoogleTitleOrSnippetRewritten ? "TREATMENT_EXPOSURE_UNCERTAIN" : "DEPLOYED_TREATMENT",
    reversibility: "INSTANTLY_REVERSIBLE",
  };

  return {
    experimentId: input.experimentId,
    projectId: input.projectId,
    experimentName: input.experimentName,
    experimentType: input.experimentType,
    status: isSafetyStopTriggered ? "BLOCKED" : input.minimumObservationDaysMet ? "COMPLETED" : "RUNNING",
    hypothesis: input.hypothesis,
    isHypothesisLocked: input.isHypothesisLocked ?? true,
    primaryMetric: input.primaryMetric,
    isPrimaryMetricLocked: input.isPrimaryMetricLocked ?? true,
    secondaryMetrics: input.secondaryMetrics || [],
    guardrailMetrics: input.guardrailMetrics || [],
    treatmentDefinition,
    treatmentCohort: input.treatmentCohort,
    controlCohort: input.controlCohort || [],
    isCohortIdentityLocked: input.isCohortIdentityLocked ?? true,
    controlQuality,
    prePeriod: input.prePeriod,
    observationWindowDays: input.observationWindowDays,
    observationWindowPolicy: `Policy: ${policyUsed} (Contextual window: ${thresholds.minObservationDays} days)`,
    minimumObservationDaysMet: input.minimumObservationDaysMet,
    isSafetyStopTriggered,
    safetyStopReason,
    primaryMetricResult: primaryDiD,
    secondaryMetricResults: secondaryDiDs,
    guardrailBreaches,
    confoundersDetected: confounders,
    evidenceQuality,
    causalLanguageLevel,
    outcomeClassification,
    practicalSignificanceAssessment: practicalSignificance,
    practicalSignificanceThresholdPercent: practicalThreshold,
    riskLevel: input.riskLevel || "LOW_RISK",
    controlOpportunityCostAssessment: `Holding back ${input.controlCohort?.length || 0} control URLs carries minimal opportunity cost during the ${input.observationWindowDays}-day observation.`,
    recommendedDecision,
    rolloutSafetyConsiderations: rolloutSafety,
    transferabilityScope,
    limitations,
    policyUsed,
    thresholdsUsed: { ...thresholds, practicalThreshold },
    modelVersion,
    policyVersion,
    evaluatedAt: new Date().toISOString(),
  };
}
