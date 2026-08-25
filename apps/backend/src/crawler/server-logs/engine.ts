/**
 * Master Coordinator for Phase 18 Server Log / Crawl Budget / Search Bot Behavior Intelligence.
 * Orchestrates ingestion, authoritative bot classification, coverage evaluation, pattern detection, and Phase 11 actions.
 */

import {
  SeoServerLogEvent,
  ServerLogIntelligenceReport,
  CrawlBehaviorSnapshot,
  LogDatasetCompleteness,
  AdapterSupportState,
} from "./types";
import { DEFAULT_LOG_POLICY, LogIntelligencePolicy } from "./config";
import { parseLogLines, getAdapterSupportState } from "./adapters";
import { computeUrlCrawlMetrics } from "./crawl-metrics";
import { evaluateImportantPageCoverage, evaluateCrawlBudgetMateriality } from "./coverage-engine";
import { detectCrawlPatterns } from "./pattern-detector";
import { createLogAnalysisSnapshot } from "./snapshots";
import { bridgeServerLogOpportunitiesToPhase11 } from "./phase-integrators";
import { GOOGLEBOT_OFFICIAL_DATASET } from "./bot-ranges";
import { SeoActionItem } from "../opportunity/types";

export interface AnalyzeServerLogsParams {
  projectId: string;
  defaultHost: string;
  logLines?: string[];
  parsedEvents?: SeoServerLogEvent[];
  provider?: "NGINX_APACHE" | "CLOUDFLARE" | "VERCEL" | "STRUCTURED_JSON" | "CSV" | "TSV" | "AWS_CLOUDFRONT" | "AWS_ALB" | "AUTO";
  knownUrls?: Array<{ url: string; isIndexable?: boolean; isImportant?: boolean; importanceReasons?: string[]; pageType?: string }>;
  gscQueriesPerUrl?: Map<string, number>;
  migrationData?: { migrationId: string; legacyUrls: string[]; destinationUrls: string[] };
  isPartialDataset?: boolean;
  existingActions?: SeoActionItem[];
  policy?: LogIntelligencePolicy;
}

export interface AnalyzeServerLogsResult {
  report: ServerLogIntelligenceReport;
  snapshot: CrawlBehaviorSnapshot;
  actions: SeoActionItem[];
}

