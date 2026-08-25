/**
 * Unexpected Index Expansion & Index Pattern Detector.
 * Identifies parameter, internal-search, session, and tag bloat in Google's index evidence without black-box scores.
 */

import { IndexationEvidenceRecord } from "./types";

export interface IndexPatternFinding {
  pattern: string;
  indexedVariantsCount: number;
  recommendation: string;
}

export function detectUnexpectedIndexExpansion(records: IndexationEvidenceRecord[]): {
  trackingParametersIndexedCount: number;
  internalSearchIndexedCount: number;
  sessionUrlsIndexedCount: number;
  detectedPatterns: IndexPatternFinding[];
} {
  let trackingCount = 0;
  let searchCount = 0;
  let sessionCount = 0;
  const patternGroups = new Map<string, number>();

  for (const r of records) {
    if (r.googleIndexState !== "INDEXED") continue;

    const u = r.url.toLowerCase();

    // 1. Tracking Parameters
    if (/utm_|gclid|fbclid|msclkid/i.test(u)) {
      trackingCount++;
      const base = u.split("?")[0];
      patternGroups.set(`TRACKING:${base}`, (patternGroups.get(`TRACKING:${base}`) || 0) + 1);
    }

    // 2. Internal Search Pages
    if (/\/search|\?q=|\?search=|\?keyword=/i.test(u)) {
      searchCount++;
      patternGroups.set("INTERNAL_SEARCH", (patternGroups.get("INTERNAL_SEARCH") || 0) + 1);
    }

    // 3. Session URLs
    if (/sessionid|phpsessid|jsessionid/i.test(u)) {
      sessionCount++;
      patternGroups.set("SESSION_URLS", (patternGroups.get("SESSION_URLS") || 0) + 1);
    }
  }

  const detectedPatterns: IndexPatternFinding[] = [];

  for (const [key, count] of patternGroups.entries()) {
    if (key.startsWith("TRACKING:")) {
      const base = key.replace("TRACKING:", "");
      detectedPatterns.push({
        pattern: `Tracking URLs on ${base}`,
        indexedVariantsCount: count,
        recommendation: "Ensure canonical tags on tracking parameter URLs point to the clean canonical base URL.",
      });
    } else if (key === "INTERNAL_SEARCH") {
      detectedPatterns.push({
        pattern: "Internal Search Result Pages",
        indexedVariantsCount: count,
        recommendation: "Review internal search indexing policy (typically disallow or noindex search results to prevent index bloat).",
      });
    } else if (key === "SESSION_URLS") {
      detectedPatterns.push({
        pattern: "Session / Dynamic Session ID URLs",
        indexedVariantsCount: count,
        recommendation: "Remove session identifiers from URLs or add robots parameter blocking.",
      });
    }
  }

  return {
    trackingParametersIndexedCount: trackingCount,
    internalSearchIndexedCount: searchCount,
    sessionUrlsIndexedCount: sessionCount,
    detectedPatterns,
  };
}
