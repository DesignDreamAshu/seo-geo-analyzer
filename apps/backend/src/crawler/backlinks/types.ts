/**
 * Phase 14: Off-Page & Backlink Intelligence — Hardened Core Data Types.
 * Adheres strictly to non-fabrication, immutable snapshots, comparability gates,
 * namespaced provider metrics, and zero fake Domain Authority / toxic-score / disavow automation.
 */

import { CompetitorRelationship } from "../competitor-serp/types";

export type BacklinkProviderType =
  | "AHREFS"
  | "SEMRUSH"
  | "MOZ"
  | "MAJESTIC"
  | "DATAFORSEO"
  | "MANUAL_DATASET"
  | "MOCK_BACKLINK_PROVIDER"
  | "UNCONFIGURED";

export type BacklinkProviderImplementationState =
  | "IMPLEMENTED_AND_TESTED"
  | "ARCHITECTURE_READY"
  | "NOT_CONFIGURED"
  | "UNSUPPORTED";

export type BacklinkDatasetStatus =
  | "BACKLINK_DATA_FRESH_COMPLETE"
  | "BACKLINK_DATA_PARTIAL"
  | "BACKLINK_DATA_TRUNCATED"
  | "BACKLINK_DATA_STALE"
  | "BACKLINK_DATA_NOT_CONFIGURED"
  | "BACKLINK_DATA_UNAVAILABLE"
  | "BACKLINK_PROVIDER_AUTH_FAILED"
  | "BACKLINK_PROVIDER_QUOTA_EXCEEDED"
  | "BACKLINK_FETCH_FAILED"
  | "INSUFFICIENT_BACKLINK_DATA";

export type LinkAttribute = "FOLLOW" | "NOFOLLOW" | "SPONSORED" | "UGC" | "UNKNOWN";

export type AnchorClassification =
  | "BRANDED"
  | "NAKED_URL"
  | "GENERIC"
  | "PARTIAL_MATCH"
  | "EXACT_MATCH_CANDIDATE"
  | "IMAGE_NO_TEXT"
  | "UNKNOWN";

export type SourceRelevanceState =
  | "HIGHLY_RELEVANT_SOURCE"
  | "RELATED_SOURCE"
  | "WEAKLY_RELATED_SOURCE"
  | "UNRELATED_SOURCE"
  | "UNKNOWN_RELEVANCE";

export type SourcePlatformType =
  | "EDITORIAL_PUBLICATION"
  | "COMPANY_BLOG"
  | "DIRECTORY"
  | "FORUM_COMMUNITY"
  | "SOCIAL_PROFILE"
  | "DOCUMENTATION"
  | "EDUCATIONAL"
  | "GOVERNMENT"
  | "MARKETPLACE"
  | "UNKNOWN";

export type LinkRiskState =
  | "NORMAL_LINK"
  | "LOW_INFORMATION_LINK"
  | "SUSPICIOUS_PATTERN"
  | "MANUAL_REVIEW"
  | "INSUFFICIENT_EVIDENCE";

export type BacklinkHistoryState =
  | "NEWLY_OBSERVED_BACKLINK"
  | "BACKLINK_NO_LONGER_OBSERVED"
  | "STABLE_OBSERVED_BACKLINK"
  | "INSUFFICIENT_DATA";

export type ReferringDomainHistoryState =
  | "NEWLY_OBSERVED_REFERRING_DOMAIN"
  | "REFERRING_DOMAIN_NO_LONGER_OBSERVED"
  | "STABLE_OBSERVED_REFERRING_DOMAIN"
  | "INSUFFICIENT_DATA";

export type CompetitorLinkGapState =
  | "OWN_ONLY_REFERRING_DOMAIN"
  | "COMPETITOR_ONLY_REFERRING_DOMAIN"
  | "SHARED_REFERRING_DOMAIN";

export type RedirectEquivalenceConfidence =
  | "HIGH_EQUIVALENCE"
  | "MEDIUM_EQUIVALENCE"
  | "LOW_EQUIVALENCE"
  | "NO_EQUIVALENT_TARGET"
  | "MANUAL_REVIEW";

