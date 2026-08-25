/**
 * Phase 13: Competitor & SERP Intelligence — Hardened Data Contracts & Invariants.
 * Strictly adheres to non-fabrication, immutable snapshots, comparability gates,
 * evidence-depth sample-size safeguards, and clear separation of search vs business competitors.
 */

import { QueryIntent } from "../content-demand/types";

export type SerpDevice = "DESKTOP" | "MOBILE" | "UNKNOWN";

export type SerpProviderType =
  | "DATAFORSEO"
  | "SERPAPI"
  | "GOOGLE_CUSTOM_SEARCH"
  | "MANUAL_DATASET"
  | "MOCK_PROVIDER"
  | "UNCONFIGURED";

export type ProviderImplementationState =
  | "IMPLEMENTED_AND_TESTED"
  | "ARCHITECTURE_READY"
  | "NOT_CONFIGURED";

export type SerpProviderStatus =
  | "SERP_DATA_FRESH_COMPLETE"
  | "SERP_DATA_PARTIAL"
  | "SERP_DATA_STALE"
  | "SERP_DATA_NOT_CONFIGURED"
  | "SERP_PROVIDER_AUTH_FAILED"
  | "SERP_PROVIDER_QUOTA_EXCEEDED"
  | "SERP_FETCH_FAILED"
  | "INSUFFICIENT_SERP_DATA";

export type ResultType =
  | "HOMEPAGE"
  | "SERVICE_PAGE"
  | "PRODUCT_PAGE"
  | "CATEGORY_PAGE"
  | "ARTICLE_GUIDE"
  | "COMPARISON_PAGE"
  | "CASE_STUDY"
  | "DOCUMENTATION"
  | "FORUM_COMMUNITY"
  | "VIDEO"
  | "LOCAL_LISTING"
  | "UNKNOWN";

export type SerpFeatureType =
  | "FEATURED_SNIPPET"
  | "PEOPLE_ALSO_ASK"
  | "LOCAL_PACK"
  | "IMAGE_PACK"
  | "VIDEO_PACK"
  | "NEWS_TOP_STORIES"
  | "SHOPPING"
  | "KNOWLEDGE_PANEL"
  | "DISCUSSIONS_FORUMS"
  | "AI_OVERVIEW_FEATURE";

export type CompetitorRelationship =
  | "CONFIGURED_BUSINESS_COMPETITOR"
  | "DISCOVERED_SEARCH_COMPETITOR"
  | "BOTH"
  | "UNKNOWN_RELATIONSHIP";

export type SerpOwnVisibilityState =
  | "STRONG_OWN_VISIBILITY"
  | "PARTIAL_OWN_VISIBILITY"
  | "WEAK_OWN_VISIBILITY"
  | "NO_OBSERVED_OWN_VISIBILITY"
  | "INSUFFICIENT_SERP_DATA";

export type PositionChangeState =
  | "IMPROVED"
  | "DECLINED"
  | "STABLE"
  | "ENTERED_OBSERVED_RANGE"
  | "NO_LONGER_OBSERVED_IN_TRACKED_RANGE"
  | "INSUFFICIENT_DATA";

export type TopicObservationState =
  | "COMMONLY_OBSERVED_TOPIC" // >= 60% ratio AND >= 3 competitor sources
  | "OBSERVED_LIMITED_SAMPLE" // >= 60% ratio but < 3 competitor sources
  | "OBSERVED_SINGLE_SOURCE" // 1 source only (e.g. 1/1)
  | "SOMETIMES_OBSERVED_TOPIC" // 20% - 59% ratio
  | "OWN_SITE_ONLY_TOPIC" // Unique differentiator
  | "COMPETITOR_ONLY_OBSERVED_TOPIC" // Observed on single competitor page in larger sample
  | "INSUFFICIENT_COMPETITOR_SAMPLE";

export type DominantSerpIntentState =
  | "INFORMATIONAL_DOMINANT"
  | "COMMERCIAL_DOMINANT"
  | "LOCAL_DOMINANT"
  | "MIXED"
  | "INSUFFICIENT_DATA";

export type QuerySelectionReason =
  | "HIGH_PRIORITY_ACTION"
  | "NEW_PAGE_CANDIDATE"
  | "DECLINING_CLUSTER"
  | "WATCHLISTED_QUERY"
  | "MANUAL_SELECTION"
  | "GENERAL_CLUSTER_MONITORING";

export interface SerpRequest {
  query: string;
  clusterId?: string;
  country?: string; // Default: 'us'
  language?: string; // Default: 'en'
  device?: SerpDevice; // Default: 'DESKTOP'
  location?: string;
  locationGranularity?: "COUNTRY" | "REGION" | "CITY" | "POSTAL_CODE";
  depth?: number; // Default: 20
  selectionReason?: QuerySelectionReason;
}

export interface OrganicSerpResult {
  position: number;
  url: string;
  normalizedUrl: string;
  domain: string;
  rootDomain: string;
  title: string;
  snippet: string;
  resultType: ResultType;
  resultTypeConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  breadcrumb?: string;
  sitelinks?: string[];
  richResultMarkers?: string[];
  isOwnDomain: boolean;
}

export interface SerpFeatureItem {
  featureType: SerpFeatureType;
  owningDomain?: string;
  owningUrl?: string;
  title?: string;
  questions?: string[]; // Provider-supplied PAA questions ONLY
  providerEvidence?: string;
}

