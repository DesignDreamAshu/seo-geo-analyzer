/**
 * Market Intelligence Integrators for International SEO.
 * Reuses Phase 8 GSC country performance and Phase 13 SERP market context,
 * maintaining strict separation between international locales and physical local business locations (Phase 15).
 */

import { SerpSnapshot } from "../competitor-serp/types";
import { GscCountryPerformance } from "./types";

export interface GscMarketAlignmentResult {
  countryCode: string;
  countryName: string;
  clicks: number;
  impressions: number;
  topLandingUrl: string;
  expectedLocale?: string;
  alignmentState: "MARKET_ALIGNED" | "INTERNATIONAL_QUERY_PAGE_ALIGNMENT_REVIEW";
}

export function evaluateGscMarketAlignment(
  countryPerformances: GscCountryPerformance[] = [],
  localePathMap: Map<string, string> // e.g. "GB" -> "https://example.com/en-gb/"
): GscMarketAlignmentResult[] {
  const results: GscMarketAlignmentResult[] = [];

  for (const cp of countryPerformances) {
    const expectedPrefix = localePathMap.get(cp.country.toUpperCase());
    let alignmentState: "MARKET_ALIGNED" | "INTERNATIONAL_QUERY_PAGE_ALIGNMENT_REVIEW" = "MARKET_ALIGNED";

    // If UK traffic lands on /en-us/ page while /en-gb/ exists
    if (expectedPrefix && !cp.topUrl.startsWith(expectedPrefix) && cp.clicks > 10) {
      alignmentState = "INTERNATIONAL_QUERY_PAGE_ALIGNMENT_REVIEW";
    }

    results.push({
      countryCode: cp.country,
      countryName: cp.country,
      clicks: cp.clicks,
      impressions: cp.impressions,
      topLandingUrl: cp.topUrl,
      expectedLocale: expectedPrefix,
      alignmentState,
    });
  }

  return results;
}

export function extractSerpMarketDifferences(serpSnapshots: SerpSnapshot[]): Array<{
  query: string;
  country: string;
  observedIntent: string;
  topRankingUrl: string;
  intentDifferenceNote?: string;
}> {
  const list: Array<{ query: string; country: string; observedIntent: string; topRankingUrl: string; intentDifferenceNote?: string }> = [];

  for (const snap of serpSnapshots) {
    const topResult = snap.organicResults[0];
    list.push({
      query: snap.query,
      country: snap.country,
      observedIntent: topResult?.resultType || "INFORMATIONAL",
      topRankingUrl: topResult?.url || "",
      intentDifferenceNote: `SERP in '${snap.country}' displays predominantly ${topResult?.resultType || "INFORMATIONAL"} ranking assets.`,
    });
  }

  return list;
}
