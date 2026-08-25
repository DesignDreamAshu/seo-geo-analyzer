/**
 * Master Off-Page & Backlink Intelligence Engine Coordinator.
 * Orchestrates authorized provider retrieval, referring domain aggregations,
 * target health cross-referencing, competitor link gap intersects, and canonical action integration.
 */

import {
  OffPageBacklinkIntelligenceReport,
  BacklinkSnapshot,
  LinkAttribute,
} from "./types";
import { DEFAULT_BACKLINK_POLICY, SMALL_SAMPLE_BACKLINK_POLICY, BacklinkIntelligencePolicy } from "./config";
import { BacklinkProvider } from "./providers/types";
import { getActiveBacklinkProvider, getBacklinkProviderImplementationState } from "./providers/provider-registry";
import { analyzeAnchorDistribution } from "./anchor-intelligence";
import { evaluateBacklinkTargetHealth, CrawlTargetMetadata } from "./target-health";
import { detectSuspiciousLinkPatterns } from "./suspicious-patterns";
import { analyzeCompetitorLinkGaps, CompetitorReferringDomainDataset } from "./competitor-gap";
import { trackBacklinkHistory } from "./history-tracker";
import {
  bridgeBrokenBacklinksToPhase11,
  bridgeLinkProspectsToPhase11,
  identifyLinkableAssets,
} from "./phase-integrators";
import { SearchCompetitorSummary } from "../competitor-serp/types";
import { QueryCluster } from "../content-demand/types";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeBacklinksParams {
  projectId: string;
  targetDomain: string;
  ownDomainAliases?: string[];
  competitorDomains?: Array<{ domain: string; summary?: SearchCompetitorSummary }>;
  crawlMetadataMap?: Map<string, CrawlTargetMetadata>;
  queryClusters?: QueryCluster[];
  previousSnapshot?: BacklinkSnapshot;
  existingActions?: SeoActionItem[];
  provider?: BacklinkProvider;
  policy?: BacklinkIntelligencePolicy;
}

export interface AnalyzeBacklinksResult {
  report: OffPageBacklinkIntelligenceReport;
  currentSnapshot?: BacklinkSnapshot;
  actions: SeoActionItem[];
}