export interface SerpSnapshot {
  snapshotId: string;
  projectId: string;
  provider: SerpProviderType;
  providerVersion: string;
  query: string;
  clusterId?: string;
  normalizedQuery: string;
  country: string;
  language: string;
  device: SerpDevice;
  location?: string;
  locationGranularity: "COUNTRY" | "REGION" | "CITY" | "POSTAL_CODE";
  depth: number;
  timestamp: string;
  organicResults: OrganicSerpResult[];
  serpFeatures: SerpFeatureItem[];
  ownSiteResults: OrganicSerpResult[];
  providerCompleteness: "COMPLETE" | "PARTIAL" | "TRUNCATED";
  rawProviderReference?: string;
  selectionReason?: QuerySelectionReason;
}

export interface SearchCompetitorSummary {
  domain: string;
  rootDomain: string;
  relationship: CompetitorRelationship;
  trackedClustersAppearedIn: number;
  totalTrackedClusters: number;
  clusterShareRatio: number; // e.g. 0.5 = 50%
  top10Appearances: number;
  averageObservedPosition: number;
  primaryResultTypes: ResultType[];
  observedIntentOverlap: QueryIntent[];
  primaryTopicOverlap: string[];
  evidenceCount: number;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  interpretationNote: string;
}

export interface SerpIntentDistribution {
  dominantIntentState: DominantSerpIntentState;
  dominantIntent: QueryIntent;
  intentBreakdown: Record<string, number>;
  sampleSize: number;
  dominanceRatio: number;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  intentDisagreementWithPhase12?: {
    phase12PredictedIntent: QueryIntent;
    observedSerpDominantIntent: QueryIntent;
    finding: "INTENT_ALIGNMENT_REVIEW";
    rationale: string;
  };
}

export interface ResultTypeDistribution {
  typeCounts: Record<ResultType, number>;
  dominantType: ResultType;
  sampleSize: number;
  formatMismatchCandidate?: {
    ownPageType: ResultType;
    dominantSerpType: ResultType;
    finding: "OWN_PAGE_FORMAT_MISMATCH_CANDIDATE";
    rationale: string;
  };
}

export interface CompetitorPageObservation {
  url: string;
  domain: string;
  fetchStatus: "SUCCESS" | "FAILED" | "BLOCKED_ROBOTS" | "ACCESS_DENIED" | "UNAVAILABLE";
  crawlTimestamp?: string;
  title?: string;
  h1?: string;
  headingsSample?: string[];
  approximateWordCount?: number;
  schemaTypes?: string[];
  hasFaqStructure?: boolean;
  hasComparisonTable?: boolean;
  hasOrderedLists?: boolean;
  hasAuthorSignals?: boolean;
  observedEntitiesAndTopics: string[];
}

export interface TopicComparisonItem {
  topic: string;
  observationState: TopicObservationState;
  analyzedCompetitorCount: number; // Denominator
  occurrenceCount: number; // Numerator
  competitorPrevalenceRatio: number; // e.g. 0.7
  competitorPrevalenceFraction: string; // e.g. "7 of 10"
  observedOnOwnPage: boolean;
  provenance: {
    sourceSerpSnapshotIds: string[];
    competitorUrls: string[];
    phase12ClusterId?: string;
  };
  interpretation: string;
}

export interface SerpFeatureOpportunity {
  featureType: SerpFeatureType;
  queryClusterId?: string;
  representativeLabel: string;
  owningDomain?: string;
  ownPosition?: number;
  opportunityName:
    | "PAA_CONTENT_OPPORTUNITY"
    | "ANSWER_FORMAT_OPPORTUNITY"
    | "IMAGE_SERP_OPPORTUNITY"
    | "VIDEO_CONTENT_OPPORTUNITY"
    | "LOCAL_SEARCH_REVIEW";
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  advisoryNote: string;
  provenance: {
    sourceSnapshotId: string;
    sourceFeatureType: SerpFeatureType;
    providerSuppliedQuestions?: string[];
  };
}

export interface SerpPositionHistoryItem {
  query: string;
  clusterId?: string;
  url: string;
  previousPosition?: number;
  currentPosition?: number;
  state: PositionChangeState;
  rationale: string;
}

export interface CompetitorSerpIntelligenceReport {
  generatedAt: string;
  projectId: string;
  provider: SerpProviderType;
  providerStatus: SerpProviderStatus;
  providerImplementationState: ProviderImplementationState;
  providerVersion: string;
  country: string;
  language: string;
  device: SerpDevice;
  totalTrackedClusters: number;
  totalSnapshots: number;
  appliedCompetitorPolicy: {
    policyName: string;
    minClusterAppearances: number;
    minClusterShareRatio: number;
    minTop10Appearances: number;
  };
  searchCompetitors: SearchCompetitorSummary[];
  serpIntentAssessments: Array<{
    clusterId: string;
    representativeLabel: string;
    intentDistribution: SerpIntentDistribution;
    resultTypeDistribution: ResultTypeDistribution;
    ownVisibilityState: SerpOwnVisibilityState;
  }>;
  topicComparisons: Array<{
    clusterId: string;
    representativeLabel: string;
    topics: TopicComparisonItem[];
    ownDifferentiationSignals: string[];
    serpCoverageGaps: string[];
  }>;
  serpFeatureOpportunities: SerpFeatureOpportunity[];
  positionHistory: SerpPositionHistoryItem[];
  serpVolatilityAssessment: {
    volatilityState: "SERP_VOLATILITY_LOW" | "SERP_VOLATILITY_MODERATE" | "SERP_VOLATILITY_HIGH" | "INSUFFICIENT_DATA";
    volatilityScore: number;
    observationCount: number;
    rationale: string;
  };
  governanceLimitations: string[];
}
