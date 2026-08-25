/**
 * Phase 18: Server Log Intelligence Hardened Data Contracts & Type Definitions.
 */

import { RecommendationNature, ActionPriority, ImplementationEffort, ActionOwner, TimelineBucket } from "../opportunity/types";

export type BotFamily =
  | "GOOGLEBOT"
  | "BINGBOT"
  | "APPLEBOT"
  | "YANDEXBOT"
  | "BAIDUSPIDER"
  | "DUCKDUCKBOT"
  | "GPTBOT"
  | "OAI_SEARCHBOT"
  | "CHATGPT_USER"
  | "CLAUDEBOT"
  | "PERPLEXITYBOT"
  | "UNKNOWN_BOT"
  | "HUMAN_OR_NON_BOT";

export type BotDeviceType = "SMARTPHONE" | "DESKTOP" | "IMAGE" | "VIDEO" | "GENERIC";

export type VerificationState =
  | "VERIFIED_PROVIDER_RANGE"
  | "VERIFIED_FORWARD_REVERSE_DNS"
  | "USER_AGENT_ONLY"
  | "PROVIDER_RANGE_STALE"
  | "VERIFICATION_UNAVAILABLE"
  | "SPOOFED_OR_INVALID"
  | "UNKNOWN";

export type BotRangeFreshness = "FRESH" | "STALE" | "UNAVAILABLE" | "MANUALLY_CONFIGURED";

export interface BotRangeMetadata {
  provider: string;
  sourceUrl: string;
  retrievedAt: string;
  datasetVersionOrHash: string;
  freshness: BotRangeFreshness;
  verifierVersion: string;
  rangesCount: number;
}

export interface BotIdentity {
  name: string;
  family: BotFamily;
  deviceType: BotDeviceType;
  verificationState: VerificationState;
  isVerifiedSearchBot: boolean;
  isAiCrawler: boolean;
  aiPurpose?: "SEARCH_INDEXING" | "AI_TRAINING" | "USER_TRIGGERED_FETCH" | "NOT_AI";
  verificationEvidence: string[];
  rangeMetadata?: BotRangeMetadata;
}

export type ResourceType =
  | "HTML_DOCUMENT"
  | "IMAGE"
  | "VIDEO"
  | "PDF"
  | "CSS"
  | "JAVASCRIPT"
  | "API"
  | "FONT"
  | "XML"
  | "OTHER";

export type QueryParameterCategory =
  | "TRACKING"
  | "SORTING"
  | "FILTERING"
  | "PAGINATION"
  | "SEARCH"
  | "SESSION"
  | "FACETING"
  | "FUNCTIONAL"
  | "UNKNOWN";

export interface SeoServerLogEvent {
  eventId: string;
  sourceRowId?: string;
  timestamp: string;
  projectId: string;
  host: string;
  method: string;
  rawPath: string;
  rawQuery?: string;
  rawUrl: string;
  normalizedUrl: string;
  statusCode: number;
  userAgent: string;
  ipAddress?: string;
  responseBytes?: number;
  responseTimeMs?: number;
  referrer?: string;
  protocol?: string;
  cacheStatus?: string;
  sourceProvider: string;
  resourceType: ResourceType;
  botIdentity: BotIdentity;
}

export type LogDatasetCompleteness = "COMPLETE" | "PARTIAL" | "UNKNOWN" | "INVALID";

export type CrawlBudgetMateriality = "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_EVIDENCE";

export type CrawlFrequencyClass =
  | "VERY_FREQUENTLY_OBSERVED"
  | "FREQUENTLY_OBSERVED"
  | "PERIODICALLY_OBSERVED"
  | "RARELY_OBSERVED"
  | "NOT_OBSERVED_IN_PERIOD"
  | "INSUFFICIENT_DATA";

export type CrawlCoverageState =
  | "CRAWLABLE_AND_OBSERVED"
  | "CRAWLABLE_NOT_OBSERVED"
  | "NON_INDEXABLE_BUT_OBSERVED"
  | "REDIRECT_OBSERVED"
  | "ERROR_OBSERVED"
  | "OBSERVATION_INCONCLUSIVE"
  | "UNKNOWN";

export type AdapterSupportState =
  | "IMPLEMENTED_AND_TESTED"
  | "GENERIC_IMPORT_SUPPORTED"
  | "ARCHITECTURE_READY"
  | "NOT_IMPLEMENTED";

export interface UrlCrawlMetrics {
  url: string;
  normalizedUrl: string;
  pageType?: string;
  isImportant: boolean;
  importanceReasons: string[];
  totalBotRequests: number;
  verifiedBotRequests: number;
  verifiedGooglebotRequests: number;
  verifiedGooglebotHtmlRequests: number;
  verifiedGooglebotImageRequests: number;
  firstObserved?: string;
  lastObserved?: string;
  activeDaysCount: number;
  statusDistribution: Record<number, number>;
  botFamilyDistribution: Partial<Record<BotFamily, number>>;
  resourceType: ResourceType;
  medianResponseTimeMs?: number;
  p75ResponseTimeMs?: number;
  p95ResponseTimeMs?: number;
  totalBytesTransferred: number;
  frequencyClass: CrawlFrequencyClass;
  coverageState: CrawlCoverageState;
}

