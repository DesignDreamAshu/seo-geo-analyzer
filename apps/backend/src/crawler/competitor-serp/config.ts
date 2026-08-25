/**
 * Phase 13: Competitor & SERP Intelligence Configuration & Discovery Policies.
 * Replaces hardcoded assumptions with configurable, evidence-depth policies.
 */

export interface CompetitorDiscoveryPolicy {
  policyName: string;
  minClusterAppearances: number;
  minClusterShareRatio: number; // e.g. 0.20 = must appear in at least 20% of tracked clusters
  minTop10Appearances: number;
  highConfidenceMinAppearances: number;
}

export interface SerpIntelligenceConfig {
  configName: string;
  maxTrackedQueryClusters: number;
  discoveryPolicy: CompetitorDiscoveryPolicy;
  intentDominanceThreshold: number; // default 0.6 (60%)
  minAnalyzedResultsForIntent: number; // default 5
  topicCommonPrevalenceThreshold: number; // default 0.60 (60%+)
  topicSometimesPrevalenceThreshold: number; // default 0.20 (20%+)
  minCompetitorSourcesForCommonTopic: number; // default 3 sources required for COMMONLY_OBSERVED_TOPIC
  cacheTtlHours: number; // default 72 hours
  defaultCountry: string;
  defaultLanguage: string;
  defaultDevice: "DESKTOP" | "MOBILE";
  allowedProviders: string[];
}

export const BALANCED_DISCOVERY_POLICY: CompetitorDiscoveryPolicy = {
  policyName: "BALANCED_DISCOVERY_POLICY",
  minClusterAppearances: 2,
  minClusterShareRatio: 0.1, // >= 10% of tracked clusters
  minTop10Appearances: 2,
  highConfidenceMinAppearances: 3,
};

export const SMALL_SAMPLE_DISCOVERY_POLICY: CompetitorDiscoveryPolicy = {
  policyName: "SMALL_SAMPLE_DISCOVERY_POLICY",
  minClusterAppearances: 1,
  minClusterShareRatio: 0.5, // >= 50% for tiny samples (1-2 clusters)
  minTop10Appearances: 1,
  highConfidenceMinAppearances: 2,
};

export const STRICT_ENTERPRISE_DISCOVERY_POLICY: CompetitorDiscoveryPolicy = {
  policyName: "STRICT_ENTERPRISE_DISCOVERY_POLICY",
  minClusterAppearances: 3,
  minClusterShareRatio: 0.15, // >= 15% of tracked clusters
  minTop10Appearances: 4,
  highConfidenceMinAppearances: 5,
};

export const DEFAULT_SERP_CONFIG: SerpIntelligenceConfig = {
  configName: "DEFAULT_SERP_CONFIG",
  maxTrackedQueryClusters: 50,
  discoveryPolicy: BALANCED_DISCOVERY_POLICY,
  intentDominanceThreshold: 0.6,
  minAnalyzedResultsForIntent: 5,
  topicCommonPrevalenceThreshold: 0.6,
  topicSometimesPrevalenceThreshold: 0.2,
  minCompetitorSourcesForCommonTopic: 3,
  cacheTtlHours: 72,
  defaultCountry: "us",
  defaultLanguage: "en",
  defaultDevice: "DESKTOP",
  allowedProviders: ["MOCK_PROVIDER", "DATAFORSEO", "SERPAPI", "GOOGLE_CUSTOM_SEARCH", "MANUAL_DATASET"],
};
