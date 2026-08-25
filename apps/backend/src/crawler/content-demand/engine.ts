/**
 * Master Content & Search Demand Intelligence Engine.
 * Coordinates query clustering, intent alignment, content coverage, cannibalization detection,
 * and trend analysis to guide evidence-based content optimization.
 */

import {
  ContentDemandIntelligenceReport,
  NormalizedQueryRecord,
  QueryCluster,
  ContentCoverageAssessment,
  CannibalizationAssessment,
  DemandTrendAssessment,
  BrandState,
  GscRetrievalStatus,
} from "./types";
import { normalizeQuery, classifyBrandState, extractSemanticTokens } from "./normalization";
import { clusterQueries } from "./clustering";
import { assessContentCoverage } from "./coverage-engine";
import { evaluateCannibalization } from "./cannibalization";
import { evaluateDemandTrend } from "./trend-engine";
import { PageMetadataSummary } from "./fit-evaluator";
import { bridgeContentDemandToActions } from "./action-bridge";
import { SeoActionItem } from "../opportunity/types";
import { resolveDemandScalePolicy, DemandScalePolicy } from "./config";

export interface ContentDemandAnalysisInputs {
  projectId: string;
  rawGscQueryRows: Array<{
    query: string;
    page: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  brandAliases?: string[];
  pagesMetadata?: Record<string, PageMetadataSummary>;
  previousPeriodClusters?: Array<{ clusterId: string; dominantLandingPage?: string; totalObservedImpressions: number }>;
  periodRange?: string;
  siteKnownUrls?: string[];
  policyName?: string;
  customPolicy?: Partial<DemandScalePolicy>;
  isBusinessRelevanceValidated?: boolean;
  retrievalStatus?: GscRetrievalStatus;
  isPeriodMismatched?: boolean;
}

export function analyzeContentAndSearchDemand(inputs: ContentDemandAnalysisInputs): {
  report: ContentDemandIntelligenceReport;
  bridgeActions: SeoActionItem[];
} {
  const periodRange = inputs.periodRange || "Evaluated GSC window";
  const brandAliases = inputs.brandAliases || [];
  const pagesMeta = inputs.pagesMetadata || {};
  const siteUrls = inputs.siteKnownUrls || Object.keys(pagesMeta);
  const policy = resolveDemandScalePolicy(inputs.policyName, inputs.customPolicy);
  const isBusinessValidated = inputs.isBusinessRelevanceValidated ?? false;
  const retrievalStatus = inputs.retrievalStatus || "QUERY_DATA_COMPLETE_TO_AVAILABLE_API_RESULT";
  const isPeriodMismatched = inputs.isPeriodMismatched ?? false;

  // 1. Ingest & Normalize Query Rows
  const normalizedRecords: NormalizedQueryRecord[] = inputs.rawGscQueryRows.map((row, index) => {
    const norm = normalizeQuery(row.query);
    const brand: BrandState = classifyBrandState(norm, brandAliases);
    const semanticTokens = extractSemanticTokens(norm);
    return {
      queryId: `qry_${index}_${norm.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 16)}`,
      rawQuery: row.query,
      normalizedQuery: norm,
      semanticTokens,
      intents: [],
      brandState: brand,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      position: row.position,
      landingPages: [{ url: row.page, impressions: row.impressions, clicks: row.clicks, position: row.position }],
      dataQuality: "FRESH_COMPLETE",
    };
  });

  // 2. Perform Stable Query Clustering
  const clusters = clusterQueries(normalizedRecords, policy.clusteringAlgorithmVersion);

  // Map previous period cluster data for stability & trend comparison
  const prevMap = new Map<string, { dominantLp?: string; impressions: number }>();
  for (const prev of inputs.previousPeriodClusters || []) {
    prevMap.set(prev.clusterId, { dominantLp: prev.dominantLandingPage, impressions: prev.totalObservedImpressions });
  }

  const coverageAssessments: ContentCoverageAssessment[] = [];
  const cannibalizationAssessments: CannibalizationAssessment[] = [];
  const trendAssessments: DemandTrendAssessment[] = [];

  // 3. Process Coverage, Cannibalization, and Trends for each cluster
  for (const cluster of clusters) {
    const prevData = prevMap.get(cluster.clusterId);
    const dominantLp = cluster.dominantLandingPage;
    const pageMeta = dominantLp ? pagesMeta[dominantLp] || { url: dominantLp } : undefined;

    // A. Coverage Assessment
    const cov = assessContentCoverage(
      cluster,
      pageMeta,
      siteUrls,
      prevData?.dominantLp,
      policy,
      isBusinessValidated,
      isPeriodMismatched
    );
    coverageAssessments.push(cov);

    // B. Cannibalization Assessment
    const can = evaluateCannibalization(cluster, prevData?.dominantLp, policy);
    if (can) {
      cannibalizationAssessments.push(can);
    }

    // C. Trend Assessment
    const trend = evaluateDemandTrend(
      cluster,
      prevData?.impressions,
      "FRESH_COMPLETE",
      policy,
      isPeriodMismatched
    );
    trendAssessments.push(trend);
  }

  // 4. Summaries & Governance
  const totalImps = clusters.reduce((sum, c) => sum + c.totalObservedImpressions, 0);
  const totalClicks = clusters.reduce((sum, c) => sum + c.totalClicks, 0);

  const report: ContentDemandIntelligenceReport = {
    reportId: `demand_rep_${Date.now()}`,
    projectId: inputs.projectId,
    generatedAt: new Date().toISOString(),
    periodRange,
    dataQuality: "FRESH_COMPLETE",
    retrievalStatus,
    policyUsed: policy,
    summary: {
      totalEvaluatedQueries: normalizedRecords.length,
      totalClusters: clusters.length,
      brandedClustersCount: clusters.filter((c) => c.brandState === "BRANDED").length,
      nonBrandedClustersCount: clusters.filter((c) => c.brandState === "NON_BRANDED").length,
      totalObservedImpressions: totalImps,
      totalClicks,
      improveExistingCount: coverageAssessments.filter((c) => c.decision === "IMPROVE_EXISTING_PAGE").length,
      createNewCandidateCount: coverageAssessments.filter((c) => c.decision === "CREATE_NEW_PAGE_CANDIDATE").length,
      cannibalizationCandidatesCount: cannibalizationAssessments.filter((c) => c.state === "LIKELY_CANNIBALIZATION" || c.state === "CANNIBALIZATION_CANDIDATE").length,
      emergingDemandCount: trendAssessments.filter((t) => t.trendState === "EMERGING_DEMAND").length,
      decliningDemandCount: trendAssessments.filter((t) => t.trendState === "DECLINING_DEMAND").length,
      questionDemandCount: clusters.filter((c) => c.isQuestionDemand).length,
    },
    queryClusters: clusters,
    coverageAssessments,
    cannibalizationAssessments,
    trendAssessments,
    dataLimitations: [
      `Demand signals were derived from ${normalizedRecords.length} query-level rows available in the connected Search Console dataset (Status: ${retrievalStatus}).`,
      "Observed GSC impressions represent first-party property search impressions, NOT total third-party keyword market volume.",
      "Google Search Console may anonymize or omit low-volume query records from API exports.",
      "Multiple URLs ranking for branded queries or parent-child hierarchies is normal and healthy (not automatically cannibalization).",
      "Always validate commercial service capability and business intent before authoring new content assets.",
    ],
  };

  // 5. Emit Bridge Actions into Phase 11
  const bridgeActions = bridgeContentDemandToActions(inputs.projectId, coverageAssessments, cannibalizationAssessments);

  return {
    report,
    bridgeActions,
  };
}
