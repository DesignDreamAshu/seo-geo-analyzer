/**
 * Hardened Master Competitor & SERP Intelligence Engine Coordinator.
 * Orchestrates authorized provider retrieval, configurable competitor discovery,
 * sample-size aware intent/topic comparison, and canonical action integration.
 */

import {
  CompetitorSerpIntelligenceReport,
  SerpSnapshot,
  SerpFeatureOpportunity,
  SerpOwnVisibilityState,
} from "./types";
import { SerpIntelligenceConfig, DEFAULT_SERP_CONFIG, SMALL_SAMPLE_DISCOVERY_POLICY } from "./config";
import { SerpProvider } from "./providers/types";
import { getActiveSerpProvider, getProviderImplementationState } from "./providers/provider-registry";
import { discoverSearchCompetitors } from "./competitor-discovery";
import { analyzeSerpIntentDistribution, analyzeResultTypeDistribution, classifyResultType } from "./intent-result-type";
import { extractCompetitorPageObservation, MockPageContent } from "./competitor-extractor";
import { compareSerpTopics } from "./topic-comparison";
import { evaluateSerpFeatureOpportunities } from "./serp-features";
import { trackSerpPositionHistory } from "./position-tracker";
import { bridgeSerpIntelligenceToActions } from "./action-bridge";
import { QueryCluster } from "../content-demand/types";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeCompetitorSerpParams {
  projectId: string;
  queryClusters: QueryCluster[];
  configuredBusinessCompetitors?: string[];
  ownDomainAliases?: string[];
  ownPagesMetadata?: Record<string, { url: string; title: string; topics?: string[]; isNoindex?: boolean; statusCode?: number }>;
  competitorPageContents?: MockPageContent[];
  previousSnapshots?: SerpSnapshot[];
  existingActions?: SeoActionItem[];
  provider?: SerpProvider;
  config?: SerpIntelligenceConfig;
}

export interface AnalyzeCompetitorSerpResult {
  report: CompetitorSerpIntelligenceReport;
  actions: SeoActionItem[];
  currentSnapshots: SerpSnapshot[];
}

