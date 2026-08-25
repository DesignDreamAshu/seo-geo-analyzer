/**
 * Forecastability Gate & Uncertainty Classifier.
 * Strictly separates technical certainty from traffic forecastability, enforces position stability,
 * detects baseline anomalies, and validates indexation dependencies.
 */

import {
  ForecastabilityState,
  ForecastConfidence,
  ObservedExposureMetric,
  ScenarioConstructionMethod,
} from "./types";
import { ForecastingPolicy, DEFAULT_FORECASTING_POLICY } from "./config";

export interface ForecastabilityEvaluation {
  forecastability: ForecastabilityState;
  quantificationSupported: boolean;
  unquantifiedReason?: string;
  scenarioMethod: ScenarioConstructionMethod;
  confidence: ForecastConfidence;
  uncertaintyReasons: string[];
  isBaselineAnomalyFree: boolean;
}

export function evaluateActionForecastability(params: {
  actionType: string;
  ruleCode?: string;
  observedExposure: ObservedExposureMetric;
  hasHistoricalPreRegressionBaseline: boolean;
  hasSameSiteCohortBenchmark?: boolean;
  isNewContentCandidate?: boolean;
  isBacklinkProspecting?: boolean;
  isSchemaOnly?: boolean;
  isIndexationBlocked?: boolean;
  isMigrationTransition?: boolean;
  serpVolatilityHigh?: boolean;
  policy?: ForecastingPolicy;
}): ForecastabilityEvaluation {
  const policy = params.policy || DEFAULT_FORECASTING_POLICY;
  const thresholds = policy.thresholds;
  const uncertaintyReasons: string[] = [];

  // 1. Check Baseline Anomalies
  let isBaselineAnomalyFree = true;
  if (params.observedExposure.baselineDistribution && !params.observedExposure.baselineDistribution.isAnomalyFree) {
    isBaselineAnomalyFree = false;
    uncertaintyReasons.push(
      `Historical baseline contains known anomalies (${params.observedExposure.baselineDistribution.anomalyNotes?.join(", ")}). BASELINE_REVIEW_REQUIRED.`
    );
  }

  // 2. Unquantifiable action types by design
  if (params.isBacklinkProspecting) {
    return {
      forecastability: "LOW_FORECASTABILITY",
      quantificationSupported: false,
      unquantifiedReason: "Link acquisition is highly variable and ranking response cannot be reliably isolated.",
      scenarioMethod: "QUANTIFICATION_NOT_SUPPORTED",
      confidence: "LOW",
      uncertaintyReasons: ["Third-party acquisition uncertainty", "Indirect algorithmic ranking correlation"],
      isBaselineAnomalyFree,
    };
  }

  if (params.isSchemaOnly) {
    return {
      forecastability: "NOT_FORECASTABLE",
      quantificationSupported: false,
      unquantifiedReason: "Structured data syntax enhancement has no direct guaranteed click multiplier.",
      scenarioMethod: "QUANTIFICATION_NOT_SUPPORTED",
      confidence: "LOW",
      uncertaintyReasons: ["Search engine rich snippet display discretion"],
      isBaselineAnomalyFree,
    };
  }

  if (params.isNewContentCandidate) {
    return {
      forecastability: "LOW_FORECASTABILITY",
      quantificationSupported: false,
      unquantifiedReason: "New content has no historical URL ranking or indexation baseline on this domain.",
      scenarioMethod: "QUANTIFICATION_NOT_SUPPORTED",
      confidence: "LOW",
      uncertaintyReasons: ["Absence of historical ranking baseline", "Indexation and competitive query difficulty"],
      isBaselineAnomalyFree,
    };
  }

  // 3. Dependencies & Environmental Volatility
  if (params.isIndexationBlocked) {
    uncertaintyReasons.push("Traffic realization depends on successful Google crawl and indexation transition.");
  }

  if (params.isMigrationTransition) {
    uncertaintyReasons.push("Active migration index/canonical transition introduces transitional volatility.");
  }

  if (params.serpVolatilityHigh) {
    uncertaintyReasons.push("High SERP composition volatility reduces forecast stability.");
  }

  // 4. Position Stability Gate for CTR Scenarios
  const isPositionVolatile =
    params.observedExposure.positionVolatilityStdDev !== undefined &&
    params.observedExposure.positionVolatilityStdDev > thresholds.maxPositionStdDevForCtrOpportunity;

  if (isPositionVolatile) {
    uncertaintyReasons.push(
      `Historical average position is volatile (std dev ${params.observedExposure.positionVolatilityStdDev} > ${thresholds.maxPositionStdDevForCtrOpportunity}). CTR scenario confidence reduced.`
    );
  }

  // 5. Contextual Low-Volume Suppression (Context-Aware Policy Thresholds)
  const isLowVolume =
    params.observedExposure.historicalMonthlyImpressions < thresholds.minMonthlyImpressionsForCtrScenario &&
    params.observedExposure.historicalMonthlyClicks < thresholds.minHistoricalMonthlyClicksForRecovery;

  if (isLowVolume && !params.hasHistoricalPreRegressionBaseline) {
    return {
      forecastability: "NOT_FORECASTABLE",
      quantificationSupported: false,
      unquantifiedReason: `Insufficient search volume under policy '${policy.policyName}' (<${thresholds.minMonthlyImpressionsForCtrScenario} imp, <${thresholds.minHistoricalMonthlyClicksForRecovery} clicks).`,
      scenarioMethod: "QUANTIFICATION_NOT_SUPPORTED",
      confidence: "INSUFFICIENT_EVIDENCE",
      uncertaintyReasons: [...uncertaintyReasons, "Low first-party search volume sample"],
      isBaselineAnomalyFree,
    };
  }

  // 6. Forecastability Classification & Method Selection
  // A. Technical Recovery with Anomaly-Free Pre-Regression Baseline
  if (params.hasHistoricalPreRegressionBaseline && params.observedExposure.historicalMonthlyClicks >= thresholds.minHistoricalMonthlyClicksForRecovery) {
    const method: ScenarioConstructionMethod = params.observedExposure.baselineDistribution
      ? "SAME_URL_HISTORICAL_DISTRIBUTION"
      : "ASSUMPTION_DRIVEN_SCENARIO";

    return {
      forecastability: isBaselineAnomalyFree ? "HIGHLY_FORECASTABLE" : "PARTIALLY_FORECASTABLE",
      quantificationSupported: true,
      scenarioMethod: method,
      confidence: params.serpVolatilityHigh || !isBaselineAnomalyFree ? "MODERATE" : "HIGH",
      uncertaintyReasons,
      isBaselineAnomalyFree,
    };
  }

  // B. CTR Benchmark Optimization (Only for CTR actions or explicit cohort benchmarks)
  if (
    (params.actionType === "CTR_OPPORTUNITY" || params.hasSameSiteCohortBenchmark) &&
    params.observedExposure.historicalMonthlyImpressions >= thresholds.minMonthlyImpressionsForCtrScenario
  ) {
    const method: ScenarioConstructionMethod = params.hasSameSiteCohortBenchmark
      ? "SAME_SITE_COHORT_BENCHMARK"
      : "ASSUMPTION_DRIVEN_SCENARIO";

    return {
      forecastability: isPositionVolatile ? "PARTIALLY_FORECASTABLE" : "HIGHLY_FORECASTABLE",
      quantificationSupported: true,
      scenarioMethod: method,
      confidence: isPositionVolatile || params.serpVolatilityHigh ? "LOW" : "MODERATE",
      uncertaintyReasons,
      isBaselineAnomalyFree,
    };
  }

  return {
    forecastability: "PARTIALLY_FORECASTABLE",
    quantificationSupported: true,
    scenarioMethod: "ASSUMPTION_DRIVEN_SCENARIO",
    confidence: "LOW",
    uncertaintyReasons: [...uncertaintyReasons, "Assumption-driven fallback scenario"],
    isBaselineAnomalyFree,
  };
}
