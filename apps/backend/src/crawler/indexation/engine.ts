/**
 * Phase 19: Indexation Intelligence Master Engine Coordinator.
 * Coordinates known URL inventory, URL inspection normalization, matrix evaluation,
 * canonical intelligence, expansion detection, snapshot creation, and report generation.
 */

import {
  IndexationEvidenceRecord,
  GoogleIndexationIntelligenceReport,
  IndexationSnapshot,
  RawGoogleInspectionPayload,
  ProviderCapabilityState,
  InspectionSamplingMode,
  GoogleIndexDetailedReason,
} from "./types";
import { buildKnownUrlUniverse, UrlUniverseInput } from "./inventory";
import { parseGscUrlInspectionPayload } from "./provider/gsc-url-inspection";
import { computeIndexCoverageMatrix } from "./matrix-engine";
import { evaluateImportantIndexCoverage } from "./coverage-evaluator";
import { evaluateCanonicalSelectionIntelligence } from "./canonical-intelligence";
import { detectUnexpectedIndexExpansion } from "./expansion-detector";
import { createIndexationSnapshot } from "./snapshots";
import { generateIndexationActionItems } from "./phase-integrators";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeIndexationParams {
  projectId: string;
  universeInputs: UrlUniverseInput;
  inspectionPayloads?: RawGoogleInspectionPayload[];
  knownUrlMetadata?: Map<
    string,
    {
      isImportant?: boolean;
      importanceReasons?: string[];
      pageType?: string;
      technicalIndexability?: "INDEXABLE" | "NON_INDEXABLE" | "UNKNOWN";
      technicalDirectives?: IndexationEvidenceRecord["technicalDirectives"];
      serverLogCrawlCount?: number;
      lastServerLogCrawlAt?: string;
      gscImpressions28d?: number;
      gscClicks28d?: number;
      backlinksCount?: number;
    }
  >;
  providerCapability?: ProviderCapabilityState;
  samplingMode?: InspectionSamplingMode;
  migrationData?: {
    migrationId: string;
    oldUrls: string[];
    newUrls: string[];
  };
  internationalData?: Record<string, string[]>; // locale -> urls
  localData?: { branchUrls: string[] };
}

