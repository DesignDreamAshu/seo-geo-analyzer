/**
 * Phase 19: Indexation Intelligence & Google Index Coverage Types & Data Contracts.
 * Establishes the foundational distinction:
 * TECHNICALLY_INDEXABLE ≠ CRAWLED ≠ GOOGLE_REPORTED_INDEX_STATE ≠ INDEXED ≠ SEARCH_VISIBLE ≠ RANKING ≠ TRAFFIC
 */

import { RecommendationNature, ActionPriority, ImplementationEffort, ActionOwner, TimelineBucket } from "../opportunity/types";

export type TechnicalIndexabilityState = "INDEXABLE" | "NON_INDEXABLE" | "UNKNOWN";

export type GoogleIndexState =
  | "INDEXED"
  | "NOT_INDEXED"
  | "PROCESSING_OR_UNCERTAIN"
  | "UNKNOWN";

export type GoogleIndexDetailedReason =
  | "CRAWLED_CURRENTLY_NOT_INDEXED"
  | "DISCOVERED_CURRENTLY_NOT_INDEXED"
  | "DUPLICATE_GOOGLE_CHOSE_DIFFERENT_CANONICAL"
  | "ALTERNATE_PAGE_WITH_CANONICAL"
  | "EXCLUDED_BY_NOINDEX"
  | "BLOCKED_BY_ROBOTS"
  | "REDIRECT"
  | "NOT_FOUND_404"
  | "SOFT_404"
  | "SERVER_ERROR"
  | "DUPLICATE_WITHOUT_SELECTED_CANONICAL"
  | "UNKNOWN_TO_GOOGLE"
  | "INDEXED"
  | "OTHER_PROVIDER_STATE"
  | "UNKNOWN";

export type ProviderCapabilityState =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "PARTIAL"
  | "STALE"
  | "NOT_SUPPORTED";

export type ProviderErrorCode =
  | "AUTH_ERROR"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "PROPERTY_MISMATCH"
  | "URL_NOT_IN_PROPERTY"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE";

export type CanonicalAlignmentState =
  | "CANONICAL_MATCH"
  | "GOOGLE_SELECTED_DIFFERENT_CANONICAL"
  | "DECLARED_CANONICAL_MISSING"
  | "GOOGLE_CANONICAL_UNKNOWN";

export type EvidenceFreshnessState = "FRESH" | "AGING" | "STALE" | "UNKNOWN";

export type IndexationConfidence = "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";

export type IndexationRootCauseConfidence =
  | "DETERMINISTIC_TECHNICAL_CAUSE"
  | "STRONG_CORRELATION"
  | "POSSIBLE_CONTRIBUTOR"
  | "CAUSE_UNKNOWN";

export type InspectionSamplingMode =
  | "FULL_COVERAGE"
  | "TARGETED_INSPECTION"
  | "REPRESENTATIVE_SAMPLE";

export interface KnownUrlUniverseSummary {
  totalKnownUrls: number;
  sources: {
    crawlerCount: number;
    sitemapCount: number;
    gscLandingPagesCount: number;
    serverLogsCount: number;
    backlinksCount: number;
    migrationCount: number;
    manualWatchlistCount: number;
  };
}

export interface RawGoogleInspectionPayload {
  inspectionUrl: string;
  inspectionTimestamp: string;
  verdict?: "PASS" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED";
  coverageState?: string; // e.g. "Crawled - currently not indexed"
  indexingState?: "INDEXING_ALLOWED" | "BLOCKED_BY_META_TAG" | "BLOCKED_BY_HTTP_HEADER" | "BLOCKED_BY_ROBOTS_TXT" | "INDEXING_STATE_UNSPECIFIED";
  robotsTxtState?: "ALLOWED" | "DISALLOWED" | "ROBOTS_TXT_STATE_UNSPECIFIED";
  lastCrawlTime?: string;
  pageFetchState?: "SUCCESSFUL" | "SOFT_404" | "NOT_FOUND" | "SERVER_ERROR" | "ACCESS_DENIED" | "PAGE_FETCH_STATE_UNSPECIFIED";
  googleCanonical?: string;
  userCanonical?: string;
  referringUrls?: string[];
  sitemaps?: string[];
  crawledAs?: "DESKTOP" | "MOBILE" | "CRAWLING_USER_AGENT_UNSPECIFIED";
}

export interface IndexationEvidenceRecord {
  projectId: string;
  url: string;
  normalizedUrl: string;
  pageType?: string;
  isImportant: boolean;
  importanceReasons: string[];
  evaluatedAt: string;

  // 1. Technical Baseline
  technicalIndexability: TechnicalIndexabilityState;
  technicalDirectives?: {
    noindex: boolean;
    robotsDisallowed: boolean;
    declaredCanonical?: string;
    statusCode: number;
    isSitemapPresent: boolean;
    internalLinkDepth?: number;
  };

  // 2. Google Reported Evidence
  rawGoogleState?: string;
  googleIndexState: GoogleIndexState;
  googleDetailedReason: GoogleIndexDetailedReason;
  googleCoverageExplanation?: string;
  lastGoogleCrawlAt?: string;
  crawledAs?: "DESKTOP" | "MOBILE" | "CRAWLING_USER_AGENT_UNSPECIFIED";

  // 3. Canonical Selection
  declaredCanonical?: string;
  googleCanonical?: string;
  canonicalAlignment: CanonicalAlignmentState;

  // 4. Corroborating Signals
  serverLogCrawlCount?: number;
  lastServerLogCrawlAt?: string;
  gscImpressions28d?: number;
  gscClicks28d?: number;
  backlinksCount?: number;

