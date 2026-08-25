/**
 * Migration Snapshot Builder & Comparability Gate.
 * Enforces runtime immutability and validates snapshot comparability.
 */

import { MigrationSnapshot, MigrationReadinessState } from "./types";

export function createMigrationSnapshot(params: {
  snapshotId: string;
  migrationId: string;
  projectId: string;
  stage: "PRE_MIGRATION" | "STAGING" | "LAUNCH" | "POST_LAUNCH";
  sourceUrlsCount: number;
  destinationUrlsCount: number;
  mappingsCount: number;
  readinessState: MigrationReadinessState;
  retrievalTimestamp?: string;
  completeness?: "MIGRATION_DATA_COMPLETE" | "MIGRATION_DATA_PARTIAL";
}): MigrationSnapshot {
  const retrievalTimestamp = params.retrievalTimestamp || new Date().toISOString();
  const completeness = params.completeness || "MIGRATION_DATA_COMPLETE";

  return Object.freeze({
    snapshotId: params.snapshotId,
    migrationId: params.migrationId,
    projectId: params.projectId,
    stage: params.stage,
    sourceUrlsCount: params.sourceUrlsCount,
    destinationUrlsCount: params.destinationUrlsCount,
    mappingsCount: params.mappingsCount,
    readinessState: params.readinessState,
    retrievalTimestamp,
    completeness,
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type MigrationComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason: "MIGRATION_PROJECT_MISMATCH" | "MIGRATION_DATA_PARTIAL_INCONCLUSIVE";
      details: string;
    };

export function validateMigrationSnapshotComparability(
  snap1: MigrationSnapshot,
  snap2: MigrationSnapshot
): MigrationComparabilityResult {
  if (snap1.migrationId !== snap2.migrationId || snap1.projectId !== snap2.projectId) {
    return {
      isComparable: false,
      reason: "MIGRATION_PROJECT_MISMATCH",
      details: `Migration IDs or Project IDs do not match ('${snap1.migrationId}' vs '${snap2.migrationId}').`,
    };
  }

  if (snap1.completeness === "MIGRATION_DATA_PARTIAL" || snap2.completeness === "MIGRATION_DATA_PARTIAL") {
    return {
      isComparable: false,
      reason: "MIGRATION_DATA_PARTIAL_INCONCLUSIVE",
      details: "One or both migration snapshots represent incomplete crawl datasets.",
    };
  }

  return { isComparable: true };
}
