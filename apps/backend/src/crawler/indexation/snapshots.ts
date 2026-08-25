/**
 * Indexation Snapshot Builder & Hardened Comparability Gate.
 * Enforces runtime immutability and validates sampling scope comparability.
 */

import {
  IndexationSnapshot,
  KnownUrlUniverseSummary,
  ProviderCapabilityState,
  InspectionSamplingMode,
  IndexCoverageMatrixDistribution,
} from "./types";

export function createIndexationSnapshot(params: {
  snapshotId: string;
  projectId: string;
  capturedAt?: string;
  knownUrlUniverseSummary: KnownUrlUniverseSummary;
  providerCapability: ProviderCapabilityState;
  inspectionSamplingMode: InspectionSamplingMode;
  inspectionEligibleCount: number;
  inspectedCount: number;
  evidenceFreshnessBreakdown: {
    freshPercent: number;
    agingPercent: number;
    stalePercent: number;
  };
  matrixDistribution: IndexCoverageMatrixDistribution;
  mapperVersion?: string;
}): IndexationSnapshot {
  const capturedAt = params.capturedAt || new Date().toISOString();
  const coveragePercentage = params.inspectionEligibleCount > 0
    ? Math.round((params.inspectedCount / params.inspectionEligibleCount) * 100)
    : 0;

  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    capturedAt,
    knownUrlUniverseSummary: params.knownUrlUniverseSummary,
    providerCapability: params.providerCapability,
    inspectionSamplingMode: params.inspectionSamplingMode,
    inspectionEligibleCount: params.inspectionEligibleCount,
    inspectedCount: params.inspectedCount,
    inspectionCoveragePercentage: coveragePercentage,
    evidenceFreshnessBreakdown: params.evidenceFreshnessBreakdown,
    matrixDistribution: params.matrixDistribution,
    mapperVersion: params.mapperVersion || "1.0.0",
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type IndexationComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason:
        | "PROJECT_MISMATCH"
        | "INSPECTION_SCOPE_CHANGED"
        | "PROVIDER_MAPPER_VERSION_MISMATCH"
        | "DATASET_INVALID";
      details: string;
    };

export function validateIndexationSnapshotComparability(
  snap1: IndexationSnapshot,
  snap2: IndexationSnapshot
): IndexationComparabilityResult {
  if (snap1.projectId !== snap2.projectId) {
    return {
      isComparable: false,
      reason: "PROJECT_MISMATCH",
      details: `Project IDs do not match ('${snap1.projectId}' vs '${snap2.projectId}').`,
    };
  }

  if (snap1.inspectionSamplingMode !== snap2.inspectionSamplingMode) {
    return {
      isComparable: false,
      reason: "INSPECTION_SCOPE_CHANGED",
      details: `Inspection sampling scope changed between snapshots (${snap1.inspectionSamplingMode} vs ${snap2.inspectionSamplingMode}). Do not compare raw counts directly.`,
    };
  }

  if (snap1.mapperVersion !== snap2.mapperVersion) {
    return {
      isComparable: false,
      reason: "PROVIDER_MAPPER_VERSION_MISMATCH",
      details: `Google state mapper versions differ ('${snap1.mapperVersion}' vs '${snap2.mapperVersion}').`,
    };
  }

  return { isComparable: true };
}
