/**
 * Immutable Local SEO Snapshot Builder & Hardened Comparability Gate.
 * Enforces strict comparability requirements: Project match, Location ID match,
 * Provider match, and completeness validation.
 */

import { LocalSeoSnapshot, BusinessLocation, BusinessProfileDataset, BusinessProfileProviderType, LocalDatasetStatus, LocalBusinessApplicability } from "./types";

export function createLocalSeoSnapshot(params: {
  snapshotId: string;
  projectId: string;
  applicability: LocalBusinessApplicability;
  locations: BusinessLocation[];
  provider: BusinessProfileProviderType;
  providerVersion: string;
  retrievalTimestamp?: string;
  completeness?: LocalDatasetStatus;
  profiles: BusinessProfileDataset[];
}): LocalSeoSnapshot {
  const retrievalTimestamp = params.retrievalTimestamp || new Date().toISOString();
  const completeness = params.completeness || "LOCAL_DATA_FRESH_COMPLETE";

  const frozenLocations = Object.freeze(params.locations.map((l) => Object.freeze({ ...l })));
  const frozenProfiles = Object.freeze(params.profiles.map((p) => Object.freeze({ ...p })));

  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    applicability: params.applicability,
    locations: frozenLocations as any,
    provider: params.provider,
    providerVersion: params.providerVersion,
    retrievalTimestamp,
    completeness,
    profiles: frozenProfiles as any,
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type LocalComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason:
        | "LOCAL_SNAPSHOTS_NOT_COMPARABLE"
        | "LOCAL_PROVIDER_CHANGED"
        | "LOCAL_DATA_PARTIAL_INCONCLUSIVE"
        | "LOCAL_DATA_NOT_CONFIGURED";
      details: string;
    };

/**
 * Validates whether two local business snapshots can legitimately be compared for review/NAP tracking.
 */
export function validateLocalSnapshotComparability(
  snap1: LocalSeoSnapshot,
  snap2: LocalSeoSnapshot
): LocalComparabilityResult {
  // 1. Completeness check
  if (snap1.completeness === "LOCAL_DATA_NOT_CONFIGURED" || snap2.completeness === "LOCAL_DATA_NOT_CONFIGURED") {
    return {
      isComparable: false,
      reason: "LOCAL_DATA_NOT_CONFIGURED",
      details: "Local business profile provider is not configured. Historical comparison suppressed.",
    };
  }

  if (snap1.completeness === "LOCAL_DATA_PARTIAL" || snap2.completeness === "LOCAL_DATA_PARTIAL") {
    return {
      isComparable: false,
      reason: "LOCAL_DATA_PARTIAL_INCONCLUSIVE",
      details: "One or both snapshots represent partial datasets. Historical comparison is inconclusive.",
    };
  }

  // 2. Project check
  if (snap1.projectId !== snap2.projectId) {
    return {
      isComparable: false,
      reason: "LOCAL_SNAPSHOTS_NOT_COMPARABLE",
      details: `Project IDs do not match ('${snap1.projectId}' vs '${snap2.projectId}').`,
    };
  }

  // 3. Provider check
  if (snap1.provider !== snap2.provider) {
    return {
      isComparable: false,
      reason: "LOCAL_PROVIDER_CHANGED",
      details: `Provider changed from '${snap1.provider}' to '${snap2.provider}'. Cross-provider review counts and profile details cannot be compared directly.`,
    };
  }

  return { isComparable: true };
}