export type SitewideRepetitionClassification =
  | "NOT_SITEWIDE"
  | "SITEWIDE_TEMPLATE_DOMINANT"
  | "POSSIBLE_SITEWIDE_REPETITION";

export interface NamespacedProviderMetrics {
  ahrefsDomainRating?: number;
  mozDomainAuthority?: number;
  semrushAuthorityScore?: number;
  majesticTrustFlow?: number;
  majesticCitationFlow?: number;
  providerSpamScore?: number;
}

export interface BacklinkRecord {
  backlinkId: string;
  sourceUrl: string;
  sourceNormalizedUrl: string;
  sourceHostname: string;
  sourceRegistrableDomain: string;
  sourceSubdomain?: string;
  sourceTitle?: string;
  sourceLanguage?: string;
  sourceHttpStatus?: number;
  sourcePlatformType: SourcePlatformType;
  targetUrl: string;
  targetNormalizedUrl: string;
  anchorText: string;
  anchorClassification: AnchorClassification;
  linkAttributes: LinkAttribute[];
  isSitewideRepetitionCandidate?: boolean;
  firstSeenDate?: string;
  lastSeenDate?: string;
  providerMetrics?: NamespacedProviderMetrics;
  relevanceState: SourceRelevanceState;
  riskState: LinkRiskState;
  provenance: {
    provider: BacklinkProviderType;
    providerVersion: string;
    retrievalTimestamp: string;
    snapshotId?: string;
  };
}

export interface ReferringDomainAggregate {
  domain: string;
  rootDomain: string;
  observedBacklinkCount: number;
  uniqueTargetUrlCount: number;
  targetUrls: string[];
  sampleAnchors: string[];
  anchorDistribution: Record<AnchorClassification, number>;
  attributeDistribution: Record<LinkAttribute, number>;
  sourcePlatformType: SourcePlatformType;
  relevanceState: SourceRelevanceState;
  sitewideClassification: SitewideRepetitionClassification;
  firstSeenDate?: string;
  lastSeenDate?: string;
  providerMetrics?: NamespacedProviderMetrics;
  provenance: {
    provider: BacklinkProviderType;
    snapshotId: string;
  };
}