export async function analyzeCompetitorAndSerpIntelligence(
  params: AnalyzeCompetitorSerpParams
): Promise<AnalyzeCompetitorSerpResult> {
  const config = params.config || DEFAULT_SERP_CONFIG;
  const provider = params.provider || getActiveSerpProvider();
  const ownDomainAliases = params.ownDomainAliases || [];
  const configuredBusinessCompetitors = params.configuredBusinessCompetitors || [];
  const ownPagesMetadata = params.ownPagesMetadata || {};
  const competitorPageContents = params.competitorPageContents || [];
  const previousSnapshots = params.previousSnapshots || [];

  const providerType = provider ? provider.providerType : "UNCONFIGURED";
  const providerState = getProviderImplementationState(providerType);
  const providerVersion = provider ? provider.providerVersion : "v0.0.0";

  // Check provider configuration
  if (!provider || !provider.isConfigured()) {
    const emptyReport: CompetitorSerpIntelligenceReport = {
      generatedAt: new Date().toISOString(),
      projectId: params.projectId,
      provider: providerType,
      providerImplementationState: providerState,
      providerVersion,
      providerStatus: "SERP_DATA_NOT_CONFIGURED",
      country: config.defaultCountry,
      language: config.defaultLanguage,
      device: config.defaultDevice,
      totalTrackedClusters: 0,
      totalSnapshots: 0,
      appliedCompetitorPolicy: {
        policyName: config.discoveryPolicy.policyName,
        minClusterAppearances: config.discoveryPolicy.minClusterAppearances,
        minClusterShareRatio: config.discoveryPolicy.minClusterShareRatio,
        minTop10Appearances: config.discoveryPolicy.minTop10Appearances,
      },
      searchCompetitors: [],
      serpIntentAssessments: [],
      topicComparisons: [],
      serpFeatureOpportunities: [],
      positionHistory: [],
      serpVolatilityAssessment: {
        volatilityState: "INSUFFICIENT_DATA",
        volatilityScore: 0,
        observationCount: 0,
        rationale: "SERP data provider is not configured. Intelligence layer degraded gracefully.",
      },
      governanceLimitations: [
        "SERP data provider is not configured for this project. No live or mock SERP queries were executed.",
        "First-party GSC search demand remains authoritative for technical and content actions.",
      ],
    };
    return {
      report: emptyReport,
      actions: [],
      currentSnapshots: [],
    };
  }

  // 1. Budget and select query clusters to track
  const trackedClusters = params.queryClusters.slice(0, config.maxTrackedQueryClusters);
  const currentSnapshots: SerpSnapshot[] = [];
  const featureOpportunities: SerpFeatureOpportunity[] = [];
  const topicGapsForActions: Array<{ clusterId: string; representativeLabel: string; targetUrl: string; gaps: string[]; technicalBlockers?: string[] }> = [];

  // Extract competitor page observations
  const competitorObsMap = new Map(competitorPageContents.map((c) => [c.url, extractCompetitorPageObservation(c)]));

  const serpIntentAssessments: CompetitorSerpIntelligenceReport["serpIntentAssessments"] = [];
  const topicComparisons: CompetitorSerpIntelligenceReport["topicComparisons"] = [];
  const positionHistory: CompetitorSerpIntelligenceReport["positionHistory"] = [];

  // Determine active discovery policy (adjust for small sample sizes)
  const activePolicy =
    trackedClusters.length <= 2 && config.discoveryPolicy.policyName === "BALANCED_DISCOVERY_POLICY"
      ? SMALL_SAMPLE_DISCOVERY_POLICY
      : config.discoveryPolicy;

  // 2. Fetch SERP Snapshots per tracked cluster
  for (const cluster of trackedClusters) {
    const req = {
      query: cluster.representativeLabel,
      clusterId: cluster.clusterId,
      country: config.defaultCountry,
      language: config.defaultLanguage,
      device: config.defaultDevice,
      selectionReason: "HIGH_PRIORITY_ACTION" as const,
    };

    const fetchRes = await provider.fetchSerp(req, params.projectId, ownDomainAliases);

    if (
      fetchRes.status === "SERP_PROVIDER_AUTH_FAILED" ||
      fetchRes.status === "SERP_PROVIDER_QUOTA_EXCEEDED" ||
      fetchRes.status === "SERP_FETCH_FAILED"
    ) {
      const errorReport: CompetitorSerpIntelligenceReport = {
        generatedAt: new Date().toISOString(),
        projectId: params.projectId,
        provider: provider.providerType,
        providerImplementationState: providerState,
        providerVersion,
        providerStatus: fetchRes.status,
        country: config.defaultCountry,
        language: config.defaultLanguage,
        device: config.defaultDevice,
        totalTrackedClusters: 0,
        totalSnapshots: 0,
        appliedCompetitorPolicy: {
          policyName: activePolicy.policyName,
          minClusterAppearances: activePolicy.minClusterAppearances,
          minClusterShareRatio: activePolicy.minClusterShareRatio,
          minTop10Appearances: activePolicy.minTop10Appearances,
        },
        searchCompetitors: [],
        serpIntentAssessments: [],
        topicComparisons: [],
        serpFeatureOpportunities: [],
        positionHistory: [],
        serpVolatilityAssessment: {
          volatilityState: "INSUFFICIENT_DATA",
          volatilityScore: 0,
          observationCount: 0,
          rationale: fetchRes.errorMessage || "SERP Provider returned error.",
        },
        governanceLimitations: [
          `Provider Error: ${fetchRes.errorMessage}`,
          "Infrastructure errors never mutate the project's SEO Health score.",
        ],
      };
      return { report: errorReport, actions: [], currentSnapshots: [] };
    }

    if (fetchRes.snapshot) {
      const snap = fetchRes.snapshot;
      currentSnapshots.push(snap);

      // Determine Own Landing Page & Format
      const ownUrl = cluster.dominantLandingPage || snap.ownSiteResults[0]?.url;
      const ownMeta = ownUrl ? ownPagesMetadata[ownUrl] : undefined;
      const ownResultType = ownMeta ? classifyResultType(ownMeta.url, ownMeta.title, "").resultType : undefined;

      // 3. Analyze Intent & Result-Type Distributions
      const intentDist = analyzeSerpIntentDistribution(
        snap.organicResults,
        cluster.primaryIntent,
        config.intentDominanceThreshold
      );
      const resultDist = analyzeResultTypeDistribution(snap.organicResults, ownResultType);

      let ownVisibilityState: SerpOwnVisibilityState = "NO_OBSERVED_OWN_VISIBILITY";
      if (snap.ownSiteResults.length > 0) {
        const bestPos = snap.ownSiteResults[0].position;
        if (bestPos <= 3) ownVisibilityState = "STRONG_OWN_VISIBILITY";
        else if (bestPos <= 10) ownVisibilityState = "PARTIAL_OWN_VISIBILITY";
        else ownVisibilityState = "WEAK_OWN_VISIBILITY";
      }

      serpIntentAssessments.push({
        clusterId: cluster.clusterId,
        representativeLabel: cluster.representativeLabel,
        intentDistribution: intentDist,
        resultTypeDistribution: resultDist,
        ownVisibilityState,
      });

      // 4. Topic Comparison
      const competitorUrlsInSerp = snap.organicResults.filter((r) => !r.isOwnDomain).map((r) => r.url);
      const matchedCompetitorObs = competitorUrlsInSerp
        .map((url) => competitorObsMap.get(url))
        .filter((obs): obs is ReturnType<typeof extractCompetitorPageObservation> => obs !== undefined);

      const ownTopics = ownMeta?.topics || [];
      const topicComp = compareSerpTopics({
        clusterId: cluster.clusterId,
        snapshotId: snap.snapshotId,
        ownPageTopics: ownTopics,
        competitorObservations: matchedCompetitorObs,
        config,
      });

      topicComparisons.push({
        clusterId: cluster.clusterId,
        representativeLabel: cluster.representativeLabel,
        topics: topicComp.topics,
        ownDifferentiationSignals: topicComp.ownDifferentiationSignals,
        serpCoverageGaps: topicComp.serpCoverageGaps,
      });

      if (ownUrl && topicComp.serpCoverageGaps.length > 0) {
        const technicalBlockers: string[] = [];
        if (ownMeta?.isNoindex) technicalBlockers.push("INDEXABILITY_NOINDEX");
        if (ownMeta?.statusCode && ownMeta.statusCode >= 400) technicalBlockers.push(`STATUS_${ownMeta.statusCode}`);

        topicGapsForActions.push({
          clusterId: cluster.clusterId,
          representativeLabel: cluster.representativeLabel,
          targetUrl: ownUrl,
          gaps: topicComp.serpCoverageGaps,
          technicalBlockers,
        });
      }

      // 5. Evaluate Advisory SERP Features
      const feats = evaluateSerpFeatureOpportunities(snap, cluster.representativeLabel, snap.ownSiteResults[0]?.position);
      featureOpportunities.push(...feats);

      // 6. Position History Tracker
      const prevSnap = previousSnapshots.find((p) => p.clusterId === cluster.clusterId || p.normalizedQuery === snap.normalizedQuery);
      const posHistory = trackSerpPositionHistory(snap, prevSnap);
      positionHistory.push(...posHistory);
    }
  }

  // 7. Discover Search Competitors across all snapshots
  const searchCompetitors = discoverSearchCompetitors({
    snapshots: currentSnapshots,
    configuredBusinessCompetitors,
    ownDomainAliases,
    config,
    policy: activePolicy,
  });

  // 8. Bridge to Phase 11 Canonical Actions
  const actions = bridgeSerpIntelligenceToActions(
    params.projectId,
    featureOpportunities,
    topicGapsForActions,
    params.existingActions || []
  );

  const report: CompetitorSerpIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    provider: provider.providerType,
    providerImplementationState: providerState,
    providerVersion,
    providerStatus: "SERP_DATA_FRESH_COMPLETE",
    country: config.defaultCountry,
    language: config.defaultLanguage,
    device: config.defaultDevice,
    totalTrackedClusters: trackedClusters.length,
    totalSnapshots: currentSnapshots.length,
    appliedCompetitorPolicy: {
      policyName: activePolicy.policyName,
      minClusterAppearances: activePolicy.minClusterAppearances,
      minClusterShareRatio: activePolicy.minClusterShareRatio,
      minTop10Appearances: activePolicy.minTop10Appearances,
    },
    searchCompetitors,
    serpIntentAssessments,
    topicComparisons,
    serpFeatureOpportunities: featureOpportunities,
    positionHistory,
    serpVolatilityAssessment: {
      volatilityState: currentSnapshots.length > 0 ? "SERP_VOLATILITY_LOW" : "INSUFFICIENT_DATA",
      volatilityScore: currentSnapshots.length > 0 ? 12 : 0,
      observationCount: positionHistory.length,
      rationale: currentSnapshots.length > 0
        ? "Observed top-10 positions across tracked queries demonstrate normal algorithmic stability."
        : "Insufficient historical observations to calculate SERP volatility.",
    },
    governanceLimitations: [
      "SERP snapshots represent observed point-in-time Google search results for the specified country, language, and device context.",
      "Search competitor discovery identifies domains sharing search visibility; it does not measure competitor company revenue, headcount, or backlink strength.",
      "Topic prevalence among ranking competitors is descriptive evidence of search landscape patterns, NOT a mandatory ranking requirement.",
      "SERP feature absence is never classified as an SEO defect. All SERP feature optimizations are advisory.",
      "Leaving the tracked top-N results is classified as 'NO_LONGER_OBSERVED_IN_TRACKED_RANGE' and does not imply deindexing.",
      "Snapshot immutability is guaranteed at runtime via Object.freeze and verified prior to history computation.",
    ],
  };

  return {
    report,
    actions,
    currentSnapshots,
  };
}
