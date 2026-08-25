/**
 * Phase 14: Off-Page & Backlink Intelligence — Centralized Policies & Thresholds.
 * Eliminates ad-hoc hardcoded constants in favor of configurable, auditable policies.
 */

export interface BacklinkIntelligencePolicy {
  policyName: string;
  selectionSource: "CONFIGURED" | "AUTOMATIC_DEFAULT" | "SAMPLE_ADAPTED";
  sitewideRepetitionThreshold: number; // e.g. 15 links from same domain -> structural check
  exactMatchReviewThresholdRatio: number; // e.g. 0.30 (30%+) with min sample
  minSampleSizeForAnchorReview: number; // e.g. 50 anchors required before reviewing distribution
  burstThresholdRatio: number; // e.g. 2.0 (100%+ increase)
  minBurstObservedCount: number; // e.g. 30 links
  suspiciousAnchorDomainThreshold: number; // e.g. 8 domains
  minCompetitorSourcesForProspect: number; // e.g. 2 competitors linked
  cacheTtlHours: number; // default 72h
  maxBacklinksProcessedPerDomain: number; // budget control (default 10,000)
}

export const DEFAULT_BACKLINK_POLICY: BacklinkIntelligencePolicy = {
  policyName: "DEFAULT_BACKLINK_POLICY",
  selectionSource: "AUTOMATIC_DEFAULT",
  sitewideRepetitionThreshold: 15,
  exactMatchReviewThresholdRatio: 0.3,
  minSampleSizeForAnchorReview: 50,
  burstThresholdRatio: 2.0,
  minBurstObservedCount: 30,
  suspiciousAnchorDomainThreshold: 8,
  minCompetitorSourcesForProspect: 2,
  cacheTtlHours: 72,
  maxBacklinksProcessedPerDomain: 10000,
};

export const STRICT_ENTERPRISE_BACKLINK_POLICY: BacklinkIntelligencePolicy = {
  policyName: "STRICT_ENTERPRISE_BACKLINK_POLICY",
  selectionSource: "CONFIGURED",
  sitewideRepetitionThreshold: 10,
  exactMatchReviewThresholdRatio: 0.25,
  minSampleSizeForAnchorReview: 30,
  burstThresholdRatio: 1.5,
  minBurstObservedCount: 20,
  suspiciousAnchorDomainThreshold: 5,
  minCompetitorSourcesForProspect: 3,
  cacheTtlHours: 48,
  maxBacklinksProcessedPerDomain: 50000,
};

export const SMALL_SAMPLE_BACKLINK_POLICY: BacklinkIntelligencePolicy = {
  policyName: "SMALL_SAMPLE_BACKLINK_POLICY",
  selectionSource: "SAMPLE_ADAPTED",
  sitewideRepetitionThreshold: 5,
  exactMatchReviewThresholdRatio: 0.4,
  minSampleSizeForAnchorReview: 10,
  burstThresholdRatio: 2.5,
  minBurstObservedCount: 10,
  suspiciousAnchorDomainThreshold: 3,
  minCompetitorSourcesForProspect: 1,
  cacheTtlHours: 24,
  maxBacklinksProcessedPerDomain: 2000,
};