export interface BacklinkSnapshot {
  snapshotId: string;
  projectId: string;
  targetDomain: string;
  targetRegistrableDomain: string;
  provider: BacklinkProviderType;
  providerVersion: string;
  indexType: "LIVE" | "FRESH" | "HISTORIC" | "MOCK";
  retrievalTimestamp: string;
  completeness: BacklinkDatasetStatus;
  rowLimit: number;
  observedBacklinks: BacklinkRecord[];
  referringDomains: ReferringDomainAggregate[];
  datasetFingerprint: string;
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface BrokenBacklinkTargetOpportunity {
  targetUrl: string;
  statusCode: number; // e.g. 404, 410
  observedBacklinkCount: number;
  observedReferringDomainCount: number;
  relevantSourceCount: number;
  sampleReferringDomains: string[];
  existingEquivalentUrlCandidate?: string;
  redirectEquivalenceConfidence: RedirectEquivalenceConfidence;
  recommendedAction: string;
  requiresOutreach: boolean;
}

export interface RedirectTargetBacklinkReview {
  targetUrl: string;
  redirectChain: string[];
  finalDestinationUrl: string;
  observedBacklinkCount: number;
  observedReferringDomainCount: number;
  reviewNote: string;
}

export interface CanonicalTargetBacklinkReview {
  targetUrl: string;
  declaredCanonicalUrl: string;
  observedBacklinkCount: number;
  observedReferringDomainCount: number;
  reviewNote: string;
}

export interface SuspiciousLinkPatternReview {
  patternId: string;
  patternType:
    | "LARGE_BURST_IDENTICAL_ANCHORS"
    | "HIGH_SITEWIDE_TEMPLATE_REPETITION"
    | "UNRELATED_DOMAINS_IDENTICAL_TEMPLATES"
    | "AUTOGENERATED_URL_PATTERNS"
    | "MANUAL_DISAVOW_REVIEW";
  affectedDomainCount: number;
  affectedBacklinkCount: number;
  sampleSourceDomains: string[];
  sampleAnchors: string[];
  timeframeDays?: number;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  interpretationNote: string;
  isAutomatedDisavow: false; // Invariant: always false
}

export interface LinkProspectReview {
  referringDomain: string;
  rootDomain: string;
  sourcePlatformType: SourcePlatformType;
  sourceRelevance: SourceRelevanceState;
  linkedCompetitors: Array<{
    domain: string;
    relationship: CompetitorRelationship;
    observedBacklinkCount: number;
  }>;
  linkedCompetitorCount: number;
  totalCompetitorsEvaluated: number;
  competitorPrevalenceFraction: string; // e.g. "3 of 3"
  observedLinkToOwnProject: boolean;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  advisoryOutreachGuidance: string;
}

export interface LinkableAssetSignal {
  targetUrl: string;
  title?: string;
  observedReferringDomainCount: number;
  observedBacklinkCount: number;
  primaryAnchorThemes: string[];
  phase12ClusterId?: string;
  assetType: "GUIDE_RESEARCH" | "TOOL_CALCULATOR" | "DATA_STATISTICS" | "GENERAL_RESOURCE";
  strategicInsight: string;
}

export interface OffPageBacklinkIntelligenceReport {
  generatedAt: string;
  projectId: string;
  targetDomain: string;
  provider: BacklinkProviderType;
  providerStatus: BacklinkDatasetStatus;
  providerImplementationState: BacklinkProviderImplementationState;
  providerVersion: string;
  indexType: "LIVE" | "FRESH" | "HISTORIC" | "MOCK";
  appliedPolicy: {
    policyName: string;
    selectionSource: string;
    sitewideRepetitionThreshold: number;
    exactMatchReviewThresholdRatio: number;
    minSampleSizeForAnchorReview: number;
    burstThresholdRatio: number;
    minCompetitorSourcesForProspect: number;
  };
  totalObservedBacklinkRecords: number;
  totalObservedReferringDomains: number;
  datasetCompletenessNote: string;
  attributeDistribution: Record<LinkAttribute, number>;
  anchorDistribution: {
    counts: Record<AnchorClassification, number>;
    percentages: Record<AnchorClassification, number>;
    sampleSize: number;
    distributionReview?: {
      finding: "ANCHOR_DISTRIBUTION_REVIEW";
      rationale: string;
    };
  };
  linkedPageDistribution: {
    homepageLinks: number;
    internalPageLinks: number;
    uniqueTargetUrlsCount: number;
    topLinkedPages: Array<{ url: string; backlinkCount: number; referringDomainCount: number }>;
  };
  brokenTargetOpportunities: BrokenBacklinkTargetOpportunity[];
  redirectTargetReviews: RedirectTargetBacklinkReview[];
  canonicalTargetReviews: CanonicalTargetBacklinkReview[];
  suspiciousPatternReviews: SuspiciousLinkPatternReview[];
  linkableAssetSignals: LinkableAssetSignal[];
  competitorLinkGaps: {
    totalCompetitorsAnalyzed: number;
    includedRelationshipTypes: CompetitorRelationship[];
    ownOnlyReferringDomainsCount: number;
    sharedReferringDomainsCount: number;
    competitorOnlyReferringDomainsCount: number;
    linkProspectReviews: LinkProspectReview[];
  };
  historicalChanges: {
    isComparable: boolean;
    incomparabilityReason?: string;
    newlyObservedBacklinksCount: number;
    noLongerObservedBacklinksCount: number;
    newlyObservedReferringDomainsCount: number;
    noLongerObservedReferringDomainsCount: number;
    burstObservation?: {
      finding: "BACKLINK_BURST_OBSERVED";
      rationale: string;
    };
  };
  searchCorrelationInsights: Array<{
    pageUrl: string;
    observedBacklinkChange: string;
    observedGscChange: string;
    nature: "CORRELATIONAL";
    rationale: string;
  }>;
  governanceLimitations: string[];
  immutabilityStatement: string;
}
