/**
 * Phase 28E: AI Visibility Analytics, Competitive Share of Voice & Trend Intelligence Types.
 * Strictly isolated from traditional SEO diagnostic models and SEO health scores.
 */

import { IntentTaxonomy, FunnelStage, PromptSpecificity, PromptBrandedness, PromptType } from "../prompts/types";
import { AIProviderId, MentionContextType, CitationDomainType } from "../observation/types";

export const AI_VISIBILITY_METRIC_VERSION = "v28e-1.0";

export type ComparabilityStatus = "COMPARABLE" | "PARTIALLY_COMPARABLE" | "NOT_COMPARABLE";

export type ConfidenceLevel = "LOW_SAMPLE" | "DIRECTIONAL" | "MODERATE_EVIDENCE" | "STRONGER_EVIDENCE";

export type LiveProviderCertificationStatus = "PENDING" | "CERTIFIED" | "FAILED";

export interface AnalyticsCoverage {
  totalPlannedObservations: number;
  completedObservations: number;
  eligibleSuccessObservations: number;
  failedObservations: number;
  unsupportedObservations: number;
  rateLimitedObservations: number;
  unconfiguredObservations: number;
  coverageRatio: number; // eligibleSuccess / totalPlanned
}

export interface MetricDenominator {
  numerator: number;
  denominator: number;
  rate: number; // 0.0 - 1.0
  excludedCount: number;
  exclusionReasons: Record<string, number>;
}

export interface MentionRateMetric {
  overall: MetricDenominator;
  unbrandedDiscovery: MetricDenominator;
  semiBranded: MetricDenominator;
  branded: MetricDenominator;
}

export interface RecommendationAppearanceMetric {
  recommendedCount: number;
  neutralCount: number;
  comparisonCount: number;
  negativeCount: number;
  unknownCount: number;
  recommendationRate: MetricDenominator; // RECOMMENDED / eligible recommendation responses
}

export interface RecommendationOrderMetric {
  averageOrder: number | null;
  medianOrder: number | null;
  bestOrder: number | null;
  worstOrder: number | null;
  sampleCount: number;
}

export interface CitationRateMetric {
  ownDomainCitationRate: MetricDenominator; // capability-aware denominator
  mentionedNotCitedCount: number;
  citedNotMentionedCount: number;
  bothMentionedAndCitedCount: number;
  neitherCount: number;
}

export interface CompetitorVisibilityMetric {
  competitorName: string;
  canonicalEntityId: string;
  isConfirmed: boolean;
  appearancesCount: number;
  responsePenetration: MetricDenominator; // appearances / total responses (can exceed 100% across all brands)
  mentionShareOfVoice: MetricDenominator; // appearances / total entity appearances
  recommendationAppearances: number;
  recommendationShareOfVoice: MetricDenominator;
  averageRecommendationOrder: number | null;
  topCitedDomains: string[];
  activeProviders: AIProviderId[];
  activeClusters: string[];
}

export interface ProviderVisibilityMetric {
  providerId: AIProviderId;
  providerName: string;
  isConfigured: boolean;
  totalRuns: number;
  successfulRuns: number;
  brandMentionRate: MetricDenominator;
  unbrandedDiscoveryRate: MetricDenominator;
  recommendationRate: MetricDenominator;
  ownDomainCitationRate: MetricDenominator;
  competitorsObservedCount: number;
}

export interface ClusterVisibilityMetric {
  clusterId: string;
  clusterName: string;
  pillar: string;
  intent: IntentTaxonomy;
  promptsMonitoredCount: number;
  observationsCount: number;
  brandMentionRate: MetricDenominator;
  unbrandedDiscoveryRate: MetricDenominator;
  recommendationRate: MetricDenominator;
  ownDomainCitationRate: MetricDenominator;
  clusterLeaderName: string;
  clusterLeaderPenetration: number;
  brandResponsePenetration: number;
  visibilityGap: number; // Leader % - Brand % (in percentage points)
}

