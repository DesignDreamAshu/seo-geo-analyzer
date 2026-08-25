/**
 * Phase 15: Local SEO & Location Intelligence — Centralized Configuration & Policies.
 * Establishes auditable thresholds for doorway detection, review gap analysis, and citation matching.
 */

export interface LocalSeoPolicy {
  policyName: string;
  selectionSource: "CONFIGURED" | "AUTOMATIC_DEFAULT" | "SAMPLE_ADAPTED";
  minCityTokensForDoorwayReview: number; // e.g. 5 city pages
  doorwaySimilarityThreshold: number; // e.g. 0.85 (85%+ structural/copy similarity)
  reviewGapSampleSize: number; // e.g. 5 competitors
  cacheTtlHours: number; // default 72h
}

export const DEFAULT_LOCAL_SEO_POLICY: LocalSeoPolicy = {
  policyName: "DEFAULT_LOCAL_SEO_POLICY",
  selectionSource: "AUTOMATIC_DEFAULT",
  minCityTokensForDoorwayReview: 5,
  doorwaySimilarityThreshold: 0.85,
  reviewGapSampleSize: 5,
  cacheTtlHours: 72,
};

export const STRICT_LOCAL_SEO_POLICY: LocalSeoPolicy = {
  policyName: "STRICT_LOCAL_SEO_POLICY",
  selectionSource: "CONFIGURED",
  minCityTokensForDoorwayReview: 3,
  doorwaySimilarityThreshold: 0.75,
  reviewGapSampleSize: 10,
  cacheTtlHours: 48,
};

export const SMALL_SAMPLE_LOCAL_SEO_POLICY: LocalSeoPolicy = {
  policyName: "SMALL_SAMPLE_LOCAL_SEO_POLICY",
  selectionSource: "SAMPLE_ADAPTED",
  minCityTokensForDoorwayReview: 3,
  doorwaySimilarityThreshold: 0.9,
  reviewGapSampleSize: 2,
  cacheTtlHours: 24,
};
