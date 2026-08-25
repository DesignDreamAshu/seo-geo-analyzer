/**
 * Phase 17: Migration Central Configuration & Policy Controls.
 * Configurable, auditable thresholds for high-value classification and GSC recovery.
 */

export interface MigrationPolicy {
  policyName: string;
  selectionSource: "CONFIGURED" | "AUTOMATIC_DEFAULT" | "PROJECT_ADAPTED";
  highValueClickThreshold: number; // default 50 clicks
  highValueImpressionThreshold: number; // default 500 impressions
  highValueBacklinkThreshold: number; // default 5 backlinks
  similarityThresholdForEquivalence: number; // default 0.80
  minDaysForRecoveryEvaluation: number; // default 7 days
  stableRecoveryThreshold: number; // default 0.85 (85%)
  declineRecoveryThreshold: number; // default 0.50 (50%)
}

export const DEFAULT_MIGRATION_POLICY: MigrationPolicy = {
  policyName: "DEFAULT_MIGRATION_POLICY",
  selectionSource: "AUTOMATIC_DEFAULT",
  highValueClickThreshold: 50,
  highValueImpressionThreshold: 500,
  highValueBacklinkThreshold: 5,
  similarityThresholdForEquivalence: 0.8,
  minDaysForRecoveryEvaluation: 7,
  stableRecoveryThreshold: 0.85,
  declineRecoveryThreshold: 0.5,
};

export const STRICT_ENTERPRISE_MIGRATION_POLICY: MigrationPolicy = {
  policyName: "STRICT_ENTERPRISE_MIGRATION_POLICY",
  selectionSource: "CONFIGURED",
  highValueClickThreshold: 20,
  highValueImpressionThreshold: 200,
  highValueBacklinkThreshold: 2,
  similarityThresholdForEquivalence: 0.85,
  minDaysForRecoveryEvaluation: 14,
  stableRecoveryThreshold: 0.9,
  declineRecoveryThreshold: 0.6,
};

export const SMALL_SAMPLE_MIGRATION_POLICY: MigrationPolicy = {
  policyName: "SMALL_SAMPLE_MIGRATION_POLICY",
  selectionSource: "PROJECT_ADAPTED",
  highValueClickThreshold: 10,
  highValueImpressionThreshold: 100,
  highValueBacklinkThreshold: 1,
  similarityThresholdForEquivalence: 0.75,
  minDaysForRecoveryEvaluation: 5,
  stableRecoveryThreshold: 0.8,
  declineRecoveryThreshold: 0.4,
};
