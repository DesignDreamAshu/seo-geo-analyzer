/**
 * Phase 22: Experiment Snapshots & Runtime Immutability.
 * Provides durable snapshot creation and strict cross-version / cross-project comparability gates.
 */

import { ExperimentEvaluation, ExperimentSnapshot } from "./types";

export interface SnapshotComparabilityResult {
  isComparable: boolean;
  reason?:
    | "PROJECT_MISMATCH"
    | "COHORT_CHANGED"
    | "EXPERIMENT_MODEL_CHANGED"
    | "EXPERIMENT_POLICY_CHANGED"
    | "COMPARABLE";
  details: string;
}

export function createExperimentSnapshot(evaluation: ExperimentEvaluation): ExperimentSnapshot {
  const snapshot: ExperimentSnapshot = {
    snapshotId: `snap_${evaluation.experimentId}_${Date.now()}`,
    experimentId: evaluation.experimentId,
    projectId: evaluation.projectId,
    createdAt: new Date().toISOString(),
    evaluation,
    modelVersion: evaluation.modelVersion,
    policyVersion: evaluation.policyVersion,
    immutabilityStatement: "RUNTIME_IMMUTABLE_FREEZE",
  };

  return Object.freeze(snapshot);
}

export function validateExperimentSnapshotComparability(
  snapA: ExperimentSnapshot,
  snapB: ExperimentSnapshot
): SnapshotComparabilityResult {
  if (snapA.projectId !== snapB.projectId) {
    return {
      isComparable: false,
      reason: "PROJECT_MISMATCH",
      details: `Cannot compare experiments across different projects (${snapA.projectId} vs ${snapB.projectId}).`,
    };
  }

  if (snapA.modelVersion !== snapB.modelVersion) {
    return {
      isComparable: false,
      reason: "EXPERIMENT_MODEL_CHANGED",
      details: `Analysis methodology changed between snapshots (${snapA.modelVersion} vs ${snapB.modelVersion}).`,
    };
  }

  if (snapA.policyVersion !== snapB.policyVersion) {
    return {
      isComparable: false,
      reason: "EXPERIMENT_POLICY_CHANGED",
      details: `Experiment design or threshold policy changed (${snapA.policyVersion} vs ${snapB.policyVersion}).`,
    };
  }

  // Check cohort identity preservation
  const urlsA = snapA.evaluation.treatmentCohort.map((u) => u.url).sort();
  const urlsB = snapB.evaluation.treatmentCohort.map((u) => u.url).sort();
  const isCohortPreserved =
    urlsA.length === urlsB.length && urlsA.every((u, idx) => u === urlsB[idx]);

  if (!isCohortPreserved) {
    return {
      isComparable: false,
      reason: "COHORT_CHANGED",
      details: "Treatment cohort membership changed between snapshots.",
    };
  }

  return {
    isComparable: true,
    reason: "COMPARABLE",
    details: "Snapshots share identical project, cohort, model, and policy parameters.",
  };
}
