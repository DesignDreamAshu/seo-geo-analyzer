/**
 * Server Log Analysis Snapshot Builder & Hardened Comparability Gate.
 * Enforces runtime immutability and validates version/semantic comparability.
 */

import { CrawlBehaviorSnapshot, CrawlBudgetMateriality, LogDatasetCompleteness, BotRangeFreshness } from "./types";

export function createLogAnalysisSnapshot(params: {
  snapshotId: string;
  projectId: string;
  datasetStart: string;
  datasetEnd: string;
  completeness: LogDatasetCompleteness;
  totalLogLinesParsed: number;
  totalRejectedEvents: number;
  rejectionReasons?: Record<string, number>;
  totalBotRequests: number;
  verifiedGooglebotHtmlRequests: number;
  uniqueUrlsRequestedCount: number;
  crawlBudgetMateriality: CrawlBudgetMateriality;
  verifierVersion?: string;
  rangeDatasetVersion?: string;
  rangeDatasetFreshness?: BotRangeFreshness;
  policyVersion?: string;
  ingestionTimestamp?: string;
}): CrawlBehaviorSnapshot {
  const ingestionTimestamp = params.ingestionTimestamp || new Date().toISOString();
  const total = params.totalLogLinesParsed + params.totalRejectedEvents;
  const rejectionRatePercent = total > 0 ? Math.round((params.totalRejectedEvents / total) * 1000) / 10 : 0;

  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    datasetStart: params.datasetStart,
    datasetEnd: params.datasetEnd,
    ingestionTimestamp,
    completeness: params.completeness,
    totalLogLinesParsed: params.totalLogLinesParsed,
    totalRejectedEvents: params.totalRejectedEvents,
    rejectionRatePercent,
    rejectionReasons: params.rejectionReasons || {},
    totalBotRequests: params.totalBotRequests,
    verifiedGooglebotHtmlRequests: params.verifiedGooglebotHtmlRequests,
    uniqueUrlsRequestedCount: params.uniqueUrlsRequestedCount,
    crawlBudgetMateriality: params.crawlBudgetMateriality,
    verifierVersion: params.verifierVersion || "1.2.0",
    rangeDatasetVersion: params.rangeDatasetVersion || "sha256_goog_20260801",
    rangeDatasetFreshness: params.rangeDatasetFreshness || "FRESH",
    policyVersion: params.policyVersion || "DEFAULT_CONTEXTUAL_LOG_POLICY",
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type LogComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason:
        | "PROJECT_MISMATCH"
        | "DATASET_INCOMPLETE_OR_INVALID"
        | "BOT_VERIFICATION_SEMANTICS_CHANGED"
        | "POLICY_VERSION_MISMATCH"
        | "PERIOD_INCOMPATIBLE";
      details: string;
    };

export function validateLogSnapshotComparability(
  snap1: CrawlBehaviorSnapshot,
  snap2: CrawlBehaviorSnapshot
): LogComparabilityResult {
  if (snap1.projectId !== snap2.projectId) {
    return {
      isComparable: false,
      reason: "PROJECT_MISMATCH",
      details: `Project IDs do not match ('${snap1.projectId}' vs '${snap2.projectId}').`,
    };
  }

  if (snap1.completeness === "INVALID" || snap2.completeness === "INVALID") {
    return {
      isComparable: false,
      reason: "DATASET_INCOMPLETE_OR_INVALID",
      details: "One or both log datasets are marked INVALID due to excessive parse failures or zero records.",
    };
  }

  if (snap1.verifierVersion !== snap2.verifierVersion || snap1.rangeDatasetVersion !== snap2.rangeDatasetVersion) {
    return {
      isComparable: false,
      reason: "BOT_VERIFICATION_SEMANTICS_CHANGED",
      details: `Bot verification dataset changed between snapshots (${snap1.rangeDatasetVersion} vs ${snap2.rangeDatasetVersion}). Reclassification must be separated from actual crawl activity changes.`,
    };
  }

  return { isComparable: true };
}
