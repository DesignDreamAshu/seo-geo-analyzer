/**
 * Immutable SERP Snapshot Builder & Hardened Comparability Gate.
 * Enforces strict comparability requirements: US != India, Desktop != Mobile,
 * Jaipur != National India, Depth 10 != Depth 100, and Provider Version safety.
 */

import { SerpSnapshot, SerpRequest, OrganicSerpResult, SerpFeatureItem, SerpProviderType, SerpDevice } from "./types";
import { isOwnDomain } from "./normalization";

export function createSerpSnapshot(params: {
  snapshotId: string;
  projectId: string;
  provider: SerpProviderType;
  providerVersion: string;
  request: SerpRequest;
  normalizedQuery: string;
  timestamp?: string;
  organicResults: OrganicSerpResult[];
  serpFeatures?: SerpFeatureItem[];
  ownDomainAliases?: string[];
  providerCompleteness?: "COMPLETE" | "PARTIAL" | "TRUNCATED";
  rawProviderReference?: string;
}): SerpSnapshot {
  const timestamp = params.timestamp || new Date().toISOString();
  const ownDomainAliases = params.ownDomainAliases || [];

  // Categorize organic results and partition own-site results
  const taggedOrganic: OrganicSerpResult[] = params.organicResults.map((r) => ({
    ...r,
    isOwnDomain: isOwnDomain(r.url, ownDomainAliases),
  }));

  const ownSiteResults: OrganicSerpResult[] = taggedOrganic.filter((r) => r.isOwnDomain);
  const serpFeatures: SerpFeatureItem[] = [...(params.serpFeatures || [])];

  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    provider: params.provider,
    providerVersion: params.providerVersion,
    query: params.request.query,
    clusterId: params.request.clusterId,
    normalizedQuery: params.normalizedQuery,
    country: (params.request.country || "us").toLowerCase(),
    language: (params.request.language || "en").toLowerCase(),
    device: params.request.device || "DESKTOP",
    location: params.request.location,
    locationGranularity: params.request.locationGranularity || "COUNTRY",
    depth: params.request.depth || taggedOrganic.length || 20,
    timestamp,
    organicResults: Object.freeze(taggedOrganic) as any,
    serpFeatures: Object.freeze(serpFeatures) as any,
    ownSiteResults: Object.freeze(ownSiteResults) as any,
    providerCompleteness: params.providerCompleteness || "COMPLETE",
    rawProviderReference: params.rawProviderReference,
    selectionReason: params.request.selectionReason,
  });
}

export type SerpComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason:
        | "SERP_SNAPSHOTS_NOT_COMPARABLE"
        | "SERP_PROVIDER_CHANGED"
        | "SERP_PROVIDER_VERSION_CHANGED"
        | "SERP_DEPTH_INCOMPATIBLE"
        | "SERP_DATA_PARTIAL_INCONCLUSIVE";
      details: string;
    };

/**
 * Validates whether two SERP snapshots are legitimate for historical comparison.
 * Requires compatible query, country, language, device, location granularity, depth, and provider.
 */
export function validateSerpComparability(
  snap1: SerpSnapshot,
  snap2: SerpSnapshot
): SerpComparabilityResult {
  // 1. Completeness Check
  if (snap1.providerCompleteness === "PARTIAL" || snap2.providerCompleteness === "PARTIAL") {
    return {
      isComparable: false,
      reason: "SERP_DATA_PARTIAL_INCONCLUSIVE",
      details: "One or both snapshots have partial/truncated provider results. Historical comparison is inconclusive.",
    };
  }

  // 2. Query check
  if (snap1.normalizedQuery.toLowerCase() !== snap2.normalizedQuery.toLowerCase()) {
    return {
      isComparable: false,
      reason: "SERP_SNAPSHOTS_NOT_COMPARABLE",
      details: `Normalized queries do not match ('${snap1.normalizedQuery}' vs '${snap2.normalizedQuery}').`,
    };
  }

  // 3. Provider check
  if (snap1.provider !== snap2.provider) {
    return {
      isComparable: false,
      reason: "SERP_PROVIDER_CHANGED",
      details: `Provider changed from '${snap1.provider}' to '${snap2.provider}'. Switching SERP providers introduces algorithmic differences.`,
    };
  }

  // 4. Provider Version check
  if (snap1.providerVersion !== snap2.providerVersion) {
    return {
      isComparable: false,
      reason: "SERP_PROVIDER_VERSION_CHANGED",
      details: `Provider version changed from '${snap1.providerVersion}' to '${snap2.providerVersion}'. Engine signatures are not automatically comparable.`,
    };
  }

  // 5. Country / Locale check
  if (snap1.country !== snap2.country) {
    return {
      isComparable: false,
      reason: "SERP_SNAPSHOTS_NOT_COMPARABLE",
      details: `Country context differs ('${snap1.country}' vs '${snap2.country}'). Geographic rankings cannot be compared directly.`,
    };
  }

  // 6. Language check
  if (snap1.language !== snap2.language) {
    return {
      isComparable: false,
      reason: "SERP_SNAPSHOTS_NOT_COMPARABLE",
      details: `Language context differs ('${snap1.language}' vs '${snap2.language}').`,
    };
  }

  // 7. Device check
  if (snap1.device !== snap2.device) {
    return {
      isComparable: false,
      reason: "SERP_SNAPSHOTS_NOT_COMPARABLE",
      details: `Device context differs ('${snap1.device}' vs '${snap2.device}'). Desktop and mobile SERPs are distinct search environments.`,
    };
  }

  // 8. Localized Location check (e.g. Jaipur != national)
  if (snap1.location !== snap2.location || snap1.locationGranularity !== snap2.locationGranularity) {
    return {
      isComparable: false,
      reason: "SERP_SNAPSHOTS_NOT_COMPARABLE",
      details: `Location granularity or target location differs ('${snap1.location || "national"}' vs '${snap2.location || "national"}').`,
    };
  }

  // 9. Tracked Depth check (e.g. depth 10 vs depth 100)
  if (Math.abs(snap1.depth - snap2.depth) >= 20) {
    return {
      isComparable: false,
      reason: "SERP_DEPTH_INCOMPATIBLE",
      details: `Tracked depth differs significantly (depth ${snap1.depth} vs depth ${snap2.depth}). Depth-dependent position comparisons require compatible observation boundaries.`,
    };
  }

  return { isComparable: true };
}