export interface OfferingVisibilityMetric {
  offeringId: string;
  offeringName: string;
  importance: "PRIMARY" | "SECONDARY" | "SUPPORTING" | "INCIDENTAL";
  observationsCount: number;
  brandMentionRate: MetricDenominator;
  unbrandedDiscoveryRate: MetricDenominator;
  recommendationRate: MetricDenominator;
  ownDomainCitationRate: MetricDenominator;
  offeringLeaderName: string;
  offeringLeaderPenetration: number;
  brandResponsePenetration: number;
  visibilityGap: number; // percentage points
}

export interface IntentVisibilityMetric {
  intent: IntentTaxonomy;
  observationsCount: number;
  brandMentionRate: MetricDenominator;
  recommendationRate: MetricDenominator;
}

export interface FunnelVisibilityMetric {
  funnelStage: FunnelStage;
  observationsCount: number;
  brandMentionRate: MetricDenominator;
  recommendationRate: MetricDenominator;
}

export interface CitationDomainMetric {
  domain: string;
  domainType: CitationDomainType;
  citationCount: number;
  providerCount: number;
  promptCount: number;
  clusterCount: number;
  isOwnDomain: boolean;
  isCompetitorDomain: boolean;
  brandAssociatedCount: number;
}

export interface OwnDomainPageCitationMetric {
  url: string;
  path: string;
  citationCount: number;
  providers: AIProviderId[];
  topPrompts: string[];
  topClusters: string[];
}

export interface RunComparisonReport {
  baselineRunId: string;
  currentRunId: string;
  comparabilityStatus: ComparabilityStatus;
  comparabilityNotes: string[];
  baselineStartedAt: string;
  currentStartedAt: string;
  matchingPromptsCount: number;
  unbrandedDiscoveryDeltaPp: number; // percentage points (e.g. +6.0)
  recommendationRateDeltaPp: number;
  ownDomainCitationRateDeltaPp: number;
  overallMentionRateDeltaPp: number;
}

export interface VisibilityTrendSummary {
  projectId: string;
  runCount: number;
  historicalRuns: Array<{
    runId: string;
    startedAt: string;
    unbrandedDiscoveryRate: number;
    recommendationRate: number;
    ownDomainCitationRate: number;
    overallMentionRate: number;
    comparabilityStatus: ComparabilityStatus;
  }>;
  latestComparison?: RunComparisonReport | null;
}

export interface AIVisibilityAnalyticsSnapshot {
  snapshotId: string;
  projectId: string;
  runId: string;
  generatedAt: string;
  metricVersion: string;
  certificationStatus: LiveProviderCertificationStatus;
  isTestData: boolean;
  coverage: AnalyticsCoverage;
  confidence: {
    level: ConfidenceLevel;
    sampleSize: number;
    consistencyScore: number; // 0.0 - 1.0
    rationale: string;
  };
  metrics: {
    mentionRates: MentionRateMetric;
    recommendations: RecommendationAppearanceMetric;
    recommendationOrders: RecommendationOrderMetric;
    citations: CitationRateMetric;
    volatility: {
      mentionConsistency: number; // 0.0 - 1.0
      observationConsistency: number;
    };
  };
  competitors: {
    leaderboard: CompetitorVisibilityMetric[];
    providerMatrix: Array<{
      entityName: string;
      isBrand: boolean;
      ratesByProvider: Record<string, number>;
    }>;
    totalTrackedEntitiesCount: number;
  };
  clusters: ClusterVisibilityMetric[];
  offerings: OfferingVisibilityMetric[];
  intents: IntentVisibilityMetric[];
  funnel: FunnelVisibilityMetric[];
  providers: ProviderVisibilityMetric[];
  citations: {
    domains: CitationDomainMetric[];
    ownDomainPages: OwnDomainPageCitationMetric[];
    sourceDiversity: {
      uniqueDomainsCount: number;
      uniqueUrlsCount: number;
      ownDomainShare: number;
      thirdPartyShare: number;
    };
  };
}