export interface CrawlBehaviorSnapshot {
  snapshotId: string;
  projectId: string;
  datasetStart: string;
  datasetEnd: string;
  ingestionTimestamp: string;
  completeness: LogDatasetCompleteness;
  totalLogLinesParsed: number;
  totalRejectedEvents: number;
  rejectionRatePercent: number;
  rejectionReasons: Record<string, number>;
  totalBotRequests: number;
  verifiedGooglebotHtmlRequests: number;
  uniqueUrlsRequestedCount: number;
  crawlBudgetMateriality: CrawlBudgetMateriality;
  verifierVersion: string;
  rangeDatasetVersion: string;
  rangeDatasetFreshness: BotRangeFreshness;
  policyVersion: string;
  immutabilityGuarantee: "RUNTIME_IMMUTABLE";
}

export interface ServerLogIntelligenceReport {
  generatedAt: string;
  projectId: string;
  datasetQuality: {
    periodStart: string;
    periodEnd: string;
    sourceProvider: string;
    adapterSupportState: AdapterSupportState;
    completeness: LogDatasetCompleteness;
    totalEventsParsed: number;
    rejectedEventsCount: number;
    rejectionRatePercent: number;
    rejectionReasons: Record<string, number>;
    botVerificationBreakdown: {
      verifiedProviderRangePercent: number;
      verifiedDnsPercent: number;
      userAgentOnlyPercent: number;
      staleRangePercent: number;
      spoofedPercent: number;
    };
    rangeDatasetMetadata: BotRangeMetadata;
    interpretationConfidence: "HIGH" | "MODERATE" | "LOW" | "INCONCLUSIVE";
  };
  botOverview: {
    totalBotRequests: number;
    verifiedGooglebotRequests: number;
    googlebotSmartphoneRequests: number;
    googlebotDesktopRequests: number;
    googlebotImageRequests: number;
    bingbotRequests: number;
    aiCrawlerRequests: {
      gptBotTrainingRequests: number;
      oaiSearchBotSearchRequests: number;
      chatGptUserFetchRequests: number;
      claudeBotRequests: number;
      perplexityBotRequests: number;
    };
    otherBotRequests: number;
    spoofedRequestsBlockedOrFlagged: number;
  };
  importantPageCoverage: {
    totalImportantPages: number;
    observedImportantPagesCount: number;
    unobservedImportantPagesCount: number;
    coveragePercentage: number;
    unobservedImportantPages: Array<{
      url: string;
      pageType?: string;
      importanceReasons: string[];
      possibleReasons: string[];
    }>;
  };
  crawlEfficiency: {
    materiality: CrawlBudgetMateriality;
    materialityPolicySelected: string;
    materialityRationale: string;
    htmlStatusDistribution: {
      status200IndexablePercent: number;
      status200NonIndexablePercent: number;
      redirect3xxPercent: number;
      clientError4xxPercent: number;
      serverError5xxPercent: number;
    };
    redirectConcentration: {
      totalRedirectRequests: number;
      topRedirectingUrls: Array<{ url: string; requests: number; category: "MIGRATION" | "INTERNAL_LINK" | "BACKLINK" | "UNKNOWN" }>;
    };
    errorConcentration: {
      total404Requests: number;
      total410Requests: number;
      total5xxRequests: number;
      errorBurstsDetected: Array<{
        timestampStart: string;
        timestampEnd: string;
        statusCode: number;
        requestsCount: number;
        affectedUrls: string[];
      }>;
    };
    parameterAndFacetExpansion: {
      facetPatternsDetected: Array<{
        basePath: string;
        variantCount: number;
        requestsCount: number;
        hasSearchDemand: boolean;
        recommendedReviewType: "FACET_INDEXABILITY_REVIEW" | "FACET_CANONICAL_REVIEW" | "FACET_DISCOVERY_REVIEW" | "FACET_CRAWL_EXPANSION_REVIEW" | "NO_ACTION" | "MANUAL_REVIEW";
        guidance: string;
      }>;
      potentialCrawlTraps: Array<{
        pattern: string;
        detectedVariants: number;
        sampleUrls: string[];
        rationale: string;
      }>;
    };
    originLatency: {
      sampleCount: number;
      medianMs?: number;
      p75Ms?: number;
      p95Ms?: number;
      disclaimer: string;
    };
  };
  migrationIntelligenceIntegration?: {
    migrationId: string;
    legacyUrlsStillCrawledCount: number;
    legacyUrlsHealthyRedirectPercent: number;
    newDestinationDiscoveryCount: number;
  };
  governanceLimitations: string[];
  immutabilityStatement: string;
}
