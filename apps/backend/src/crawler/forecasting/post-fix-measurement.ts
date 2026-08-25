/**
 * Post-Fix Measurement, Attribution & Historical Calibration Engine.
 * Separates technical issue resolution from traffic changes, checks measurement readiness,
 * and maintains outlier-resilient, versioned project benchmarks.
 */

import {
  SeoImpactEstimate,
  PostFixRealizationState,
  AttributionConfidenceLevel,
  BenchmarkQualityState,
} from "./types";
import { ForecastingPolicy, DEFAULT_FORECASTING_POLICY } from "./config";

export interface PostFixEvaluationInput {
  estimate: SeoImpactEstimate;
  observedPostFixMonthlyClicks?: number;
  isFixValidatedInPhase11: boolean;
  measurementWindowDays: number;
  concurrentDeployments?: boolean;
  algorithmUpdateOverlap?: boolean;
  serpVolatilityHigh?: boolean;
  hasHoldoutControlCohort?: boolean;
  technicalResolutionSuccess: boolean;
}

export function evaluatePostFixOutcome(input: PostFixEvaluationInput): {
  realizationState: PostFixRealizationState;
  technicalResolutionSuccess: boolean;
  attributionConfidence: AttributionConfidenceLevel;
  confoundingFactors: string[];
  measurementWindowDays: number;
} {
  const est = input.estimate;
  const confoundingFactors: string[] = [];

  // 1. Measurement Readiness Gate
  if (!input.isFixValidatedInPhase11 || input.observedPostFixMonthlyClicks === undefined) {
    return {
      realizationState: "MEASUREMENT_NOT_READY",
      technicalResolutionSuccess: input.technicalResolutionSuccess,
      attributionConfidence: "ATTRIBUTION_UNKNOWN",
      confoundingFactors: ["Fix implementation not yet validated or observation window incomplete."],
      measurementWindowDays: input.measurementWindowDays,
    };
  }

  const actual = input.observedPostFixMonthlyClicks;

  if (input.concurrentDeployments) confoundingFactors.push("Concurrent site deployments during measurement period");
  if (input.algorithmUpdateOverlap) confoundingFactors.push("Major search engine core update overlapped measurement");
  if (input.serpVolatilityHigh) confoundingFactors.push("High SERP feature volatility during measurement");

  // 2. Attribution Confidence
  let attributionConfidence: AttributionConfidenceLevel = "HIGH_ATTRIBUTION_CONFIDENCE";
  if (confoundingFactors.length >= 2) attributionConfidence = "LOW_ATTRIBUTION_CONFIDENCE";
  else if (confoundingFactors.length === 1) attributionConfidence = "MODERATE_ATTRIBUTION_CONFIDENCE";

  if (input.hasHoldoutControlCohort) {
    // Holdout control cohort strengthens attribution
    if (attributionConfidence === "MODERATE_ATTRIBUTION_CONFIDENCE") attributionConfidence = "HIGH_ATTRIBUTION_CONFIDENCE";
  }

  if (!est.scenarios) {
    return {
      realizationState: "INCONCLUSIVE",
      technicalResolutionSuccess: input.technicalResolutionSuccess,
      attributionConfidence: "ATTRIBUTION_UNKNOWN",
      confoundingFactors,
      measurementWindowDays: input.measurementWindowDays,
    };
  }

  const s = est.scenarios;
  let state: PostFixRealizationState = "INCONCLUSIVE";

  if (actual < s.conservative.minMonthlyClicks) {
    state = "BELOW_CONSERVATIVE_RANGE";
  } else if (actual <= s.conservative.maxMonthlyClicks) {
    state = "WITHIN_CONSERVATIVE_RANGE";
  } else if (actual <= s.base.maxMonthlyClicks) {
    state = "WITHIN_BASE_RANGE";
  } else if (actual <= s.upside.maxMonthlyClicks) {
    state = "WITHIN_UPSIDE_RANGE";
  } else {
    state = "ABOVE_UPSIDE_RANGE";
  }

  return {
    realizationState: state,
    technicalResolutionSuccess: input.technicalResolutionSuccess,
    attributionConfidence,
    confoundingFactors,
    measurementWindowDays: input.measurementWindowDays,
  };
}

export interface CalibrationRecord {
  projectId: string;
  actionType: string;
  realizedCtrDeltaPercent: number;
  recordedAt: string;
  isOutlier?: boolean;
}

export class ProjectBenchmarkLearner {
  private static projectHistory = new Map<string, CalibrationRecord[]>();
  private static projectCalibrationVersions = new Map<string, number>();

  public static recordOutcome(
    projectId: string,
    actionType: string,
    realizedCtrDeltaPercent: number
  ): { calibrationVersion: string } {
    const key = projectId.trim().toLowerCase();
    let history = this.projectHistory.get(key);
    if (!history) {
      history = [];
      this.projectHistory.set(key, history);
    }

    // Outlier detection: Deltas > 10.0 percentage points are flagged
    const isOutlier = Math.abs(realizedCtrDeltaPercent) > 10.0;

    history.push({
      projectId,
      actionType,
      realizedCtrDeltaPercent,
      recordedAt: new Date().toISOString(),
      isOutlier,
    });

    const currentVer = (this.projectCalibrationVersions.get(key) || 0) + 1;
    this.projectCalibrationVersions.set(key, currentVer);

    return {
      calibrationVersion: `calib_${key}_v${currentVer}`,
    };
  }

  public static getCalibratedBenchmark(
    projectId: string,
    actionType: string,
    policy: ForecastingPolicy = DEFAULT_FORECASTING_POLICY
  ): {
    qualityState: BenchmarkQualityState;
    medianCtrDeltaPercent?: number;
    sampleCount: number;
    outlierCount: number;
    calibrationVersion: string;
  } {
    const key = projectId.trim().toLowerCase();
    const history = this.projectHistory.get(key) || [];
    const matching = history.filter((h) => h.actionType === actionType);
    const valid = matching.filter((m) => !m.isOutlier);
    const outlierCount = matching.filter((m) => m.isOutlier).length;
    const ver = this.projectCalibrationVersions.get(key) || 1;
    const calibVer = `calib_${key}_v${ver}`;

    if (valid.length < policy.thresholds.minHistoricalSampleForLearnedBenchmark) {
      return {
        qualityState: "INSUFFICIENT_HISTORICAL_SAMPLE",
        sampleCount: valid.length,
        outlierCount,
        calibrationVersion: calibVer,
      };
    }

    const deltas = valid.map((m) => m.realizedCtrDeltaPercent).sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)];

    let qualityState: BenchmarkQualityState = "BENCHMARK_STRONG";
    if (valid.length < 10) qualityState = "BENCHMARK_MODERATE";

    return {
      qualityState,
      medianCtrDeltaPercent: median,
      sampleCount: valid.length,
      outlierCount,
      calibrationVersion: calibVer,
    };
  }

  public static clearProject(projectId: string): void {
    const key = projectId.trim().toLowerCase();
    this.projectHistory.delete(key);
    this.projectCalibrationVersions.delete(key);
  }

  public static clearAll(): void {
    this.projectHistory.clear();
    this.projectCalibrationVersions.clear();
  }
}
