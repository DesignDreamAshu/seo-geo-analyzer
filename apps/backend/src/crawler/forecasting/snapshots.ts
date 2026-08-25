/**
 * Forecast Snapshot Builder & Comparability Gate.
 * Enforces runtime immutability and validates comparability between forecast snapshots across models, policies, and scopes.
 */

import {
  ForecastSnapshot,
  PortfolioForecastSummary,
  SeoImpactEstimate,
  BusinessDataState,
  ImplementationCostState,
} from "./types";

export function createForecastSnapshot(params: {
  snapshotId: string;
  projectId: string;
  capturedAt?: string;
  modelVersion?: string;
  policyVersion?: string;
  calibrationVersion?: string;
  businessDataState: BusinessDataState;
  costState: ImplementationCostState;
  portfolioSummary: PortfolioForecastSummary;
  estimates: SeoImpactEstimate[];
}): ForecastSnapshot {
  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    capturedAt: params.capturedAt || new Date().toISOString(),
    modelVersion: params.modelVersion || "1.0.0",
    policyVersion: params.policyVersion || "1.0.0",
    calibrationVersion: params.calibrationVersion || "calib_v1.0.0",
    businessDataState: params.businessDataState,
    costState: params.costState,
    totalActionsCount: params.estimates.length,
    portfolioSummary: params.portfolioSummary,
    estimates: params.estimates,
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type ForecastComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason: "PROJECT_MISMATCH" | "FORECAST_MODEL_CHANGED" | "FORECAST_POLICY_CHANGED" | "FORECAST_SCOPE_CHANGED";
      details: string;
    };

export function validateForecastSnapshotComparability(
  snap1: ForecastSnapshot,
  snap2: ForecastSnapshot
): ForecastComparabilityResult {
  if (snap1.projectId !== snap2.projectId) {
    return {
      isComparable: false,
      reason: "PROJECT_MISMATCH",
      details: `Project IDs do not match ('${snap1.projectId}' vs '${snap2.projectId}').`,
    };
  }

  if (snap1.modelVersion !== snap2.modelVersion) {
    return {
      isComparable: false,
      reason: "FORECAST_MODEL_CHANGED",
      details: `Forecast model versions differ ('${snap1.modelVersion}' vs '${snap2.modelVersion}').`,
    };
  }

  if (snap1.policyVersion !== snap2.policyVersion) {
    return {
      isComparable: false,
      reason: "FORECAST_POLICY_CHANGED",
      details: `Forecasting policy versions differ ('${snap1.policyVersion}' vs '${snap2.policyVersion}').`,
    };
  }

  if (Math.abs(snap1.totalActionsCount - snap2.totalActionsCount) > 50) {
    return {
      isComparable: false,
      reason: "FORECAST_SCOPE_CHANGED",
      details: `Action inventory scope changed substantially (${snap1.totalActionsCount} vs ${snap2.totalActionsCount} actions).`,
    };
  }

  return { isComparable: true };
}