export async function analyzeServerLogIntelligence(
  params: AnalyzeServerLogsParams
): Promise<AnalyzeServerLogsResult> {
  const policy = params.policy || DEFAULT_LOG_POLICY;
  const provider = params.provider || "AUTO";
  const adapterSupportState = getAdapterSupportState(provider);

  // 1. Ingest / Parse Events
  let events: SeoServerLogEvent[] = [];
  let totalParsed = 0;
  let totalRejected = 0;
  let rejectionRate = 0;
  let rejectionReasons: Record<string, number> = {};
  let completeness: LogDatasetCompleteness = "COMPLETE";

  if (params.parsedEvents) {
    events = params.parsedEvents;
    totalParsed = events.length;
  } else if (params.logLines) {
    const ingestion = parseLogLines({
      lines: params.logLines,
      provider,
      projectId: params.projectId,
      defaultHost: params.defaultHost,
      isPartialDataset: params.isPartialDataset,
    });
    events = ingestion.events;
    totalParsed = ingestion.totalParsed;
    totalRejected = ingestion.totalRejected;
    rejectionRate = ingestion.rejectionRatePercent;
    rejectionReasons = ingestion.rejectionReasons;
    completeness = ingestion.completeness;
  }

  // 2. Aggregate Metrics
  const metricsMap = computeUrlCrawlMetrics({
    events,
    knownUrls: params.knownUrls,
    completeness,
    policy,
  });

  // 3. Evaluate Important Page Coverage
  const coverageRes = evaluateImportantPageCoverage(metricsMap, completeness);

  // 4. Detect Crawl Patterns (Facets, Crawl Traps, 5xx Bursts)
  const patternRes = detectCrawlPatterns({
    events,
    gscQueriesPerUrl: params.gscQueriesPerUrl,
    policy,
  });

  // 5. Evaluate Budget Materiality
  const budgetMat = evaluateCrawlBudgetMateriality({
    totalKnownUrls: (params.knownUrls || []).length || metricsMap.size,
    totalObservedRequests: events.length,
    facetVariantCount: patternRes.facetPatterns.reduce((acc, f) => acc + f.variantCount, 0),
    completeness,
    policy,
  });

  // 6. Bot Overview Breakdown
  const googlebotEvents = events.filter((e) => e.botIdentity.family === "GOOGLEBOT");
  const verifiedGooglebot = googlebotEvents.filter((e) => e.botIdentity.isVerifiedSearchBot);
  const bingbotEvents = events.filter((e) => e.botIdentity.family === "BINGBOT");

  const gptBotTraining = events.filter((e) => e.botIdentity.family === "GPTBOT");
  const oaiSearchBot = events.filter((e) => e.botIdentity.family === "OAI_SEARCHBOT");
  const chatGptUser = events.filter((e) => e.botIdentity.family === "CHATGPT_USER");
  const claudeBot = events.filter((e) => e.botIdentity.family === "CLAUDEBOT");
  const perplexityBot = events.filter((e) => e.botIdentity.family === "PERPLEXITYBOT");

  const verifiedRangeCount = events.filter((e) => e.botIdentity.verificationState === "VERIFIED_PROVIDER_RANGE").length;
  const verifiedDnsCount = events.filter((e) => e.botIdentity.verificationState === "VERIFIED_FORWARD_REVERSE_DNS").length;
  const uaOnlyCount = events.filter((e) => e.botIdentity.verificationState === "USER_AGENT_ONLY").length;
  const staleRangeCount = events.filter((e) => e.botIdentity.verificationState === "PROVIDER_RANGE_STALE").length;
  const spoofedCount = events.filter((e) => e.botIdentity.verificationState === "SPOOFED_OR_INVALID").length;

  const totalBots = events.length;
  const verifiedProviderRangePercent = totalBots > 0 ? Math.round((verifiedRangeCount / totalBots) * 100) : 0;
  const verifiedDnsPercent = totalBots > 0 ? Math.round((verifiedDnsCount / totalBots) * 100) : 0;
  const uaOnlyPercent = totalBots > 0 ? Math.round((uaOnlyCount / totalBots) * 100) : 0;
  const staleRangePercent = totalBots > 0 ? Math.round((staleRangeCount / totalBots) * 100) : 0;
  const spoofedPercent = totalBots > 0 ? Math.round((spoofedCount / totalBots) * 100) : 0;

  // 7. HTML Status Distribution for Verified Googlebot
  const googlebotHtml = verifiedGooglebot.filter((e) => e.resourceType === "HTML_DOCUMENT");
  const totalGHtml = googlebotHtml.length;

  const count200 = googlebotHtml.filter((e) => e.statusCode === 200).length;
  const count3xx = googlebotHtml.filter((e) => e.statusCode >= 300 && e.statusCode < 400).length;
  const count4xx = googlebotHtml.filter((e) => e.statusCode >= 400 && e.statusCode < 500).length;
  const count5xx = googlebotHtml.filter((e) => e.statusCode >= 500 && e.statusCode < 600).length;

  const status200IndexablePercent = totalGHtml > 0 ? Math.round((count200 / totalGHtml) * 100) : 0;
  const redirect3xxPercent = totalGHtml > 0 ? Math.round((count3xx / totalGHtml) * 100) : 0;
  const clientError4xxPercent = totalGHtml > 0 ? Math.round((count4xx / totalGHtml) * 100) : 0;
  const serverError5xxPercent = totalGHtml > 0 ? Math.round((count5xx / totalGHtml) * 100) : 0;

  // Latency samples
  const latencies = events.map((e) => e.responseTimeMs).filter((t): t is number => t !== undefined).sort((a, b) => a - b);
  const medianMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : undefined;
  const p75Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.75)] : undefined;
  const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : undefined;

  // 8. Migration Crawl Integration
  let migrationIntegration: ServerLogIntelligenceReport["migrationIntelligenceIntegration"];
  if (params.migrationData) {
    const legacySet = new Set(params.migrationData.legacyUrls);
    const destSet = new Set(params.migrationData.destinationUrls);

    const legacyEvents = events.filter((e) => legacySet.has(e.normalizedUrl));
    const destEvents = events.filter((e) => destSet.has(e.normalizedUrl));
    const legacy301 = legacyEvents.filter((e) => e.statusCode === 301 || e.statusCode === 308).length;

    migrationIntegration = {
      migrationId: params.migrationData.migrationId,
      legacyUrlsStillCrawledCount: legacyEvents.length,
      legacyUrlsHealthyRedirectPercent: legacyEvents.length > 0 ? Math.round((legacy301 / legacyEvents.length) * 100) : 100,
      newDestinationDiscoveryCount: destEvents.length,
    };
  }

  // 9. Bridge Actions to Phase 11
  const actions = bridgeServerLogOpportunitiesToPhase11({
    projectId: params.projectId,
    errorBursts: patternRes.errorBursts,
    facetPatterns: patternRes.facetPatterns,
    unobservedImportantUrls: coverageRes.unobservedImportantPages.map((u) => u.url),
    existingActions: params.existingActions,
  });

  // 10. Dates
  const timestamps = events.map((e) => e.timestamp).sort();
  const periodStart = timestamps[0] || new Date().toISOString();
  const periodEnd = timestamps[timestamps.length - 1] || new Date().toISOString();

  // 11. Snapshot
  const snapshotId = `SNAP_LOG_${params.projectId}_${Date.now().toString(36)}`;
  const snapshot = createLogAnalysisSnapshot({
    snapshotId,
    projectId: params.projectId,
    datasetStart: periodStart,
    datasetEnd: periodEnd,
    completeness,
    totalLogLinesParsed: totalParsed,
    totalRejectedEvents: totalRejected,
    rejectionReasons,
    totalBotRequests: events.length,
    verifiedGooglebotHtmlRequests: googlebotHtml.length,
    uniqueUrlsRequestedCount: metricsMap.size,
    crawlBudgetMateriality: budgetMat.materiality,
    policyVersion: policy.policyName,
  });

  let interpretationConfidence: ServerLogIntelligenceReport["datasetQuality"]["interpretationConfidence"] = "HIGH";
  if (completeness === "INVALID" || completeness === "UNKNOWN") {
    interpretationConfidence = "INCONCLUSIVE";
  } else if (completeness === "PARTIAL" || verifiedRangeCount + verifiedDnsCount < totalBots * 0.5) {
    interpretationConfidence = "MODERATE";
  }

  const report: ServerLogIntelligenceReport = {
    generatedAt: new Date().toISOString(),
    projectId: params.projectId,
    datasetQuality: {
      periodStart,
      periodEnd,
      sourceProvider: provider,
      adapterSupportState,
      completeness,
      totalEventsParsed: totalParsed,
      rejectedEventsCount: totalRejected,
      rejectionRatePercent: rejectionRate,
      rejectionReasons,
      botVerificationBreakdown: {
        verifiedProviderRangePercent,
        verifiedDnsPercent,
        userAgentOnlyPercent: uaOnlyPercent,
        staleRangePercent,
        spoofedPercent,
      },
      rangeDatasetMetadata: {
        provider: GOOGLEBOT_OFFICIAL_DATASET.provider,
        sourceUrl: GOOGLEBOT_OFFICIAL_DATASET.sourceUrl,
        retrievedAt: GOOGLEBOT_OFFICIAL_DATASET.retrievedAt,
        datasetVersionOrHash: GOOGLEBOT_OFFICIAL_DATASET.datasetVersionOrHash,
        freshness: GOOGLEBOT_OFFICIAL_DATASET.freshness,
        verifierVersion: GOOGLEBOT_OFFICIAL_DATASET.verifierVersion,
        rangesCount: GOOGLEBOT_OFFICIAL_DATASET.prefixes.length,
      },
      interpretationConfidence,
    },
    botOverview: {
      totalBotRequests: events.length,
      verifiedGooglebotRequests: verifiedGooglebot.length,
      googlebotSmartphoneRequests: verifiedGooglebot.filter((e) => e.botIdentity.deviceType === "SMARTPHONE").length,
      googlebotDesktopRequests: verifiedGooglebot.filter((e) => e.botIdentity.deviceType === "DESKTOP").length,
      googlebotImageRequests: events.filter((e) => e.botIdentity.name === "Googlebot Image" || e.botIdentity.deviceType === "IMAGE").length,
      bingbotRequests: bingbotEvents.length,
      aiCrawlerRequests: {
        gptBotTrainingRequests: gptBotTraining.length,
        oaiSearchBotSearchRequests: oaiSearchBot.length,
        chatGptUserFetchRequests: chatGptUser.length,
        claudeBotRequests: claudeBot.length,
        perplexityBotRequests: perplexityBot.length,
      },
      otherBotRequests: events.filter((e) => e.botIdentity.family === "UNKNOWN_BOT").length,
      spoofedRequestsBlockedOrFlagged: spoofedCount,
    },
    importantPageCoverage: coverageRes,
    crawlEfficiency: {
      materiality: budgetMat.materiality,
      materialityPolicySelected: budgetMat.policySelected,
      materialityRationale: budgetMat.rationale,
      htmlStatusDistribution: {
        status200IndexablePercent,
        status200NonIndexablePercent: 0,
        redirect3xxPercent,
        clientError4xxPercent,
        serverError5xxPercent,
      },
      redirectConcentration: {
        totalRedirectRequests: count3xx,
        topRedirectingUrls: [],
      },
      errorConcentration: {
        total404Requests: events.filter((e) => e.statusCode === 404).length,
        total410Requests: events.filter((e) => e.statusCode === 410).length,
        total5xxRequests: events.filter((e) => e.statusCode >= 500 && e.statusCode < 600).length,
        errorBurstsDetected: patternRes.errorBursts,
      },
      parameterAndFacetExpansion: {
        facetPatternsDetected: patternRes.facetPatterns,
        potentialCrawlTraps: patternRes.crawlTraps,
      },
      originLatency: {
        sampleCount: latencies.length,
        medianMs,
        p75Ms,
        p95Ms,
        disclaimer: "Origin latency reflects backend server response time, which is strictly separate from browser Core Web Vitals (CWV).",
      },
    },
    migrationIntelligenceIntegration: migrationIntegration,
    governanceLimitations: [
      "Server logs reflect requests reaching infrastructure; absence from logs is bounded by the evaluated period and retention.",
      "Crawl frequency does not directly determine search engine ranking or indexing state.",
      "User-Agent strings alone are classified as USER_AGENT_ONLY unless validated by reverse DNS or published provider IP ranges.",
      "Server log response latency reflects origin response duration, which is distinct from browser Core Web Vitals.",
    ],
    immutabilityStatement: "Snapshot immutability is guaranteed at runtime via Object.freeze.",
  };

  return {
    report,
    snapshot,
    actions,
  };
}
