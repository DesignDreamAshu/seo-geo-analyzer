/**
 * Crawl Pattern & Anomaly Detection Engine.
 * Multi-factor facet evaluation, crawl trap categorization, and configurable 5xx error burst detection.
 */

import { SeoServerLogEvent } from "./types";
import { DEFAULT_LOG_POLICY, LogIntelligencePolicy } from "./config";

export interface FacetPatternFinding {
  basePath: string;
  variantCount: number;
  requestsCount: number;
  hasSearchDemand: boolean;
  recommendedReviewType:
    | "FACET_INDEXABILITY_REVIEW"
    | "FACET_CANONICAL_REVIEW"
    | "FACET_DISCOVERY_REVIEW"
    | "FACET_CRAWL_EXPANSION_REVIEW"
    | "NO_ACTION"
    | "MANUAL_REVIEW";
  guidance: string;
}

export interface CrawlTrapFinding {
  pattern: string;
  trapType: "CALENDAR_EXPANSION" | "INFINITE_PAGINATION" | "SESSION_EXPLOSION" | "SEARCH_EXPANSION" | "COMBINATORIAL_FACETS" | "UNKNOWN";
  detectedVariants: number;
  sampleUrls: string[];
  rationale: string;
}

export interface ErrorBurstFinding {
  timestampStart: string;
  timestampEnd: string;
  statusCode: number;
  requestsCount: number;
  affectedUrls: string[];
}

export function detectCrawlPatterns(params: {
  events: SeoServerLogEvent[];
  gscQueriesPerUrl?: Map<string, number>;
  policy?: LogIntelligencePolicy;
}): {
  facetPatterns: FacetPatternFinding[];
  crawlTraps: CrawlTrapFinding[];
  errorBursts: ErrorBurstFinding[];
  stagingBotRequestsCount: number;
  nonCanonicalRequestsCount: number;
} {
  const policy = params.policy || DEFAULT_LOG_POLICY;
  const basePathMap = new Map<string, { urls: Set<string>; requests: number }>();
  const errorEvents: SeoServerLogEvent[] = [];
  let stagingBotRequestsCount = 0;
  let nonCanonicalRequestsCount = 0;

  for (const e of params.events) {
    if (!e.botIdentity.isVerifiedSearchBot) continue;

    // 1. Check Staging Search Bot Activity
    if (e.host.includes("staging.") || e.host.includes("dev.") || e.rawPath.includes("staging")) {
      stagingBotRequestsCount++;
    }

    // 2. Group by Base Path for Parameter/Facet Expansion
    if (e.rawQuery) {
      const base = e.rawPath;
      let group = basePathMap.get(base);
      if (!group) {
        group = { urls: new Set(), requests: 0 };
        basePathMap.set(base, group);
      }
      group.urls.add(e.rawUrl);
      group.requests++;
    }

    // 3. Collect 5xx Server Errors
    if (e.statusCode >= 500 && e.statusCode < 600) {
      errorEvents.push(e);
    }
  }

  // Evaluate Parameter & Facet Expansion
  const facetPatterns: FacetPatternFinding[] = [];
  const crawlTraps: CrawlTrapFinding[] = [];

  for (const [base, data] of basePathMap.entries()) {
    if (data.urls.size >= 50 || data.requests >= 200) {
      const hasGscDemand = Array.from(data.urls).some((u) => (params.gscQueriesPerUrl?.get(u) || 0) > 0);

      let reviewType: FacetPatternFinding["recommendedReviewType"] = "FACET_CRAWL_EXPANSION_REVIEW";
      let guidance = "";

      if (hasGscDemand) {
        reviewType = "FACET_CANONICAL_REVIEW";
        guidance = "Facet parameters receive organic search traffic. Conduct canonical and indexability review to avoid unintended deindexing while preventing duplicate expansion.";
      } else if (data.urls.size >= 500) {
        reviewType = "FACET_CRAWL_EXPANSION_REVIEW";
        guidance = "High variant expansion without search demand evidence. Review canonical consolidation or robots parameter directives.";
      } else {
        reviewType = "FACET_INDEXABILITY_REVIEW";
        guidance = "Moderate facet activity observed. Audit internal linking and canonical self-references.";
      }

      facetPatterns.push({
        basePath: base,
        variantCount: data.urls.size,
        requestsCount: data.requests,
        hasSearchDemand: hasGscDemand,
        recommendedReviewType: reviewType,
        guidance,
      });

      // Distinguish Crawl Trap Types
      if (data.urls.size >= 1000 || /calendar|archive|date|page=\d{3,}|session|search|q=/i.test(base)) {
        let trapType: CrawlTrapFinding["trapType"] = "COMBINATORIAL_FACETS";
        if (/calendar|date/i.test(base)) trapType = "CALENDAR_EXPANSION";
        else if (/page|p=/i.test(base)) trapType = "INFINITE_PAGINATION";
        else if (/session|sid/i.test(base)) trapType = "SESSION_EXPLOSION";
        else if (/search|q=/i.test(base)) trapType = "SEARCH_EXPANSION";

        crawlTraps.push({
          pattern: base,
          trapType,
          detectedVariants: data.urls.size,
          sampleUrls: Array.from(data.urls).slice(0, 5),
          rationale: `Potential crawl trap review (${trapType}): [${base}] generated over ${data.urls.size} observed parameter combinations.`,
        });
      }
    }
  }

  // Detect 5xx Error Bursts using Configurable Policy
  const errorBursts: ErrorBurstFinding[] = [];
  const burstPolicy = policy.burstPolicy;

  if (errorEvents.length >= burstPolicy.minErrorCountForBurst) {
    const sorted = [...errorEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const urls = Array.from(new Set(sorted.map((e) => e.normalizedUrl)));

    if (urls.length >= burstPolicy.minAffectedUrlsCount) {
      errorBursts.push({
        timestampStart: sorted[0].timestamp,
        timestampEnd: sorted[sorted.length - 1].timestamp,
        statusCode: sorted[0].statusCode,
        requestsCount: sorted.length,
        affectedUrls: urls,
      });
    }
  }

  return {
    facetPatterns,
    crawlTraps,
    errorBursts,
    stagingBotRequestsCount,
    nonCanonicalRequestsCount,
  };
}
