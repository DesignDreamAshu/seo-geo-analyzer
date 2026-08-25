/**
 * Immutable International SEO Snapshot Builder & Comparability Gate.
 * Guarantees runtime immutability and enforces strict comparability requirements.
 */

import { InternationalSeoSnapshot, InternationalApplicability, LocaleDefinition, HreflangCluster, UrlArchitectureType } from "./types";

export function createInternationalSeoSnapshot(params: {
  snapshotId: string;
  projectId: string;
  applicability: InternationalApplicability;
  locales: LocaleDefinition[];
  clusters: HreflangCluster[];
  urlArchitecture: UrlArchitectureType;
  retrievalTimestamp?: string;
  completeness?: "INTERNATIONAL_DATA_COMPLETE" | "INTERNATIONAL_DATA_PARTIAL" | "INTERNATIONAL_SEO_NOT_APPLICABLE";
}): InternationalSeoSnapshot {
  const retrievalTimestamp = params.retrievalTimestamp || new Date().toISOString();
  const completeness = params.completeness || "INTERNATIONAL_DATA_COMPLETE";

  const frozenLocales = Object.freeze(params.locales.map((l) => Object.freeze({ ...l })));
  const frozenClusters = Object.freeze(params.clusters.map((c) => Object.freeze({ ...c })));

  return Object.freeze({
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    applicability: params.applicability,
    locales: frozenLocales as any,
    clusters: frozenClusters as any,
    urlArchitecture: params.urlArchitecture,
    retrievalTimestamp,
    completeness,
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  });
}

export type InternationalComparabilityResult =
  | { isComparable: true }
  | {
      isComparable: false;
      reason: "SNAPSHOTS_NOT_COMPARABLE" | "LOCALE_CONFIGURATION_CHANGED" | "INTERNATIONAL_DATA_PARTIAL_INCONCLUSIVE";
      details: string;
    };

export function validateInternationalSnapshotComparability(
  snap1: InternationalSeoSnapshot,
  snap2: InternationalSeoSnapshot
): InternationalComparabilityResult {
  if (snap1.projectId !== snap2.projectId) {
    return {
      isComparable: false,
      reason: "SNAPSHOTS_NOT_COMPARABLE",
      details: `Project IDs do not match ('${snap1.projectId}' vs '${snap2.projectId}').`,
    };
  }

  if (snap1.completeness === "INTERNATIONAL_DATA_PARTIAL" || snap2.completeness === "INTERNATIONAL_DATA_PARTIAL") {
    return {
      isComparable: false,
      reason: "INTERNATIONAL_DATA_PARTIAL_INCONCLUSIVE",
      details: "One or both snapshots represent partial crawl datasets. Historical comparison suppressed.",
    };
  }

  if (snap1.locales.length !== snap2.locales.length) {
    return {
      isComparable: false,
      reason: "LOCALE_CONFIGURATION_CHANGED",
      details: `Configured locales changed between snapshots (${snap1.locales.length} -> ${snap2.locales.length} locales).`,
    };
  }

  return { isComparable: true };
}
