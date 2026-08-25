/**
 * Phase 16: Centralized Configuration & Policies for International SEO.
 * Establishes auditable thresholds for regional variant similarity, cluster completeness, and source validation.
 */

export interface InternationalSeoPolicy {
  policyName: string;
  selectionSource: "CONFIGURED" | "AUTOMATIC_DEFAULT" | "SAMPLE_ADAPTED";
  similarityThresholdForRegionalVariant: number; // e.g. 0.85 (85%+ text similarity)
  minClusterSampleSize: number; // e.g. 2 locales
  cacheTtlHours: number; // default 72h
}

export const DEFAULT_INTERNATIONAL_POLICY: InternationalSeoPolicy = {
  policyName: "DEFAULT_INTERNATIONAL_POLICY",
  selectionSource: "AUTOMATIC_DEFAULT",
  similarityThresholdForRegionalVariant: 0.85,
  minClusterSampleSize: 2,
  cacheTtlHours: 72,
};

export const STRICT_INTERNATIONAL_POLICY: InternationalSeoPolicy = {
  policyName: "STRICT_INTERNATIONAL_POLICY",
  selectionSource: "CONFIGURED",
  similarityThresholdForRegionalVariant: 0.75,
  minClusterSampleSize: 3,
  cacheTtlHours: 48,
};

export const SMALL_SAMPLE_INTERNATIONAL_POLICY: InternationalSeoPolicy = {
  policyName: "SMALL_SAMPLE_INTERNATIONAL_POLICY",
  selectionSource: "SAMPLE_ADAPTED",
  similarityThresholdForRegionalVariant: 0.9,
  minClusterSampleSize: 2,
  cacheTtlHours: 24,
};
