/**
 * GSC Analytics & Opportunity Intelligence Engine
 * Aggregates Search Console metrics, detects material declines with volume safeguards,
 * discovers high-impression/low-CTR and near-page-one ranking opportunities.
 * Strictly avoids multiplying metrics when multi-dimensional rows (query/device/date) are present.
 */

import { CrawledPageData } from "../types";
import {
  DateWindowMetrics,
  GscAuthMode,
  GscDeclineFinding,
  GscOpportunityFinding,
  GscSearchAnalyticsRow,
  GscTelemetry,
  MetricDelta,
  PageGscMetrics,
  QueryGscMetrics,
} from "./types";
import { GSC_POLICY_THRESHOLDS, getHeuristicCtrBenchmark } from "./thresholds";
import { matchGscUrlToCrawl } from "./matcher";

export interface GscAnalysisInput {
  currentRows: GscSearchAnalyticsRow[];
  comparisonRows?: GscSearchAnalyticsRow[];
  crawledPages: CrawledPageData[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  isCurrentPeriodComplete?: boolean;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
  isComparisonPeriodComplete?: boolean;
  authMode?: GscAuthMode;
}

export interface GscAnalysisResult {
  pages: PageGscMetrics[];
  queries: QueryGscMetrics[];
  declines: GscDeclineFinding[];
  opportunities: GscOpportunityFinding[];
  unmatchedGscUrls: Array<{
    gscUrl: string;
    clicks: number;
    impressions: number;
    likelyReason: string;
  }>;
  crawledPagesWithoutGsc: Array<{
    url: string;
    reason: string;
  }>;
  organicOverview: {
    currentPeriod: DateWindowMetrics;
    comparisonPeriod?: DateWindowMetrics;
    clicksDelta?: MetricDelta;
    impressionsDelta?: MetricDelta;
    ctrDelta?: MetricDelta;
    positionDelta?: MetricDelta;
  };
  telemetry: GscTelemetry;
}

function computeDelta(current: number, previous: number): MetricDelta {
  const delta = current - previous;
  const percentChange = previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : undefined;
  return {
    current,
    previous,
    delta,
    percentChange,
  };
}

function calculateDaysDifference(startStr: string, endStr: string): number {
  try {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  } catch {
    return 28;
  }
}

export function analyzeGscData(input: GscAnalysisInput): GscAnalysisResult {
  const {
    currentRows,
    comparisonRows = [],
    crawledPages,
    currentPeriodStart,
    currentPeriodEnd,
    isCurrentPeriodComplete = true,
    comparisonPeriodStart = "",
    comparisonPeriodEnd = "",
    isComparisonPeriodComplete = true,
    authMode = "NOT_CONFIGURED",
  } = input;

  const currentDays = calculateDaysDifference(currentPeriodStart, currentPeriodEnd);
  const comparisonDays = comparisonPeriodStart ? calculateDaysDifference(comparisonPeriodStart, comparisonPeriodEnd) : 0;

  // 1. Group Current Rows by Page and Query (avoiding double-counting multi-dimensional queries/devices)
  const currentPageMap = new Map<string, { clicks: number; impressions: number; weightedPos: number; queries: Map<string, GscSearchAnalyticsRow> }>();
  const currentQueryMap = new Map<string, { clicks: number; impressions: number; weightedPos: number; pages: Set<string> }>();

  let totalCurrentClicks = 0;
  let totalCurrentImpressions = 0;
  let totalCurrentWeightedPos = 0;

  for (const r of currentRows) {
    totalCurrentClicks += r.clicks;
    totalCurrentImpressions += r.impressions;
    totalCurrentWeightedPos += r.position * r.impressions;

    if (r.page) {
      if (!currentPageMap.has(r.page)) {
        currentPageMap.set(r.page, { clicks: 0, impressions: 0, weightedPos: 0, queries: new Map() });
      }
      const pEntry = currentPageMap.get(r.page)!;
      pEntry.clicks += r.clicks;
      pEntry.impressions += r.impressions;
      pEntry.weightedPos += r.position * r.impressions;
      if (r.query) {
        pEntry.queries.set(r.query, r);
      }
    }

    if (r.query) {
      if (!currentQueryMap.has(r.query)) {
        currentQueryMap.set(r.query, { clicks: 0, impressions: 0, weightedPos: 0, pages: new Set() });
      }
      const qEntry = currentQueryMap.get(r.query)!;
      qEntry.clicks += r.clicks;
      qEntry.impressions += r.impressions;
      qEntry.weightedPos += r.position * r.impressions;
      if (r.page) {
        qEntry.pages.add(r.page);
      }
    }
  }

  // 2. Group Comparison Rows by Page and Query
  const prevPageMap = new Map<string, { clicks: number; impressions: number; weightedPos: number }>();
  const prevQueryMap = new Map<string, { clicks: number; impressions: number; weightedPos: number }>();

  let totalPrevClicks = 0;
  let totalPrevImpressions = 0;
  let totalPrevWeightedPos = 0;

  for (const r of comparisonRows) {
    totalPrevClicks += r.clicks;
    totalPrevImpressions += r.impressions;
    totalPrevWeightedPos += r.position * r.impressions;

    if (r.page) {
      if (!prevPageMap.has(r.page)) {
        prevPageMap.set(r.page, { clicks: 0, impressions: 0, weightedPos: 0 });
      }
      const pEntry = prevPageMap.get(r.page)!;
      pEntry.clicks += r.clicks;
      pEntry.impressions += r.impressions;
      pEntry.weightedPos += r.position * r.impressions;
    }

    if (r.query) {
      if (!prevQueryMap.has(r.query)) {
        prevQueryMap.set(r.query, { clicks: 0, impressions: 0, weightedPos: 0 });
      }
      const qEntry = prevQueryMap.get(r.query)!;
      qEntry.clicks += r.clicks;
      qEntry.impressions += r.impressions;
      qEntry.weightedPos += r.position * r.impressions;
    }
  }

  // 3. Build Page GSC Metrics & Match against Crawl
  const pages: PageGscMetrics[] = [];
  const unmatchedGscUrls: GscAnalysisResult["unmatchedGscUrls"] = [];
  const matchedCrawlUrls = new Set<string>();

  for (const [gscUrl, curr] of currentPageMap.entries()) {
    const match = matchGscUrlToCrawl(gscUrl, crawledPages);
    const prev = prevPageMap.get(gscUrl);

    const currentMetrics: DateWindowMetrics = {
      clicks: curr.clicks,
      impressions: curr.impressions,
      ctr: curr.impressions > 0 ? curr.clicks / curr.impressions : 0,
      averagePosition: curr.impressions > 0 ? Math.round((curr.weightedPos / curr.impressions) * 10) / 10 : 0,
      isComplete: isCurrentPeriodComplete,
      daysCount: currentDays,
    };

    let compMetrics: DateWindowMetrics | undefined;
    let clicksDelta: MetricDelta | undefined;
    let impressionsDelta: MetricDelta | undefined;
    let ctrDelta: MetricDelta | undefined;
    let positionDelta: MetricDelta | undefined;

    if (prev) {
      compMetrics = {
        clicks: prev.clicks,
        impressions: prev.impressions,
        ctr: prev.impressions > 0 ? prev.clicks / prev.impressions : 0,
        averagePosition: prev.impressions > 0 ? Math.round((prev.weightedPos / prev.impressions) * 10) / 10 : 0,
        isComplete: isComparisonPeriodComplete,
        daysCount: comparisonDays,
      };

      clicksDelta = computeDelta(currentMetrics.clicks, compMetrics.clicks);
      impressionsDelta = computeDelta(currentMetrics.impressions, compMetrics.impressions);
      ctrDelta = computeDelta(currentMetrics.ctr, compMetrics.ctr);
      positionDelta = computeDelta(currentMetrics.averagePosition, compMetrics.averagePosition);
    }

    // Top queries for this page
    const topQueries: QueryGscMetrics[] = Array.from(curr.queries.values())
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .map((q) => ({
        query: q.query || "",
        currentPeriod: {
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          averagePosition: q.position,
          isComplete: isCurrentPeriodComplete,
          daysCount: currentDays,
        },
        associatedPages: [gscUrl],
      }));

    if (match.matchedCrawlUrl) {
      matchedCrawlUrls.add(match.matchedCrawlUrl);
    } else {
      unmatchedGscUrls.push({
        gscUrl,
        clicks: curr.clicks,
        impressions: curr.impressions,
        likelyReason: match.explanation,
      });
    }

    // Period completeness check
    const isPeriodIncomplete = !isCurrentPeriodComplete || !isComparisonPeriodComplete || currentDays < GSC_POLICY_THRESHOLDS.PAGE_DECLINE.minPeriodDays;

    // Determine flags
    const isDeclining = Boolean(
      !isPeriodIncomplete &&
        compMetrics &&
        compMetrics.impressions >= GSC_POLICY_THRESHOLDS.PAGE_DECLINE.minPreviousImpressions &&
        ((clicksDelta && clicksDelta.percentChange && clicksDelta.percentChange <= -GSC_POLICY_THRESHOLDS.PAGE_DECLINE.materialClickDropPercent) ||
          (impressionsDelta && impressionsDelta.percentChange && impressionsDelta.percentChange <= -GSC_POLICY_THRESHOLDS.PAGE_DECLINE.materialImpressionDropPercent))
    );

    const heuristicBenchmark = getHeuristicCtrBenchmark(currentMetrics.averagePosition);
    const hasCtrOpportunity =
      currentMetrics.impressions >= GSC_POLICY_THRESHOLDS.CTR_OPPORTUNITY_BENCHMARK.minImpressions &&
      currentMetrics.averagePosition <= GSC_POLICY_THRESHOLDS.CTR_OPPORTUNITY_BENCHMARK.strikingDistanceMax &&
      currentMetrics.ctr < heuristicBenchmark * 0.6; // CTR is 40%+ below heuristic benchmark

    const hasRankingOpportunity =
      currentMetrics.impressions >= GSC_POLICY_THRESHOLDS.RANKING_OPPORTUNITY.nearPageOne.minImpressions &&
      currentMetrics.averagePosition >= GSC_POLICY_THRESHOLDS.RANKING_OPPORTUNITY.nearPageOne.minPosition &&
      currentMetrics.averagePosition <= GSC_POLICY_THRESHOLDS.RANKING_OPPORTUNITY.strikingDistance.maxPosition;

    pages.push({
      gscUrl,
      normalizedGscUrl: match.normalizedGscUrl,
      matchedCrawlUrl: match.matchedCrawlUrl,
      matchMethod: match.matchMethod,
      matchConfidence: match.matchConfidence,
      currentPeriod: currentMetrics,
      comparisonPeriod: compMetrics,
      clicksDelta,
      impressionsDelta,
      ctrDelta,
      positionDelta,
      topQueries,
      isDeclining,
      isTrendInconclusive: isPeriodIncomplete,
      trendInconclusiveReason: isPeriodIncomplete ? "Evaluation period is incomplete or has reporting latency gaps (< 14 days)." : undefined,
      hasCtrOpportunity,
      hasRankingOpportunity,
    });
  }

  // 4. Build Query GSC Metrics
  const queries: QueryGscMetrics[] = [];
  for (const [query, curr] of currentQueryMap.entries()) {
    const prev = prevQueryMap.get(query);
    const currentMetrics: DateWindowMetrics = {
      clicks: curr.clicks,
      impressions: curr.impressions,
      ctr: curr.impressions > 0 ? curr.clicks / curr.impressions : 0,
      averagePosition: curr.impressions > 0 ? Math.round((curr.weightedPos / curr.impressions) * 10) / 10 : 0,
      isComplete: isCurrentPeriodComplete,
      daysCount: currentDays,
    };

    let compMetrics: DateWindowMetrics | undefined;
    let clicksDelta: MetricDelta | undefined;
    let impressionsDelta: MetricDelta | undefined;
    let positionDelta: MetricDelta | undefined;

    if (prev) {
      compMetrics = {
        clicks: prev.clicks,
        impressions: prev.impressions,
        ctr: prev.impressions > 0 ? prev.clicks / prev.impressions : 0,
        averagePosition: prev.impressions > 0 ? Math.round((prev.weightedPos / prev.impressions) * 10) / 10 : 0,
        isComplete: isComparisonPeriodComplete,
        daysCount: comparisonDays,
      };

      clicksDelta = computeDelta(currentMetrics.clicks, compMetrics.clicks);
      impressionsDelta = computeDelta(currentMetrics.impressions, compMetrics.impressions);
      positionDelta = computeDelta(currentMetrics.averagePosition, compMetrics.averagePosition);
    }

    queries.push({
      query,
      currentPeriod: currentMetrics,
      comparisonPeriod: compMetrics,
      clicksDelta,
      impressionsDelta,
      positionDelta,
      associatedPages: Array.from(curr.pages),
      isBrandQuery: query.toLowerCase().includes("bot") || query.toLowerCase().includes("consulting"),
    });
  }

  // 5. Detect Declines with Materiality & Volume Safeguards
  const declines: GscDeclineFinding[] = [];

  for (const p of pages) {
    if (p.isDeclining && p.comparisonPeriod && p.clicksDelta && p.impressionsDelta) {
      const clickDrop = p.clicksDelta.percentChange ? Math.abs(p.clicksDelta.percentChange) : 0;
      const impDrop = p.impressionsDelta.percentChange ? Math.abs(p.impressionsDelta.percentChange) : 0;
      const posDrop = p.positionDelta ? p.positionDelta.delta : 0;

      declines.push({
        type: clickDrop >= 40 ? "SIGNIFICANT_CLICK_DROP" : "SIGNIFICANT_IMPRESSION_DROP",
        entityType: "page",
        identifier: p.gscUrl,
        matchedCrawlUrl: p.matchedCrawlUrl,
        currentClicks: p.currentPeriod.clicks,
        previousClicks: p.comparisonPeriod.clicks,
        clickDropPercent: clickDrop,
        currentImpressions: p.currentPeriod.impressions,
        previousImpressions: p.comparisonPeriod.impressions,
        impressionDropPercent: impDrop,
        currentPosition: p.currentPeriod.averagePosition,
        previousPosition: p.comparisonPeriod.averagePosition,
        positionDrop: posDrop,
        severity: clickDrop >= 50 || p.comparisonPeriod.clicks >= 50 ? "high" : "medium",
        likelyCauses: ["SERP intent shift", "Ranking position drop", "Content freshness loss"],
        explanation: `Page experienced a material ${clickDrop}% drop in organic clicks (${p.comparisonPeriod.clicks} -> ${p.currentPeriod.clicks}) over the evaluated period.`,
      });
    }
  }

  for (const q of queries) {
    if (
      isCurrentPeriodComplete &&
      isComparisonPeriodComplete &&
      q.comparisonPeriod &&
      q.comparisonPeriod.impressions >= GSC_POLICY_THRESHOLDS.QUERY_DECLINE.minPreviousImpressions &&
      q.clicksDelta &&
      q.clicksDelta.percentChange &&
      q.clicksDelta.percentChange <= -GSC_POLICY_THRESHOLDS.QUERY_DECLINE.materialClickDropPercent
    ) {
      const clickDrop = Math.abs(q.clicksDelta.percentChange);
      declines.push({
        type: "SIGNIFICANT_CLICK_DROP",
        entityType: "query",
        identifier: q.query,
        currentClicks: q.currentPeriod.clicks,
        previousClicks: q.comparisonPeriod.clicks,
        clickDropPercent: clickDrop,
        currentImpressions: q.currentPeriod.impressions,
        previousImpressions: q.comparisonPeriod.impressions,
        impressionDropPercent: q.impressionsDelta?.percentChange ? Math.abs(q.impressionsDelta.percentChange) : 0,
        currentPosition: q.currentPeriod.averagePosition,
        previousPosition: q.comparisonPeriod.averagePosition,
        positionDrop: q.positionDelta ? q.positionDelta.delta : 0,
        severity: q.comparisonPeriod.clicks >= 20 ? "high" : "medium",
        likelyCauses: ["Competitive displacement", "Algorithm update", "Landing page change"],
        explanation: `Query '${q.query}' lost ${clickDrop}% of organic clicks (${q.comparisonPeriod.clicks} -> ${q.currentPeriod.clicks}).`,
      });
    }
  }

  // 6. Discover Opportunities (Heuristic & Advisory)
  const opportunities: GscOpportunityFinding[] = [];

  for (const p of pages) {
    const heuristicBenchmark = getHeuristicCtrBenchmark(p.currentPeriod.averagePosition);

    // Heuristic CTR Opportunity
    if (p.hasCtrOpportunity) {
      const potentialClicks = Math.round(p.currentPeriod.impressions * heuristicBenchmark);
      const gain = Math.max(0, potentialClicks - p.currentPeriod.clicks);

      opportunities.push({
        type: "HIGH_IMPRESSION_LOW_CTR",
        entityType: "page",
        identifier: p.gscUrl,
        matchedCrawlUrl: p.matchedCrawlUrl,
        impressions: p.currentPeriod.impressions,
        clicks: p.currentPeriod.clicks,
        ctr: p.currentPeriod.ctr,
        position: p.currentPeriod.averagePosition,
        benchmarkCtrForPosition: heuristicBenchmark,
        estimatedClickGain: gain,
        priority: p.currentPeriod.impressions >= 1000 ? "high" : "medium",
        actionableGuidance: [
          "Evaluate snippet alignment with primary search intent",
          "Test more compelling <title> tag value proposition",
          "Refine meta description with clear action-oriented copy",
        ],
      });
    }

    // Ranking Opportunity (Near Page One / Striking Distance)
    if (p.hasRankingOpportunity) {
      const isTop10 = p.currentPeriod.averagePosition <= 10.0;
      opportunities.push({
        type: isTop10 ? "NEAR_PAGE_ONE_RANKING" : "HIGH_POTENTIAL_STRIKING_DISTANCE",
        entityType: "page",
        identifier: p.gscUrl,
        matchedCrawlUrl: p.matchedCrawlUrl,
        impressions: p.currentPeriod.impressions,
        clicks: p.currentPeriod.clicks,
        ctr: p.currentPeriod.ctr,
        position: p.currentPeriod.averagePosition,
        priority: p.currentPeriod.impressions >= 500 ? "high" : "medium",
        actionableGuidance: [
          "Strengthen internal linking with keyword-rich anchor text",
          "Deepen on-page content coverage for top ranking search queries",
          "Resolve any technical SEO blockers on this page",
        ],
      });
    }
  }

  // 7. Crawled Pages Without GSC Data
  const crawledPagesWithoutGsc = crawledPages
    .filter((p) => p.isIndexable && !matchedCrawlUrls.has(p.url))
    .map((p) => ({
      url: p.url,
      reason: "No search impressions recorded in GSC during the evaluated period (new page, low search volume, or unranked).",
    }));

  // 8. Overview Aggregation
  const currentOverview: DateWindowMetrics = {
    clicks: totalCurrentClicks,
    impressions: totalCurrentImpressions,
    ctr: totalCurrentImpressions > 0 ? totalCurrentClicks / totalCurrentImpressions : 0,
    averagePosition: totalCurrentImpressions > 0 ? Math.round((totalCurrentWeightedPos / totalCurrentImpressions) * 10) / 10 : 0,
    isComplete: isCurrentPeriodComplete,
    daysCount: currentDays,
  };

  let compOverview: DateWindowMetrics | undefined;
  let ovClicksDelta: MetricDelta | undefined;
  let ovImpressionsDelta: MetricDelta | undefined;
  let ovCtrDelta: MetricDelta | undefined;
  let ovPosDelta: MetricDelta | undefined;

  if (comparisonRows.length > 0) {
    compOverview = {
      clicks: totalPrevClicks,
      impressions: totalPrevImpressions,
      ctr: totalPrevImpressions > 0 ? totalPrevClicks / totalPrevImpressions : 0,
      averagePosition: totalPrevImpressions > 0 ? Math.round((totalPrevWeightedPos / totalPrevImpressions) * 10) / 10 : 0,
      isComplete: isComparisonPeriodComplete,
      daysCount: comparisonDays,
    };

    ovClicksDelta = computeDelta(currentOverview.clicks, compOverview.clicks);
    ovImpressionsDelta = computeDelta(currentOverview.impressions, compOverview.impressions);
    ovCtrDelta = computeDelta(currentOverview.ctr, compOverview.ctr);
    ovPosDelta = computeDelta(currentOverview.averagePosition, compOverview.averagePosition);
  }

  const telemetry: GscTelemetry = {
    connectionState: "CONNECTED",
    authMode,
    evaluatedCurrentPeriod: `${currentPeriodStart} to ${currentPeriodEnd} (${currentDays}d)`,
    isCurrentPeriodComplete,
    evaluatedComparisonPeriod: comparisonPeriodStart ? `${comparisonPeriodStart} to ${comparisonPeriodEnd} (${comparisonDays}d)` : "None",
    isComparisonPeriodComplete,
    dataFreshnessTimestamp: new Date().toISOString(),
    totalGscRowsIngested: currentRows.length + comparisonRows.length,
    uniqueGscPagesCount: currentPageMap.size,
    uniqueGscQueriesCount: currentQueryMap.size,
    matchedCrawlPagesCount: matchedCrawlUrls.size,
    unmatchedGscUrlsCount: unmatchedGscUrls.length,
    crawledPagesWithoutGscCount: crawledPagesWithoutGsc.length,
    apiCallsCount: 2,
    cacheHitCount: 0,
    rateLimitEncountered: false,
  };

  return {
    pages,
    queries,
    declines,
    opportunities,
    unmatchedGscUrls,
    crawledPagesWithoutGsc,
    organicOverview: {
      currentPeriod: currentOverview,
      comparisonPeriod: compOverview,
      clicksDelta: ovClicksDelta,
      impressionsDelta: ovImpressionsDelta,
      ctrDelta: ovCtrDelta,
      positionDelta: ovPosDelta,
    },
    telemetry,
  };
}
