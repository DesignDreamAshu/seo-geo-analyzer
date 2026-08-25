/**
 * Hardened Search Competitor Discovery Engine.
 * Evaluates competitor visibility dynamically against configurable discovery policies.
 * Considers cluster appearances, cluster share ratio, and top-10 consistency.
 */

import { SerpSnapshot, SearchCompetitorSummary, CompetitorRelationship, ResultType } from "./types";
import { SerpIntelligenceConfig, DEFAULT_SERP_CONFIG, CompetitorDiscoveryPolicy } from "./config";
import { QueryIntent } from "../content-demand/types";

export interface CompetitorDiscoveryOptions {
  snapshots: SerpSnapshot[];
  configuredBusinessCompetitors?: string[]; // e.g. ['accenture.com', 'deloitte.com']
  ownDomainAliases?: string[];
  config?: SerpIntelligenceConfig;
  policy?: CompetitorDiscoveryPolicy;
}

export function discoverSearchCompetitors(options: CompetitorDiscoveryOptions): SearchCompetitorSummary[] {
  const { snapshots, configuredBusinessCompetitors = [], ownDomainAliases = [] } = options;
  const config = options.config || DEFAULT_SERP_CONFIG;
  const policy = options.policy || config.discoveryPolicy;

  if (snapshots.length === 0) return [];

  // Track occurrences per root domain
  interface DomainStats {
    domain: string;
    rootDomain: string;
    clustersAppeared: Set<string>;
    top10Count: number;
    positions: number[];
    resultTypes: ResultType[];
    intents: QueryIntent[];
    topics: string[];
  }

  const domainMap = new Map<string, DomainStats>();
  const totalTrackedClusters = new Set(snapshots.map((s) => s.clusterId || s.normalizedQuery)).size;

  for (const snap of snapshots) {
    const clusterKey = snap.clusterId || snap.normalizedQuery;
    const topResults = snap.organicResults.slice(0, 10);

    for (const r of topResults) {
      // Exclude own domains
      if (r.isOwnDomain) continue;

      const key = r.rootDomain;
      let stats = domainMap.get(key);
      if (!stats) {
        stats = {
          domain: r.domain,
          rootDomain: r.rootDomain,
          clustersAppeared: new Set<string>(),
          top10Count: 0,
          positions: [],
          resultTypes: [],
          intents: [],
          topics: [],
        };
        domainMap.set(key, stats);
      }

      stats.clustersAppeared.add(clusterKey);
      if (r.position <= 10) stats.top10Count++;
      stats.positions.push(r.position);
      stats.resultTypes.push(r.resultType);
      stats.topics.push(r.title);
    }
  }

  const summaries: SearchCompetitorSummary[] = [];

  // Evaluate discovered domains
  for (const stats of domainMap.values()) {
    const isConfiguredBusiness = configuredBusinessCompetitors.some(
      (b) => b.toLowerCase().replace(/^www\./, "") === stats.rootDomain
    );

    const clusterCount = stats.clustersAppeared.size;
    const clusterShareRatio = totalTrackedClusters > 0 ? Math.round((clusterCount / totalTrackedClusters) * 100) / 100 : 0;

    // Policy check: Must satisfy minimum appearances AND minimum share ratio (or be a configured business competitor)
    const meetsAppearances = clusterCount >= policy.minClusterAppearances;
    const meetsShare = clusterShareRatio >= policy.minClusterShareRatio;
    const meetsTop10 = stats.top10Count >= policy.minTop10Appearances;

    const isSearchCompetitor = meetsAppearances && meetsShare && meetsTop10;

    let relationship: CompetitorRelationship;
    if (isConfiguredBusiness && isSearchCompetitor) {
      relationship = "BOTH";
    } else if (isConfiguredBusiness) {
      relationship = "CONFIGURED_BUSINESS_COMPETITOR";
    } else if (isSearchCompetitor) {
      relationship = "DISCOVERED_SEARCH_COMPETITOR";
    } else {
      // Insufficient evidence under active policy
      continue;
    }

    const avgPos = stats.positions.reduce((a, b) => a + b, 0) / stats.positions.length;
    const primaryResultTypes = Array.from(new Set(stats.resultTypes)).slice(0, 3);
    const observedIntentOverlap: QueryIntent[] = ["COMMERCIAL_INVESTIGATION", "INFORMATIONAL"];

    // Compute Confidence
    let confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" = "MEDIUM_CONFIDENCE";
    if (clusterCount >= policy.highConfidenceMinAppearances && stats.top10Count >= 3 && clusterShareRatio >= 0.25) {
      confidence = "HIGH_CONFIDENCE";
    } else if (totalTrackedClusters <= 2 || clusterShareRatio < 0.15 || stats.top10Count < 2) {
      confidence = "LOW_CONFIDENCE";
    }

    let interpretationNote = "";
    if (relationship === "BOTH") {
      interpretationNote = `Direct commercial business competitor with prominent search visibility (${clusterCount}/${totalTrackedClusters} clusters, ${Math.round(clusterShareRatio * 100)}% share).`;
    } else if (relationship === "DISCOVERED_SEARCH_COMPETITOR") {
      interpretationNote = `Search visibility competitor (${clusterCount}/${totalTrackedClusters} clusters, ${Math.round(clusterShareRatio * 100)}% share). Observed in top search results.`;
    } else {
      interpretationNote = `Configured commercial competitor with limited search visibility in current query sample.`;
    }

    summaries.push({
      domain: stats.domain,
      rootDomain: stats.rootDomain,
      relationship,
      trackedClustersAppearedIn: clusterCount,
      totalTrackedClusters,
      clusterShareRatio,
      top10Appearances: stats.top10Count,
      averageObservedPosition: Math.round(avgPos * 10) / 10,
      primaryResultTypes,
      observedIntentOverlap,
      primaryTopicOverlap: stats.topics.slice(0, 3),
      evidenceCount: stats.positions.length,
      confidence,
      interpretationNote,
    });
  }

  // Include configured business competitors that had 0 search appearances
  for (const b of configuredBusinessCompetitors) {
    const rootB = b.toLowerCase().replace(/^www\./, "");
    if (!domainMap.has(rootB)) {
      summaries.push({
        domain: b,
        rootDomain: rootB,
        relationship: "CONFIGURED_BUSINESS_COMPETITOR",
        trackedClustersAppearedIn: 0,
        totalTrackedClusters,
        clusterShareRatio: 0,
        top10Appearances: 0,
        averageObservedPosition: 0,
        primaryResultTypes: [],
        observedIntentOverlap: [],
        primaryTopicOverlap: [],
        evidenceCount: 0,
        confidence: "HIGH_CONFIDENCE",
        interpretationNote: "Configured business competitor not currently observed in tracked top-10 SERP rankings.",
      });
    }
  }

  // Sort by top-10 appearances descending, then cluster appearances descending
  return summaries.sort((a, b) => b.top10Appearances - a.top10Appearances || b.trackedClustersAppearedIn - a.trackedClustersAppearedIn);
}
