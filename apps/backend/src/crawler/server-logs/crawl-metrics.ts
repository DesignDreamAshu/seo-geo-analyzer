/**
 * Crawl Metrics & Request Aggregation Engine.
 * Aggregates bot requests by URL, calculates status/bot distributions, computes latency percentiles,
 * separates HTML from asset crawls, and assigns context-aware frequency classes.
 */

import {
  SeoServerLogEvent,
  UrlCrawlMetrics,
  CrawlFrequencyClass,
  CrawlCoverageState,
  BotFamily,
  LogDatasetCompleteness,
} from "./types";
import { DEFAULT_LOG_POLICY, LogIntelligencePolicy } from "./config";

function calculatePercentile(values: number[], percentile: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export function computeUrlCrawlMetrics(params: {
  events: SeoServerLogEvent[];
  knownUrls?: Array<{ url: string; isIndexable?: boolean; isImportant?: boolean; importanceReasons?: string[]; pageType?: string }>;
  datasetDays?: number;
  completeness?: LogDatasetCompleteness;
  policy?: LogIntelligencePolicy;
}): Map<string, UrlCrawlMetrics> {
  const policy = params.policy || DEFAULT_LOG_POLICY;
  const datasetDays = params.datasetDays || 14;
  const completeness = params.completeness || "COMPLETE";

  const urlMap = new Map<string, {
    events: SeoServerLogEvent[];
    latencies: number[];
    days: Set<string>;
    statusDist: Record<number, number>;
    botDist: Partial<Record<BotFamily, number>>;
    totalBytes: number;
    isIndexable: boolean;
    isImportant: boolean;
    importanceReasons: string[];
    pageType?: string;
  }>();

  // Initialize with known URLs
  if (params.knownUrls) {
    for (const k of params.knownUrls) {
      urlMap.set(k.url, {
        events: [],
        latencies: [],
        days: new Set(),
        statusDist: {},
        botDist: {},
        totalBytes: 0,
        isIndexable: k.isIndexable ?? true,
        isImportant: k.isImportant ?? false,
        importanceReasons: k.importanceReasons || [],
        pageType: k.pageType,
      });
    }
  }

  // Ingest events
  for (const e of params.events) {
    const key = e.normalizedUrl;
    let entry = urlMap.get(key);
    if (!entry) {
      entry = {
        events: [],
        latencies: [],
        days: new Set(),
        statusDist: {},
        botDist: {},
        totalBytes: 0,
        isIndexable: true,
        isImportant: false,
        importanceReasons: [],
        pageType: undefined,
      };
      urlMap.set(key, entry);
    }

    entry.events.push(e);
    if (e.responseTimeMs !== undefined) entry.latencies.push(e.responseTimeMs);
    entry.totalBytes += e.responseBytes || 0;

    const dayStr = e.timestamp.slice(0, 10);
    entry.days.add(dayStr);

    entry.statusDist[e.statusCode] = (entry.statusDist[e.statusCode] || 0) + 1;
    entry.botDist[e.botIdentity.family] = (entry.botDist[e.botIdentity.family] || 0) + 1;
  }

  const result = new Map<string, UrlCrawlMetrics>();
  const freqPolicy = policy.frequencyPolicy;

  for (const [url, data] of urlMap.entries()) {
    const totalRequests = data.events.length;
    const verifiedRequests = data.events.filter((e) => e.botIdentity.isVerifiedSearchBot).length;
    const verifiedGooglebotEvents = data.events.filter(
      (e) => e.botIdentity.family === "GOOGLEBOT" && e.botIdentity.isVerifiedSearchBot
    );
    const verifiedGooglebotRequests = verifiedGooglebotEvents.length;
    const verifiedGooglebotHtmlRequests = verifiedGooglebotEvents.filter((e) => e.resourceType === "HTML_DOCUMENT").length;
    const verifiedGooglebotImageRequests = verifiedGooglebotEvents.filter((e) => e.botIdentity.deviceType === "IMAGE" || e.resourceType === "IMAGE").length;

    let firstObserved: string | undefined;
    let lastObserved: string | undefined;
    if (data.events.length > 0) {
      const sortedDates = data.events.map((e) => e.timestamp).sort();
      firstObserved = sortedDates[0];
      lastObserved = sortedDates[sortedDates.length - 1];
    }

    // Crawl Frequency Class (Suppressed for Partial/Invalid Logs)
    let frequencyClass: CrawlFrequencyClass = "INSUFFICIENT_DATA";
    if (completeness === "PARTIAL" || completeness === "INVALID" || completeness === "UNKNOWN") {
      frequencyClass = "INSUFFICIENT_DATA";
    } else if (datasetDays >= freqPolicy.minDatasetDays) {
      if (totalRequests === 0) {
        frequencyClass = "NOT_OBSERVED_IN_PERIOD";
      } else if (data.days.size >= datasetDays * freqPolicy.frequentActivityPercentage || totalRequests >= datasetDays * 2) {
        frequencyClass = "VERY_FREQUENTLY_OBSERVED";
      } else if (data.days.size >= datasetDays * freqPolicy.periodicActivityPercentage || totalRequests >= datasetDays * 0.5) {
        frequencyClass = "FREQUENTLY_OBSERVED";
      } else if (totalRequests >= freqPolicy.minRequestsForPeriodic) {
        frequencyClass = "PERIODICALLY_OBSERVED";
      } else {
        frequencyClass = "RARELY_OBSERVED";
      }
    } else if (totalRequests === 0) {
      frequencyClass = "NOT_OBSERVED_IN_PERIOD";
    }

    // Coverage State
    let coverageState: CrawlCoverageState = "UNKNOWN";
    if (completeness === "PARTIAL" || completeness === "INVALID") {
      coverageState = totalRequests > 0 ? "CRAWLABLE_AND_OBSERVED" : "OBSERVATION_INCONCLUSIVE";
    } else if (totalRequests === 0) {
      coverageState = data.isIndexable ? "CRAWLABLE_NOT_OBSERVED" : "UNKNOWN";
    } else {
      const has200 = (data.statusDist[200] || 0) > 0;
      const has3xx = Object.keys(data.statusDist).some((s) => s.startsWith("3"));
      const has4xx5xx = Object.keys(data.statusDist).some((s) => s.startsWith("4") || s.startsWith("5"));

      if (has3xx) coverageState = "REDIRECT_OBSERVED";
      else if (has4xx5xx && !has200) coverageState = "ERROR_OBSERVED";
      else if (!data.isIndexable) coverageState = "NON_INDEXABLE_BUT_OBSERVED";
      else coverageState = "CRAWLABLE_AND_OBSERVED";
    }

    result.set(url, {
      url,
      normalizedUrl: url,
      pageType: data.pageType,
      isImportant: data.isImportant,
      importanceReasons: data.importanceReasons,
      totalBotRequests: totalRequests,
      verifiedBotRequests: verifiedRequests,
      verifiedGooglebotRequests,
      verifiedGooglebotHtmlRequests,
      verifiedGooglebotImageRequests,
      firstObserved,
      lastObserved,
      activeDaysCount: data.days.size,
      statusDistribution: data.statusDist,
      botFamilyDistribution: data.botDist,
      resourceType: data.events[0]?.resourceType || "HTML_DOCUMENT",
      medianResponseTimeMs: calculatePercentile(data.latencies, 50),
      p75ResponseTimeMs: calculatePercentile(data.latencies, 75),
      p95ResponseTimeMs: calculatePercentile(data.latencies, 95),
      totalBytesTransferred: data.totalBytes,
      frequencyClass,
      coverageState,
    });
  }

  return result;
}
