/**
 * Phase 20: Forecasting Policies & Model Configuration.
 * Configurable, context-aware evidence policies and benchmark calibration versions.
 */

export interface MinimumEvidenceThresholds {
  minMonthlyImpressionsForCtrScenario: number;
  minHistoricalMonthlyClicksForRecovery: number;
  maxPositionStdDevForCtrOpportunity: number;
  minHistoricalSampleForLearnedBenchmark: number;
}

export interface ForecastingPolicy {
  policyName: string;
  policySource: "SYSTEM_DEFAULT" | "PROJECT_CUSTOM_CONFIG";
  contextProfile: "STANDARD" | "NICHE_B2B_LEAD" | "LOCAL_SEO" | "HIGH_VOLUME_ECOMMERCE";
  thresholds: MinimumEvidenceThresholds;
  defaultPartialOverlapCoefficient: number; // 0.5 (50% retention for partial overlap)
  modelVersion: string;
  policyVersion: string;
  calibrationVersion: string;
}

export const DEFAULT_FORECASTING_POLICY: ForecastingPolicy = {
  policyName: "STANDARD_FIRST_PARTY_FORECAST_POLICY",
  policySource: "SYSTEM_DEFAULT",
  contextProfile: "STANDARD",
  thresholds: {
    minMonthlyImpressionsForCtrScenario: 500,
    minHistoricalMonthlyClicksForRecovery: 50,
    maxPositionStdDevForCtrOpportunity: 3.5, // Positions fluctuating > 3.5 std dev are marked volatile
    minHistoricalSampleForLearnedBenchmark: 5,
  },
  defaultPartialOverlapCoefficient: 0.5,
  modelVersion: "1.0.0",
  policyVersion: "1.0.0",
  calibrationVersion: "calib_v1.0.0",
};

export const NICHE_B2B_FORECASTING_POLICY: ForecastingPolicy = {
  policyName: "NICHE_B2B_LEAD_FORECAST_POLICY",
  policySource: "PROJECT_CUSTOM_CONFIG",
  contextProfile: "NICHE_B2B_LEAD",
  thresholds: {
    minMonthlyImpressionsForCtrScenario: 100,
    minHistoricalMonthlyClicksForRecovery: 15,
    maxPositionStdDevForCtrOpportunity: 4.0,
    minHistoricalSampleForLearnedBenchmark: 3,
  },
  defaultPartialOverlapCoefficient: 0.5,
  modelVersion: "1.0.0",
  policyVersion: "1.0.0",
  calibrationVersion: "calib_v1.0.0",
};