export async function analyzeBacklinkIntelligence(
  params: AnalyzeBacklinksParams
): Promise<AnalyzeBacklinksResult> {
  const provider = params.provider || getActiveBacklinkProvider();
  const ownDomainAliases = params.ownDomainAliases || [params.targetDomain];
  const crawlMetadataMap = params.crawlMetadataMap || new Map();
  const queryClusters = params.queryClusters || [];
  const competitorDomains = params.competitorDomains || [];

  // Determine active policy (or adapt for small sample)
  let policy = params.policy;
  if (!policy) {
    policy = DEFAULT_BACKLINK_POLICY;
  }

  const providerType = provider ? provider.providerType : "UNCONFIGURED";
  const providerState = getBacklinkProviderImplementationState(providerType);
  const providerVersion = provider ? provider.providerVersion : "v0.0.0";

  // Check provider configuration
  if (!provider || !provider.isConfigured()) {
    const emptyReport: OffPageBacklinkIntelligenceReport = {
      generatedAt: new Date().toISOString(),
      projectId: params.projectId,
      targetDomain: params.targetDomain,
      provider: providerType,
      providerStatus: "BACKLINK_DATA_NOT_CONFIGURED",
      providerImplementationState: providerState,
      providerVersion,
      indexType: "LIVE",
      appliedPolicy: {
        policyName: policy.policyName,
        selectionSource: policy.selectionSource,
        sitewideRepetitionThreshold: policy.sitewideRepetitionThreshold,
        exactMatchReviewThresholdRatio: policy.exactMatchReviewThresholdRatio,
        minSampleSizeForAnchorReview: policy.minSampleSizeForAnchorReview,
        burstThresholdRatio: policy.burstThresholdRatio,
        minCompetitorSourcesForProspect: policy.minCompetitorSourcesForProspect,
      },
      totalObservedBacklinkRecords: 0,
      totalObservedReferringDomains: 0,
      datasetCompletenessNote: "Backlink data provider is not configured. Off-page intelligence degraded gracefully.",
      attributeDistribution: { FOLLOW: 0, NOFOLLOW: 0, SPONSORED: 0, UGC: 0, UNKNOWN: 0 },
      anchorDistribution: {
        counts: { BRANDED: 0, NAKED_URL: 0, GENERIC: 0, PARTIAL_MATCH: 0, EXACT_MATCH_CANDIDATE: 0, IMAGE_NO_TEXT: 0, UNKNOWN: 0 },
        percentages: { BRANDED: 0, NAKED_URL: 0, GENERIC: 0, PARTIAL_MATCH: 0, EXACT_MATCH_CANDIDATE: 0, IMAGE_NO_TEXT: 0, UNKNOWN: 0 },
        sampleSize: 0,
      },
      linkedPageDistribution: { homepageLinks: 0, internalPageLinks: 0, uniqueTargetUrlsCount: 0, topLinkedPages: [] },
      brokenTargetOpportunities: [],
      redirectTargetReviews: [],
      canonicalTargetReviews: [],
      suspiciousPatternReviews: [],
      linkableAssetSignals: [],
      competitorLinkGaps: {
        totalCompetitorsAnalyzed: 0,
        includedRelationshipTypes: [],
        ownOnlyReferringDomainsCount: 0,
        sharedReferringDomainsCount: 0,
        competitorOnlyReferringDomainsCount: 0,
        linkProspectReviews: [],
      },
      historicalChanges: {
        isComparable: false,
        incomparabilityReason: "No prior snapshot or provider unconfigured.",
        newlyObservedBacklinksCount: 0,
        noLongerObservedBacklinksCount: 0,
        newlyObservedReferringDomainsCount: 0,
        noLongerObservedReferringDomainsCount: 0,
      },
      searchCorrelationInsights: [],
      governanceLimitations: [
        "Backlink data provider is not configured for this project. No external backlink API calls were executed.",
        "First-party technical crawl facts and GSC search demand remain authoritative for SEO actions.",
      ],
      immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
    };

    return {
      report: emptyReport,
      actions: [],
    };
  }

  // 1. Fetch Backlinks for Own Domain
  const ownFetchRes = await provider.fetchDomainBacklinks(
    { targetDomain: params.targetDomain, projectId: params.projectId, rowLimit: policy.maxBacklinksProcessedPerDomain },
    ownDomainAliases
  );

  if (
    ownFetchRes.status === "BACKLINK_PROVIDER_AUTH_FAILED" ||
    ownFetchRes.status === "BACKLINK_PROVIDER_QUOTA_EXCEEDED" ||
    ownFetchRes.status === "BACKLINK_FETCH_FAILED"
  ) {
    const errorReport: OffPageBacklinkIntelligenceReport = {
      generatedAt: new Date().toISOString(),
      projectId: params.projectId,
      targetDomain: params.targetDomain,
      provider: providerType,
      providerStatus: ownFetchRes.status,
      providerImplementationState: providerState,
      providerVersion,
      indexType: "LIVE",
      appliedPolicy: {
        policyName: policy.policyName,
        selectionSource: policy.selectionSource,
        sitewideRepetitionThreshold: policy.sitewideRepetitionThreshold,
        exactMatchReviewThresholdRatio: policy.exactMatchReviewThresholdRatio,
        minSampleSizeForAnchorReview: policy.minSampleSizeForAnchorReview,
        burstThresholdRatio: policy.burstThresholdRatio,
        minCompetitorSourcesForProspect: policy.minCompetitorSourcesForProspect,
      },
      totalObservedBacklinkRecords: 0,
      totalObservedReferringDomains: 0,
      datasetCompletenessNote: ownFetchRes.errorMessage || "Provider error.",
      attributeDistribution: { FOLLOW: 0, NOFOLLOW: 0, SPONSORED: 0, UGC: 0, UNKNOWN: 0 },
      anchorDistribution: {
        counts: { BRANDED: 0, NAKED_URL: 0, GENERIC: 0, PARTIAL_MATCH: 0, EXACT_MATCH_CANDIDATE: 0, IMAGE_NO_TEXT: 0, UNKNOWN: 0 },
        percentages: { BRANDED: 0, NAKED_URL: 0, GENERIC: 0, PARTIAL_MATCH: 0, EXACT_MATCH_CANDIDATE: 0, IMAGE_NO_TEXT: 0, UNKNOWN: 0 },
        sampleSize: 0,
      },
      linkedPageDistribution: { homepageLinks: 0, internalPageLinks: 0, uniqueTargetUrlsCount: 0, topLinkedPages: [] },
      brokenTargetOpportunities: [],
      redirectTargetReviews: [],
      canonicalTargetReviews: [],
      suspiciousPatternReviews: [],
      linkableAssetSignals: [],
      competitorLinkGaps: { totalCompetitorsAnalyzed: 0, includedRelationshipTypes: [], ownOnlyReferringDomainsCount: 0, sharedReferringDomainsCount: 0, competitorOnlyReferringDomainsCount: 0, linkProspectReviews: [] },
      historicalChanges: { isComparable: false, newlyObservedBacklinksCount: 0, noLongerObservedBacklinksCount: 0, newlyObservedReferringDomainsCount: 0, noLongerObservedReferringDomainsCount: 0 },
      searchCorrelationInsights: [],
      governanceLimitations: [
        `Provider Error: ${ownFetchRes.errorMessage}`,
        "Provider infrastructure errors never alter the website's technical SEO Health score.",
      ],
      immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
    };

    return {
      report: errorReport,
      actions: [],
    };
  }

  const currentSnapshot = ownFetchRes.snapshot!;
  const backlinks = currentSnapshot.observedBacklinks;
  const referringDomains = currentSnapshot.referringDomains;

  // 2. Attribute Distribution
  const attributeDistribution: Record<LinkAttribute, number> = {
    FOLLOW: 0,
    NOFOLLOW: 0,
    SPONSORED: 0,
    UGC: 0,
    UNKNOWN: 0,
  };
  for (const bl of backlinks) {
    for (const attr of bl.linkAttributes) {
      attributeDistribution[attr] = (attributeDistribution[attr] || 0) + 1;
    }
  }

  // 3. Anchor Text Distribution
  const anchorDistribution = analyzeAnchorDistribution(backlinks, policy);

  // 4. Linked Page Distribution
  let homepageLinks = 0;
  let internalLinks = 0;
  const targetPageMap = new Map<string, { count: number; domains: Set<string> }>();

  for (const bl of backlinks) {
    const isHome = bl.targetNormalizedUrl.endsWith(".io") || bl.targetNormalizedUrl.endsWith(".com") || bl.targetNormalizedUrl.endsWith("/");
    if (isHome) homepageLinks++;
    else internalLinks++;

    const entry = targetPageMap.get(bl.targetNormalizedUrl) || { count: 0, domains: new Set<string>() };
    entry.count++;
    entry.domains.add(bl.sourceRegistrableDomain);
    targetPageMap.set(bl.targetNormalizedUrl, entry);
  }

  const topLinkedPages = Array.from(targetPageMap.entries())
    .map(([url, data]) => ({ url, backlinkCount: data.count, referringDomainCount: data.domains.size }))
    .sort((a, b) => b.backlinkCount - a.backlinkCount)
    .slice(0, 10);

  // 5. Target Health Cross-Reference
  const targetHealth = evaluateBacklinkTargetHealth(backlinks, crawlMetadataMap);

  // 6. Suspicious Link Patterns
  const suspiciousReviews = detectSuspiciousLinkPatterns(backlinks, policy);

  // 7. Linkable Asset Signals
  const linkableAssets = identifyLinkableAssets(backlinks, referringDomains, queryClusters);

  // 8. Competitor Link Gap & Intersect
  const competitorDatasets: CompetitorReferringDomainDataset[] = [];
  for (const comp of competitorDomains) {
    const compRes = await provider.fetchDomainBacklinks({ targetDomain: comp.domain, projectId: params.projectId, rowLimit: 5000 });
    if (compRes.snapshot) {
      competitorDatasets.push({
        competitorDomain: comp.domain,
        summary: comp.summary,
        referringDomains: compRes.snapshot.referringDomains,
      });
    }
  }

  const competitorGap = analyzeCompetitorLinkGaps(referringDomains, competitorDatasets, policy);

  // 9. Historical Changes
  const historyAnalysis = trackBacklinkHistory(currentSnapshot, params.previousSnapshot, policy);

  // 10. Canonical Actions Bridge
  const brokenActions = bridgeBrokenBacklinksToPhase11(params.projectId, targetHealth.brokenTargets, params.existingActions || []);
  const prospectActions = bridgeLinkProspectsToPhase11(params.projectId, competitorGap.linkProspectReviews, params.existingActions || []);
  const actions = [...brokenActions, ...prospectActions];

  const completenessNote =
    currentSnapshot.completeness === "BACKLINK_DATA_FRESH_COMPLETE"
      ? `Retrieved ${backlinks.length.toLocaleString()} backlink records across ${referringDomains.length.toLocaleString()} referring domains.`
      : `${backlinks.length.toLocaleString()} backlink records available in retrieved provider dataset (Status: ${currentSnapshot.completeness}).`;

  const report: OffPageBacklinkIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    targetDomain: params.targetDomain,
    provider: provider.providerType,
    providerStatus: currentSnapshot.completeness,
    providerImplementationState: providerState,
    providerVersion,
    indexType: currentSnapshot.indexType,
    appliedPolicy: {
      policyName: policy.policyName,
      selectionSource: policy.selectionSource,
      sitewideRepetitionThreshold: policy.sitewideRepetitionThreshold,
      exactMatchReviewThresholdRatio: policy.exactMatchReviewThresholdRatio,
      minSampleSizeForAnchorReview: policy.minSampleSizeForAnchorReview,
      burstThresholdRatio: policy.burstThresholdRatio,
      minCompetitorSourcesForProspect: policy.minCompetitorSourcesForProspect,
    },
    totalObservedBacklinkRecords: backlinks.length,
    totalObservedReferringDomains: referringDomains.length,
    datasetCompletenessNote: completenessNote,
    attributeDistribution,
    anchorDistribution,
    linkedPageDistribution: {
      homepageLinks,
      internalPageLinks: internalLinks,
      uniqueTargetUrlsCount: targetPageMap.size,
      topLinkedPages,
    },
    brokenTargetOpportunities: targetHealth.brokenTargets,
    redirectTargetReviews: targetHealth.redirectTargetReviews,
    canonicalTargetReviews: targetHealth.canonicalTargetReviews,
    suspiciousPatternReviews: suspiciousReviews,
    linkableAssetSignals: linkableAssets,
    competitorLinkGaps: competitorGap,
    historicalChanges: historyAnalysis,
    searchCorrelationInsights: [],
    governanceLimitations: [
      "Backlink records represent observed links in the configured provider index; they are not claimed to represent every link on the web.",
      "Referring domain counts and link attributes are descriptive evidence, not an arbitrary quality score or PageRank simulation.",
      "Follow does NOT mean good, and nofollow does NOT mean bad. Non-followed links represent legitimate external traffic and brand visibility.",
      "Suspicious pattern reviews identify anomalous clustering for manual review; they do NOT assert search engine penalties or negative SEO attacks.",
      "Dream SEO never automatically recommends or generates disavow files. All disavow actions require explicit manual expert confirmation.",
      "Off-page intelligence never mutates the project's 95-rule technical SEO Health score.",
    ],
    immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  return {
    report,
    currentSnapshot,
    actions,
  };
}
