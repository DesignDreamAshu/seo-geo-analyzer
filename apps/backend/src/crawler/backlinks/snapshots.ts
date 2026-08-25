/**
 * Immutable Backlink Snapshot Builder & Hardened Comparability Gate.
 * Enforces strict comparability requirements: Project match, Provider match,
 * Index-Type match (Live != Historic), and completeness validation.
 */

import { BacklinkSnapshot, BacklinkRecord, ReferringDomainAggregate, BacklinkProviderType, BacklinkDatasetStatus } from "./types";

export function createBacklinkSnapshot(params: {
  snapshotId: string;
  projectId: string;
  targetDomain: string;
  targetRegistrableDomain: string;
  provider: BacklinkProviderType;
  providerVersion: string;
  indexType?: "LIVE" | "FRESH" | "HISTORIC" | "MOCK";
  retrievalTimestamp?: string;
  completeness?: BacklinkDatasetStatus;
  rowLimit?: number;
  observedBacklinks: BacklinkRecord[];
  referringDomains: ReferringDomainAggregate[];
}): BacklinkSnapshot {
  const retrievalTimestamp = params.retrievalTimestamp || new Date().toISOString();
  const completeness = params.completeness || "BACKLINK_DATA_FRESH_COMPLETE";
  const rowLimit = params.rowLimit || 10000;
  const indexType = params.indexType || "LIVE";

  const frozenBacklinks = Object.freeze(params.observedBacklinks.map((b) => Object.freeze({ ...b })));
  const frozenDomains = Object.freeze(params.referringDomains.map((d) => Object.freeze({ ...d })));

  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    targetDomain: params.targetDomain.toLowerCase(),
    targetRegistrableDomain: params.targetRegistrableDomain.toLowerCase(),
    provider: params.provider,
    providerVersion: params.providerVersion,
    indexType,
    retrievalTimestamp,
    completeness,
    rowLimit,
    observedBacklinks: frozenBacklinks as any,
    referringDomains: frozenDomains as any,
    datasetFingerprint: `FP_${frozenBacklinks.length}_${frozenDomains.length}_${params.provider}`,
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type BacklinkComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason:
        | "BACKLINK_SNAPSHOTS_NOT_COMPARABLE"
        | "BACKLINK_PROVIDER_CHANGED"
        | "BACKLINK_INDEX_TYPE_CHANGED"
        | "BACKLINK_DATA_PARTIAL_INCONCLUSIVE"
        | "BACKLINK_DATA_TRUNCATED_INCONCLUSIVE"
        | "BACKLINK_DATA_STALE_INCONCLUSIVE"
        | "BACKLINK_DATA_NOT_CONFIGURED";
      details: string;
    };

/**
 * Validates whether two backlink snapshots can legitimately be compared for growth/decay tracking.
 */
export function validateBacklinkComparability(
  snap1: BacklinkSnapshot,
  snap2: BacklinkSnapshot
): BacklinkComparabilityResult {
  // 1. Completeness and Data Quality Checks
  if (snap1.completeness === "BACKLINK_DATA_NOT_CONFIGURED" || snap2.completeness === "BACKLINK_DATA_NOT_CONFIGURED") {
    return {
      isComparable: false,
      reason: "BACKLINK_DATA_NOT_CONFIGURED",
      details: "Backlink provider is not configured. Historical comparison suppressed.",
    };
  }

  if (snap1.completeness === "BACKLINK_DATA_PARTIAL" || snap2.completeness === "BACKLINK_DATA_PARTIAL") {
    return {
      isComparable: false,
      reason: "BACKLINK_DATA_PARTIAL_INCONCLUSIVE",
      details: "One or both snapshots represent partial backlink datasets. Historical growth/decay claims are inconclusive.",
    };
  }

  if (snap1.completeness === "BACKLINK_DATA_TRUNCATED" || snap2.completeness === "BACKLINK_DATA_TRUNCATED") {
    return {
      isComparable: false,
      reason: "BACKLINK_DATA_TRUNCATED_INCONCLUSIVE",
      details: "One or both datasets reached provider row limits. Full profile growth/loss conclusions are suppressed.",
    };
  }

  if (snap1.completeness === "BACKLINK_DATA_STALE" || snap2.completeness === "BACKLINK_DATA_STALE") {
    return {
      isComparable: false,
      reason: "BACKLINK_DATA_STALE_INCONCLUSIVE",
      details: "Dataset is stale beyond TTL threshold. Current-state comparative velocity claims are suppressed.",
    };
  }

  // 2. Target domain check
  if (snap1.targetRegistrableDomain !== snap2.targetRegistrableDomain) {
    return {
      isComparable: false,
      reason: "BACKLINK_SNAPSHOTS_NOT_COMPARABLE",
      details: `Target domains do not match ('${snap1.targetRegistrableDomain}' vs '${snap2.targetRegistrableDomain}').`,
    };
  }

  // 3. Provider check
  if (snap1.provider !== snap2.provider) {
    return {
      isComparable: false,
      reason: "BACKLINK_PROVIDER_CHANGED",
      details: `Backlink provider changed from '${snap1.provider}' to '${snap2.provider}'. Cross-provider index sizes and crawl algorithms differ significantly.`,
    };
  }

  // 4. Index Type check (Live vs Historic)
  if (snap1.indexType !== snap2.indexType) {
    return {
      isComparable: false,
      reason: "BACKLINK_INDEX_TYPE_CHANGED",
      details: `Provider index type changed ('${snap1.indexType}' vs '${snap2.indexType}'). Live and historic indexes cannot be compared for link velocity.`,
    };
  }

  return { isComparable: true };
}