export async function analyzeIndexationIntelligence(params: AnalyzeIndexationParams): Promise<{
  report: GoogleIndexationIntelligenceReport;
  snapshot: IndexationSnapshot;
  actions: SeoActionItem[];
  records: IndexationEvidenceRecord[];
}> {
  const providerCapability: ProviderCapabilityState = params.providerCapability || "AVAILABLE";
  const samplingMode: InspectionSamplingMode = params.samplingMode || "FULL_COVERAGE";

  // 1. Build Known URL Universe
  const { allNormalizedUrls, summary: universeSummary } = buildKnownUrlUniverse(params.universeInputs);

  // 2. Parse / Normalize Inspection Evidence Records
  const payloadMap = new Map<string, RawGoogleInspectionPayload>();
  if (params.inspectionPayloads) {
    for (const p of params.inspectionPayloads) {
      payloadMap.set(p.inspectionUrl.trim().toLowerCase().replace(/\/$/, ""), p);
    }
  }

  const records: IndexationEvidenceRecord[] = [];
  let freshCount = 0;
  let agingCount = 0;
  let staleCount = 0;

  for (const normUrl of allNormalizedUrls) {
    const meta = params.knownUrlMetadata?.get(normUrl);
    const payload = payloadMap.get(normUrl);

    if (payload) {
      const rec = parseGscUrlInspectionPayload({
        projectId: params.projectId,
        payload,
        technicalIndexability: meta?.technicalIndexability || "UNKNOWN",
        technicalDirectives: meta?.technicalDirectives,
        isImportant: meta?.isImportant,
        importanceReasons: meta?.importanceReasons,
        pageType: meta?.pageType,
        serverLogCrawlCount: meta?.serverLogCrawlCount,
        lastServerLogCrawlAt: meta?.lastServerLogCrawlAt,
        gscImpressions28d: meta?.gscImpressions28d,
        gscClicks28d: meta?.gscClicks28d,
        backlinksCount: meta?.backlinksCount,
      });

      records.push(rec);
      if (rec.evidenceFreshness === "FRESH") freshCount++;
      else if (rec.evidenceFreshness === "AGING") agingCount++;
      else if (rec.evidenceFreshness === "STALE") staleCount++;
    } else {
      // Record without inspection payload (UNKNOWN index state)
      records.push({
        projectId: params.projectId,
        url: normUrl,
        normalizedUrl: normUrl,
        pageType: meta?.pageType,
        isImportant: meta?.isImportant ?? false,
        importanceReasons: meta?.importanceReasons || [],
        evaluatedAt: new Date().toISOString(),
        technicalIndexability: meta?.technicalIndexability || "UNKNOWN",
        technicalDirectives: meta?.technicalDirectives,
        googleIndexState: "UNKNOWN",
        googleDetailedReason: "UNKNOWN",
        canonicalAlignment: "GOOGLE_CANONICAL_UNKNOWN",
        serverLogCrawlCount: meta?.serverLogCrawlCount,
        lastServerLogCrawlAt: meta?.lastServerLogCrawlAt,
        gscImpressions28d: meta?.gscImpressions28d,
        gscClicks28d: meta?.gscClicks28d,
        backlinksCount: meta?.backlinksCount,
        rootCauseCategory: "CAUSE_UNKNOWN",
        rootCauseDetails: ["No Google URL inspection payload available for this URL."],
        evidenceSource: "UNKNOWN",
        evidenceFreshness: "UNKNOWN",
        confidence: "UNKNOWN",
        mapperVersion: "1.0.0",
      });
    }
  }

  // 3. Matrix Distribution
  const matrixDistribution = computeIndexCoverageMatrix(records, universeSummary.totalKnownUrls);

  // 4. Important Page Coverage
  const importantCoverage = evaluateImportantIndexCoverage(records);

  // 5. Canonical Selection Intelligence
  const canonicalIntelligence = evaluateCanonicalSelectionIntelligence(records);

  // 6. Unexpected Index Expansion
  const expansionIntelligence = detectUnexpectedIndexExpansion(records);

  // 7. Breakdown of Not-Indexed Reasons
  const reasonBreakdown: Record<GoogleIndexDetailedReason, number> = {
    CRAWLED_CURRENTLY_NOT_INDEXED: 0,
    DISCOVERED_CURRENTLY_NOT_INDEXED: 0,
    DUPLICATE_GOOGLE_CHOSE_DIFFERENT_CANONICAL: 0,
    ALTERNATE_PAGE_WITH_CANONICAL: 0,
    EXCLUDED_BY_NOINDEX: 0,
    BLOCKED_BY_ROBOTS: 0,
    REDIRECT: 0,
    NOT_FOUND_404: 0,
    SOFT_404: 0,
    SERVER_ERROR: 0,
    DUPLICATE_WITHOUT_SELECTED_CANONICAL: 0,
    UNKNOWN_TO_GOOGLE: 0,
    INDEXED: 0,
    OTHER_PROVIDER_STATE: 0,
    UNKNOWN: 0,
  };

  for (const r of records) {
    if (r.googleDetailedReason) {
      reasonBreakdown[r.googleDetailedReason] = (reasonBreakdown[r.googleDetailedReason] || 0) + 1;
    }
  }

  // 8. Sitemap Index Coverage
  const sitemapUrlsTotal = params.universeInputs.sitemapUrls?.length || 0;
  let sitemapIndexed = 0;
  let sitemapNotIndexed = 0;
  let sitemapNonIndexable = 0;

  if (params.universeInputs.sitemapUrls) {
    const sitemapSet = new Set(params.universeInputs.sitemapUrls.map((u) => u.trim().toLowerCase().replace(/\/$/, "")));
    for (const r of records) {
      if (sitemapSet.has(r.normalizedUrl)) {
        if (r.googleIndexState === "INDEXED") sitemapIndexed++;
        else if (r.googleIndexState === "NOT_INDEXED") sitemapNotIndexed++;
        if (r.technicalIndexability === "NON_INDEXABLE") sitemapNonIndexable++;
      }
    }
  }

  const sitemapRatio = sitemapUrlsTotal > 0 ? Math.round((sitemapIndexed / sitemapUrlsTotal) * 100) : 100;

  // 9. Freshness Percentages
  const totalInspected = records.filter((r) => r.googleIndexState !== "UNKNOWN").length;
  const freshPct = totalInspected > 0 ? Math.round((freshCount / totalInspected) * 100) : 0;
  const agingPct = totalInspected > 0 ? Math.round((agingCount / totalInspected) * 100) : 0;
  const stalePct = totalInspected > 0 ? Math.round((staleCount / totalInspected) * 100) : 0;

  // 10. Migration Intelligence Integration
  let migrationIndexTransition: GoogleIndexationIntelligenceReport["migrationIndexTransition"];
  if (params.migrationData) {
    let oldIndexed = 0;
    let newIndexed = 0;
    const oldSet = new Set(params.migrationData.oldUrls.map((u) => u.trim().toLowerCase().replace(/\/$/, "")));
    const newSet = new Set(params.migrationData.newUrls.map((u) => u.trim().toLowerCase().replace(/\/$/, "")));

    for (const r of records) {
      if (oldSet.has(r.normalizedUrl) && r.googleIndexState === "INDEXED") oldIndexed++;
      if (newSet.has(r.normalizedUrl) && r.googleIndexState === "INDEXED") newIndexed++;
    }

    let transitionState: GoogleIndexationIntelligenceReport["migrationIndexTransition"]["transitionState"] = "TRANSITION_IN_PROGRESS";
    if (newIndexed === params.migrationData.newUrls.length && oldIndexed === 0) {
      transitionState = "NEW_TARGET_INDEXED";
    } else if (newIndexed === 0) {
      transitionState = "NEW_TARGET_NOT_INDEXED_REVIEW";
    }

    migrationIndexTransition = {
      migrationId: params.migrationData.migrationId,
      oldUrlsStillIndexedCount: oldIndexed,
      newDestinationsIndexedCount: newIndexed,
      transitionState,
    };
  }

  // 11. Actions Emission
  const actions = generateIndexationActionItems({ records, projectId: params.projectId });

  // 12. Snapshot Construction
  const snapshot = createIndexationSnapshot({
    snapshotId: `snap_idx_${params.projectId}_${Date.now()}`,
    projectId: params.projectId,
    knownUrlUniverseSummary: universeSummary,
    providerCapability,
    inspectionSamplingMode: samplingMode,
    inspectionEligibleCount: universeSummary.totalKnownUrls,
    inspectedCount: totalInspected,
    evidenceFreshnessBreakdown: { freshPercent: freshPct, agingPercent: agingPct, stalePercent: stalePct },
    matrixDistribution,
  });

  // 13. Assemble Master Report
  const report: GoogleIndexationIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    evidenceQuality: {
      providerCapability,
      inspectionSamplingMode: samplingMode,
      eligibleUrlsCount: universeSummary.totalKnownUrls,
      inspectedUrlsCount: totalInspected,
      coveragePercentage: universeSummary.totalKnownUrls > 0 ? Math.round((totalInspected / universeSummary.totalKnownUrls) * 100) : 0,
      freshnessBreakdown: { freshPercent: freshPct, agingPercent: agingPct, stalePercent: stalePct },
      interpretationConfidence: providerCapability === "AVAILABLE" && totalInspected > 0 ? "HIGH" : "MODERATE",
    },
    knownUrlUniverse: universeSummary,
    matrixDistribution,
    importantPageCoverage: importantCoverage,
    notIndexedReasonBreakdown: reasonBreakdown,
    canonicalSelectionIntelligence: canonicalIntelligence,
    sitemapIndexCoverage: {
      sitemapUrlsTotal,
      sitemapIndexedCount: sitemapIndexed,
      sitemapNotIndexedCount: sitemapNotIndexed,
      sitemapNonIndexableCount: sitemapNonIndexable,
      sitemapCoveragePercentage: sitemapRatio,
      breakdownBySitemap: {},
    },
    unexpectedIndexExpansion: expansionIntelligence,
    serverLogCorrelations: {
      crawledRepeatedlyButNotIndexedCount: records.filter((r) => (r.serverLogCrawlCount || 0) > 3 && r.googleIndexState === "NOT_INDEXED").length,
      notObservedInLogsButIndexedCount: records.filter((r) => (r.serverLogCrawlCount || 0) === 0 && r.googleIndexState === "INDEXED").length,
      summary: "Server log activity correlates crawl requests with Google inspection decisions.",
    },
    gscCorrelations: {
      indexedWithZeroImpressionsCount: records.filter((r) => r.googleIndexState === "INDEXED" && (r.gscImpressions28d || 0) === 0).length,
      impressionsWithUnknownInspectionStateCount: records.filter((r) => r.googleIndexState === "UNKNOWN" && (r.gscImpressions28d || 0) > 0).length,
      summary: "GSC performance evidence and inspection state represent independent dimensions.",
    },
    migrationIndexTransition,
    systemicPatterns: [],
    governanceLimitations: [
      "URL Inspection API evidence reflects Google's reported state at the timestamp of inspection.",
      "Technical indexability is distinct from Google's algorithmic indexation decisions.",
      "Absence of inspection evidence is reported as UNKNOWN and must never be interpreted as NOT_INDEXED.",
      "Google's selection of a different canonical is an algorithmic signal and not automatically a technical defect.",
    ],
    immutabilityStatement: "Immutability Guarantee: Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  return {
    report,
    snapshot,
    actions,
    records,
  };
}
