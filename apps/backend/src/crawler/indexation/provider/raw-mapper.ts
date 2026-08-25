/**
 * Raw Google Inspection State Mapper & Auditable Normalizer.
 * Preserves raw provider terminology and normalizes to Dream SEO canonical taxonomy.
 */

import { GoogleIndexState, GoogleIndexDetailedReason } from "../types";

export interface NormalizedGoogleStateResult {
  rawStatus: string;
  normalizedState: GoogleIndexState;
  detailedReason: GoogleIndexDetailedReason;
  mappingExplanation: string;
  mapperVersion: string;
}

export function mapRawGoogleCoverageState(
  rawState: string | undefined,
  verdict?: string,
  pageFetchState?: string,
  indexingState?: string,
  robotsState?: string,
  mapperVersion: string = "1.0.0"
): NormalizedGoogleStateResult {
  const cleanRaw = (rawState || "").trim();

  // 1. Crawled - currently not indexed
  if (/Crawled\s*[-–—]\s*currently not indexed/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw,
      normalizedState: "NOT_INDEXED",
      detailedReason: "CRAWLED_CURRENTLY_NOT_INDEXED",
      mappingExplanation: "Googlebot crawled the page but decided not to index it at this time.",
      mapperVersion,
    };
  }

  // 2. Discovered - currently not indexed
  if (/Discovered\s*[-–—]\s*currently not indexed/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw,
      normalizedState: "NOT_INDEXED",
      detailedReason: "DISCOVERED_CURRENTLY_NOT_INDEXED",
      mappingExplanation: "Google discovered the URL but has not crawled it yet.",
      mapperVersion,
    };
  }

  // 3. Duplicate, Google chose different canonical than user
  if (/Duplicate,\s*Google chose different canonical/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw,
      normalizedState: "NOT_INDEXED",
      detailedReason: "DUPLICATE_GOOGLE_CHOSE_DIFFERENT_CANONICAL",
      mappingExplanation: "Google identified duplicate content and selected a different URL as the canonical version.",
      mapperVersion,
    };
  }

  // 4. Alternate page with proper canonical tag
  if (/Alternate page with proper canonical tag/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw,
      normalizedState: "NOT_INDEXED",
      detailedReason: "ALTERNATE_PAGE_WITH_CANONICAL",
      mappingExplanation: "Page is recognized as an alternate variant pointing to a valid declared canonical URL.",
      mapperVersion,
    };
  }

  // 5. Excluded by 'noindex' tag
  if (/Excluded by\s*['"]?noindex['"]?\s*tag/i.test(cleanRaw) || indexingState === "BLOCKED_BY_META_TAG" || indexingState === "BLOCKED_BY_HTTP_HEADER") {
    return {
      rawStatus: cleanRaw || "Excluded by noindex tag",
      normalizedState: "NOT_INDEXED",
      detailedReason: "EXCLUDED_BY_NOINDEX",
      mappingExplanation: "Google respected the noindex directive present on the page.",
      mapperVersion,
    };
  }

  // 6. Blocked by robots.txt
  if (/Blocked by robots\.txt/i.test(cleanRaw) || robotsState === "DISALLOWED") {
    return {
      rawStatus: cleanRaw || "Blocked by robots.txt",
      normalizedState: "NOT_INDEXED",
      detailedReason: "BLOCKED_BY_ROBOTS",
      mappingExplanation: "Googlebot was blocked from fetching the URL by robots.txt directives.",
      mapperVersion,
    };
  }

  // 7. Soft 404
  if (/Soft 404/i.test(cleanRaw) || pageFetchState === "SOFT_404") {
    return {
      rawStatus: cleanRaw || "Soft 404",
      normalizedState: "NOT_INDEXED",
      detailedReason: "SOFT_404",
      mappingExplanation: "Page returned 200 OK but Google detected empty or missing content indicators.",
      mapperVersion,
    };
  }

  // 8. Not found (404)
  if (/Not found \(404\)/i.test(cleanRaw) || pageFetchState === "NOT_FOUND") {
    return {
      rawStatus: cleanRaw || "Not found (404)",
      normalizedState: "NOT_INDEXED",
      detailedReason: "NOT_FOUND_404",
      mappingExplanation: "Google encountered HTTP 404 Not Found upon fetching.",
      mapperVersion,
    };
  }

  // 9. Server error (5xx)
  if (/Server error \(5xx\)/i.test(cleanRaw) || pageFetchState === "SERVER_ERROR") {
    return {
      rawStatus: cleanRaw || "Server error (5xx)",
      normalizedState: "NOT_INDEXED",
      detailedReason: "SERVER_ERROR",
      mappingExplanation: "Google encountered an internal server error (5xx) during crawl.",
      mapperVersion,
    };
  }

  // 10. Page with redirect
  if (/Page with redirect/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw,
      normalizedState: "NOT_INDEXED",
      detailedReason: "REDIRECT",
      mappingExplanation: "URL redirects to another target destination.",
      mapperVersion,
    };
  }

  // 11. Duplicate without user-selected canonical
  if (/Duplicate without user-selected canonical/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw,
      normalizedState: "NOT_INDEXED",
      detailedReason: "DUPLICATE_WITHOUT_SELECTED_CANONICAL",
      mappingExplanation: "Google identified duplicate content without an explicit declared canonical tag.",
      mapperVersion,
    };
  }

  // 12. URL is unknown to Google
  if (/URL is not on Google|URL is unknown to Google/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw || "URL is unknown to Google",
      normalizedState: "NOT_INDEXED",
      detailedReason: "UNKNOWN_TO_GOOGLE",
      mappingExplanation: "Google has no crawl or index record for this URL.",
      mapperVersion,
    };
  }

  // 13. Explicit Verdict PASS or Indexed states (only when not matching exclusions above)
  if (verdict === "PASS" || /URL is on Google|Submitted and indexed|^Indexed/i.test(cleanRaw)) {
    return {
      rawStatus: cleanRaw || "URL is on Google",
      normalizedState: "INDEXED",
      detailedReason: "INDEXED",
      mappingExplanation: "Google reports page is indexed and appearing in search results.",
      mapperVersion,
    };
  }

  // 14. Fallback for unprovided / unknown state
  if (!cleanRaw) {
    return {
      rawStatus: "EVIDENCE_UNAVAILABLE",
      normalizedState: "UNKNOWN",
      detailedReason: "UNKNOWN",
      mappingExplanation: "No provider inspection evidence is available for this URL.",
      mapperVersion,
    };
  }

  return {
    rawStatus: cleanRaw,
    normalizedState: "PROCESSING_OR_UNCERTAIN",
    detailedReason: "OTHER_PROVIDER_STATE",
    mappingExplanation: `Unmapped provider coverage state: '${cleanRaw}'`,
    mapperVersion,
  };
}
