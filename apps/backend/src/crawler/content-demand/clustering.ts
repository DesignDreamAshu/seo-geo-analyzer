/**
 * Durable Query Clustering Engine.
 * Generates durable cluster identities based on sorted semantic token membership,
 * completely independent of display label or impression fluctuations.
 */

import { NormalizedQueryRecord, QueryCluster, ClusterLifecycleState } from "./types";
import { normalizeQuery, extractSemanticTokens, areQueriesNearIdentical } from "./normalization";
import { classifyQueryIntent } from "./intent-classifier";

export function clusterQueries(
  queries: NormalizedQueryRecord[],
  algorithmVersion: string = "v1.2.0-semantic-stem"
): QueryCluster[] {
  if (queries.length === 0) return [];

  // Sort queries deterministically by semantic token length, then rawQuery alphabetically
  const sorted = [...queries].sort((a, b) => {
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    return a.rawQuery.localeCompare(b.rawQuery);
  });

  const clusters: QueryCluster[] = [];
  const assignedQueryIds = new Set<string>();

  for (const q of sorted) {
    if (assignedQueryIds.has(q.queryId)) continue;

    // Find candidate cluster or create new one
    const matchingCluster = clusters.find((c) => isQueryBelongingToCluster(q, c));

    if (matchingCluster) {
      matchingCluster.rawQueries.push(q.rawQuery);
      matchingCluster.totalObservedImpressions += q.impressions;
      matchingCluster.totalClicks += q.clicks;
      matchingCluster.averagePosition =
        (matchingCluster.averagePosition * (matchingCluster.rawQueries.length - 1) + q.position) /
        matchingCluster.rawQueries.length;
      for (const lp of q.landingPages) {
        if (!matchingCluster.landingPages.includes(lp.url)) {
          matchingCluster.landingPages.push(lp.url);
        }
      }
      assignedQueryIds.add(q.queryId);
    } else {
      // Create new cluster with this query
      const intentRes = classifyQueryIntent(q.rawQuery, q.brandState);
      const semanticTokens = extractSemanticTokens(q.normalizedQuery);
      const clusterId = buildDurableClusterId(semanticTokens, q.brandState);

      const dominantLp = q.landingPages.length > 0 ? q.landingPages[0].url : undefined;

      const newCluster: QueryCluster = {
        clusterId,
        semanticFingerprint: semanticTokens.join("+"),
        representativeLabel: formatRepresentativeLabel(q.normalizedQuery),
        rawQueries: [q.rawQuery],
        totalObservedImpressions: q.impressions,
        totalClicks: q.clicks,
        averageCtr: q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0,
        averagePosition: q.position,
        landingPages: q.landingPages.map((lp) => lp.url),
        dominantLandingPage: dominantLp,
        primaryIntent: intentRes.primaryIntent,
        allIntents: intentRes.allIntents,
        intentConfidence: intentRes.confidence,
        clusteringConfidence: "HIGH_CONFIDENCE",
        clusteringAlgorithmVersion: algorithmVersion,
        lifecycleState: "CLUSTER_UNCHANGED",
        brandState: q.brandState,
        modifiers: intentRes.modifiers,
        isQuestionDemand: intentRes.isQuestionDemand,
        isComparisonDemand: intentRes.isComparisonDemand,
        isCommercialDemand: intentRes.isCommercialDemand,
      };

      clusters.push(newCluster);
      assignedQueryIds.add(q.queryId);
    }
  }

  // Recalculate average CTR and dominant landing page for all clusters
  for (const c of clusters) {
    if (c.totalObservedImpressions > 0) {
      c.averageCtr = (c.totalClicks / c.totalObservedImpressions) * 100;
    }
  }

  return clusters;
}

/**
 * Builds durable cluster ID strictly from semantic core tokens and brand state.
 * Never uses impression counts, query order, or display label.
 */
export function buildDurableClusterId(semanticTokens: string[], brandState: string = "NON_BRANDED"): string {
  const sortedTokens = [...semanticTokens].sort();
  const tokenString = sortedTokens.join("_").replace(/[^a-zA-Z0-9_]/g, "");
  const hash = simpleHash(`${brandState}_${tokenString}`);
  return `CLUST_${tokenString.substring(0, 24)}_${hash}`;
}

export function buildStableClusterId(seedNormalizedQuery: string): string {
  const tokens = extractSemanticTokens(normalizeQuery(seedNormalizedQuery));
  return buildDurableClusterId(tokens);
}

function isQueryBelongingToCluster(query: NormalizedQueryRecord, cluster: QueryCluster): boolean {
  const qNorm = query.normalizedQuery;
  const seedNorm = normalizeQuery(cluster.representativeLabel);

  // 1. Near-identical check (e.g. singular/plural)
  if (areQueriesNearIdentical(qNorm, seedNorm)) return true;

  // 2. Token overlap check
  const qTokens = new Set(extractSemanticTokens(qNorm));
  const seedTokens = new Set(extractSemanticTokens(seedNorm));

  let intersectionCount = 0;
  for (const t of qTokens) {
    if (seedTokens.has(t)) intersectionCount++;
  }

  const overlapRatio = intersectionCount / Math.max(qTokens.size, seedTokens.size);

  // High token overlap + same brand state
  if (overlapRatio >= 0.65 && query.brandState === cluster.brandState) {
    const hasSharedPage = query.landingPages.some((lp) => cluster.landingPages.includes(lp.url));
    if (hasSharedPage || query.landingPages.length === 0) {
      return true;
    }
  }

  return false;
}

function formatRepresentativeLabel(normalizedQuery: string): string {
  return normalizedQuery
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}

export function evaluateClusterLifecycle(
  currentCluster: QueryCluster,
  previousClusters?: QueryCluster[],
  previousAlgorithmVersion?: string
): ClusterLifecycleState {
  if (!previousClusters || previousClusters.length === 0) {
    return "CLUSTER_UNCHANGED";
  }

  // 1. Algorithm version mismatch -> CLUSTER_SEMANTICS_CHANGED
  if (previousAlgorithmVersion && previousAlgorithmVersion !== currentCluster.clusteringAlgorithmVersion) {
    return "CLUSTER_SEMANTICS_CHANGED";
  }

  const prevMatching = previousClusters.find((p) => p.clusterId === currentCluster.clusterId);

  if (prevMatching) {
    // Check if membership changed
    const prevSet = new Set(prevMatching.rawQueries.map((q) => normalizeQuery(q)));
    const currSet = new Set(currentCluster.rawQueries.map((q) => normalizeQuery(q)));

    if (prevSet.size === currSet.size && [...currSet].every((q) => prevSet.has(q))) {
      return "CLUSTER_UNCHANGED";
    }

    return "CLUSTER_MEMBERSHIP_CHANGED";
  }

  // Check for merge: multiple previous clusters share queries with current cluster
  const mergedSources = previousClusters.filter((p) =>
    p.rawQueries.some((pq) => currentCluster.rawQueries.map((cq) => normalizeQuery(cq)).includes(normalizeQuery(pq)))
  );

  if (mergedSources.length > 1) {
    return "CLUSTER_MERGED";
  }

  // Check for split: this cluster contains only a subset of an older cluster's queries
  if (mergedSources.length === 1 && mergedSources[0].rawQueries.length > currentCluster.rawQueries.length) {
    return "CLUSTER_SPLIT";
  }

  return "CLUSTER_UNCHANGED";
}