  // 5. Diagnostics & Root Cause
  rootCauseCategory: IndexationRootCauseConfidence;
  rootCauseDetails: string[];
  recommendedActionType?:
    | "FIX_DETERMINISTIC_TECHNICAL_DEFECT"
    | "INVESTIGATE_CONTENT_UNIQUENESS_AND_STRUCTURE"
    | "REVIEW_CANONICAL_CONSOLIDATION"
    | "MONITOR_NORMAL_GOOGLE_PROCESSING"
    | "NO_ACTION_REQUIRED";

  // 6. Provenance & Metadata
  evidenceSource: "GSC_URL_INSPECTION_API" | "GSC_INDEX_COVERAGE_EXPORT" | "AUXILIARY_EVIDENCE" | "UNKNOWN";
  evidenceFreshness: EvidenceFreshnessState;
  confidence: IndexationConfidence;
  mapperVersion: string;
}

export interface IndexCoverageMatrixDistribution {
  totalKnownUrls: number;
  technicallyIndexableUrlsCount: number;
  technicallyNonIndexableUrlsCount: number;

  urlsWithGoogleEvidenceCount: number;
  indexedCount: number;
  notIndexedCount: number;
  processingOrUncertainCount: number;
  unknownIndexStateCount: number;

  // Explicit Denominators
  indexedAmongEligibleWithEvidenceRatio: {
    numerator: number;
    denominator: number;
    percentage: number;
  };
  importantIndexableIndexedRatio: {
    numerator: number;
    denominator: number;
    percentage: number;
  };
}

export interface IndexationSnapshot {
  snapshotId: string;
  projectId: string;
  capturedAt: string;
  knownUrlUniverseSummary: KnownUrlUniverseSummary;
  providerCapability: ProviderCapabilityState;
  inspectionSamplingMode: InspectionSamplingMode;
  inspectionEligibleCount: number;
  inspectedCount: number;
  inspectionCoveragePercentage: number;
  evidenceFreshnessBreakdown: {
    freshPercent: number;
    agingPercent: number;
    stalePercent: number;
  };
  matrixDistribution: IndexCoverageMatrixDistribution;
  mapperVersion: string;
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface GoogleIndexationIntelligenceReport {
  generatedAt: string;
  projectId: string;
  evidenceQuality: {
    providerCapability: ProviderCapabilityState;
    inspectionSamplingMode: InspectionSamplingMode;
    eligibleUrlsCount: number;
    inspectedUrlsCount: number;
    coveragePercentage: number;
    freshnessBreakdown: {
      freshPercent: number;
      agingPercent: number;
      stalePercent: number;
    };
    serverLogDatasetQuality?: string;
    gscDataQuality?: string;
    interpretationConfidence: "HIGH" | "MODERATE" | "LOW" | "INCONCLUSIVE";
  };
  knownUrlUniverse: KnownUrlUniverseSummary;
  matrixDistribution: IndexCoverageMatrixDistribution;
  importantPageCoverage: {
    totalImportantPages: number;
    indexedImportantPagesCount: number;
    notIndexedImportantPagesCount: number;
    unknownImportantPagesCount: number;
    coveragePercentage: number;
    unindexedImportantPages: Array<{
      url: string;
      pageType?: string;
      importanceReasons: string[];
      googleDetailedReason: GoogleIndexDetailedReason;
      lastCrawlAt?: string;
      logCrawlCount?: number;
      rootCauseCategory: IndexationRootCauseConfidence;
      contextRationale: string;
    }>;
  };
  notIndexedReasonBreakdown: Record<GoogleIndexDetailedReason, number>;
  canonicalSelectionIntelligence: {
    canonicalMatchCount: number;
    googleSelectedDifferentCanonicalCount: number;
    declaredCanonicalMissingCount: number;
    mismatchExamples: Array<{
      declaredUrl: string;
      declaredCanonical?: string;
      googleCanonical: string;
      isContentEquivalenceLikely: boolean;
      guidance: string;
    }>;
  };
  sitemapIndexCoverage: {
    sitemapUrlsTotal: number;
    sitemapIndexedCount: number;
    sitemapNotIndexedCount: number;
    sitemapNonIndexableCount: number;
    sitemapCoveragePercentage: number;
    breakdownBySitemap: Record<string, { total: number; indexed: number; ratioPercent: number }>;
  };
  unexpectedIndexExpansion: {
    trackingParametersIndexedCount: number;
    internalSearchIndexedCount: number;
    sessionUrlsIndexedCount: number;
    detectedPatterns: Array<{
      pattern: string;
      indexedVariantsCount: number;
      recommendation: string;
    }>;
  };
  serverLogCorrelations: {
    crawledRepeatedlyButNotIndexedCount: number;
    notObservedInLogsButIndexedCount: number;
    summary: string;
  };
  gscCorrelations: {
    indexedWithZeroImpressionsCount: number;
    impressionsWithUnknownInspectionStateCount: number;
    summary: string;
  };
  migrationIndexTransition?: {
    migrationId: string;
    oldUrlsStillIndexedCount: number;
    newDestinationsIndexedCount: number;
    transitionState: "NEW_TARGET_INDEXED" | "OLD_URL_STILL_INDEX_EVIDENCE" | "TRANSITION_IN_PROGRESS" | "NEW_TARGET_NOT_INDEXED_REVIEW" | "INSUFFICIENT_EVIDENCE";
  };
  internationalLocaleCoverage?: Record<string, { total: number; indexed: number; ratioPercent: number }>;
  localBranchCoverage?: { totalLocations: number; indexedLocationsCount: number };
  systemicPatterns: Array<{
    scope: string;
    description: string;
    affectedCount: number;
    guidance: string;
  }>;
  governanceLimitations: string[];
  immutabilityStatement: string;
}
