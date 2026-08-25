/**
 * Google Search Console (GSC) Intelligence Types
 * Strictly isolates observational GSC data from deterministic crawler signals.
 */

export type GscConnectionState =
  | "CONNECTED"
  | "NOT_CONNECTED"
  | "PROPERTY_SELECTED"
  | "PROPERTY_MISMATCH"
  | "INSUFFICIENT_PERMISSION"
  | "AUTH_EXPIRED"
  | "API_ERROR"
  | "NOT_EVALUATED";

export type GscAuthMode = "DEV_TOKEN_MODE" | "OAUTH_CONFIGURED" | "NOT_CONFIGURED";

export type GscPropertyType = "DOMAIN" | "URL_PREFIX";

export type GscUrlMatchMethod =
  | "EXACT"
  | "NORMALIZED"
  | "CANONICAL_MATCH"
  | "REDIRECT_MATCH"
  | "UNMATCHED"
  | "AMBIGUOUS";

export type SearchPriorityLevel =
  | "URGENT_BUSINESS_PRIORITY"
  | "VERY_HIGH_SEARCH_PRIORITY"
  | "HIGH_SEARCH_PRIORITY"
  | "MEDIUM_SEARCH_PRIORITY"
  | "LOW_SEARCH_PRIORITY"
  | "INFORMATIONAL";

export type GscOpportunityType =
  | "HIGH_IMPRESSION_LOW_CTR"
  | "NEAR_PAGE_ONE_RANKING"
  | "HIGH_POTENTIAL_STRIKING_DISTANCE"
  | "BRAND_QUERY_OPPORTUNITY";

export type GscDeclineType =
  | "SIGNIFICANT_CLICK_DROP"
  | "SIGNIFICANT_IMPRESSION_DROP"
  | "RANKING_DEGRADATION"
  | "CTR_EROSION";

export interface GscSearchAnalyticsRow {
  page?: string;
  query?: string;
  country?: string;
  device?: "DESKTOP" | "MOBILE" | "TABLET";
  date?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DateWindowMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  isComplete: boolean;
  daysCount: number;
}

export interface MetricDelta {
  current: number;
  previous: number;
  delta: number;
  percentChange?: number;
}

export interface PageGscMetrics {
  gscUrl: string;
  normalizedGscUrl: string;
  matchedCrawlUrl?: string;
  matchMethod: GscUrlMatchMethod;
  matchConfidence: number;
  currentPeriod: DateWindowMetrics;
  comparisonPeriod?: DateWindowMetrics;
  clicksDelta?: MetricDelta;
  impressionsDelta?: MetricDelta;
  ctrDelta?: MetricDelta;
  positionDelta?: MetricDelta;
  topQueries: QueryGscMetrics[];
  isDeclining: boolean;
  isTrendInconclusive?: boolean;
  trendInconclusiveReason?: string;
  hasCtrOpportunity: boolean;
  hasRankingOpportunity: boolean;
}

export interface QueryGscMetrics {
  query: string;
  currentPeriod: DateWindowMetrics;
  comparisonPeriod?: DateWindowMetrics;
  clicksDelta?: MetricDelta;
  impressionsDelta?: MetricDelta;
  positionDelta?: MetricDelta;
  associatedPages: string[];
  isBrandQuery?: boolean;
}

export interface GscDeclineFinding {
  type: GscDeclineType;
  entityType: "page" | "query";
  identifier: string; // URL or Query string
  matchedCrawlUrl?: string;
  currentClicks: number;
  previousClicks: number;
  clickDropPercent: number;
  currentImpressions: number;
  previousImpressions: number;
  impressionDropPercent: number;
  currentPosition: number;
  previousPosition: number;
  positionDrop: number;
  severity: "high" | "medium" | "low";
  likelyCauses: string[];
  explanation: string;
  isTrendInconclusive?: boolean;
}

export interface GscOpportunityFinding {
  type: GscOpportunityType;
  entityType: "page" | "query";
  identifier: string;
  matchedCrawlUrl?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  benchmarkCtrForPosition?: number;
  estimatedClickGain?: number;
  priority: "high" | "medium" | "low";
  actionableGuidance: string[];
}

export interface SearchPriorityAssessment {
  url: string;
  ruleCode: string;
  technicalSeverity: "critical" | "warning" | "opportunity" | "notice";
  searchPriority: SearchPriorityLevel;
  priorityRationale: string;
  organicImpressions: number;
  organicClicks: number;
  averagePosition?: number;
  isSystemic: boolean;
  systemicUrlCount?: number;
  systemicDeduplicatedImpressions?: number;
  systemicDeduplicatedClicks?: number;
}

export interface GscPropertyConfig {
  propertyUri: string;
  propertyType: GscPropertyType;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  comparisonPeriodStart: string;
  comparisonPeriodEnd: string;
  freshnessTimestamp: string;
}

export interface GscTelemetry {
  connectionState: GscConnectionState;
  authMode: GscAuthMode;
  selectedProperty?: string;
  evaluatedCurrentPeriod: string;
  isCurrentPeriodComplete: boolean;
  evaluatedComparisonPeriod: string;
  isComparisonPeriodComplete: boolean;
  dataFreshnessTimestamp: string;
  totalGscRowsIngested: number;
  uniqueGscPagesCount: number;
  uniqueGscQueriesCount: number;
  matchedCrawlPagesCount: number;
  unmatchedGscUrlsCount: number;
  crawledPagesWithoutGscCount: number;
  apiCallsCount: number;
  cacheHitCount: number;
  rateLimitEncountered: boolean;
  lastErrorMessage?: string;
}
