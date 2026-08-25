/**
 * GSC URL Matching Engine
 * Safely maps Search Console URLs to Dream SEO crawled pages using multi-stage normalization.
 * Enforces strict host-equivalence invariants (never matching across unrelated domains).
 */

import { CrawledPageData } from "../types";
import { normalizeUrl } from "../normalizer";
import { GscUrlMatchMethod } from "./types";

export interface UrlMatchResult {
  rawGscUrl: string;
  normalizedGscUrl: string;
  matchedCrawlUrl?: string;
  matchMethod: GscUrlMatchMethod;
  matchConfidence: number;
  explanation: string;
}

/**
 * Normalizes host and path for equivalent host checks (www/non-www, trailing slash, safe params).
 * Strictly preserves the base domain name.
 */
function normalizePathAndHost(urlStr: string): string {
  try {
    const withProto = urlStr.startsWith("http://") || urlStr.startsWith("https://") ? urlStr : `https://${urlStr}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let pathname = u.pathname.replace(/\/{2,}/g, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${host}${pathname}${u.search}`;
  } catch {
    return urlStr.trim().toLowerCase();
  }
}

export function matchGscUrlToCrawl(
  rawGscUrl: string,
  crawledPages: CrawledPageData[]
): UrlMatchResult {
  if (!rawGscUrl || typeof rawGscUrl !== "string") {
    return {
      rawGscUrl: "",
      normalizedGscUrl: "",
      matchMethod: "UNMATCHED",
      matchConfidence: 0.0,
      explanation: "Empty or invalid GSC URL string",
    };
  }

  const normalizedGsc = normalizeUrl(rawGscUrl) || rawGscUrl.trim();
  const gscPathHost = normalizePathAndHost(rawGscUrl);

  // Tier 1: Exact Character Match
  const exactMatches = crawledPages.filter((p) => p.url === rawGscUrl);
  if (exactMatches.length === 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: exactMatches[0].url,
      matchMethod: "EXACT",
      matchConfidence: 1.0,
      explanation: "Exact character-for-character URL match with crawled page.",
    };
  } else if (exactMatches.length > 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: undefined,
      matchMethod: "AMBIGUOUS",
      matchConfidence: 0.0,
      explanation: `Multiple crawled pages (${exactMatches.length}) share identical raw URL.`,
    };
  }

  // Tier 2: Normalized URL Match (same logical host with protocol/www/trailing slash normalization)
  const normMatches = crawledPages.filter((p) => {
    if (p.normalizedUrl === normalizedGsc) return true;
    return normalizePathAndHost(p.url) === gscPathHost || normalizePathAndHost(p.normalizedUrl) === gscPathHost;
  });

  if (normMatches.length === 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: normMatches[0].url,
      matchMethod: "NORMALIZED",
      matchConfidence: 0.95,
      explanation: "Matched via standardized URL normalization (protocol/www/trailing slash) on verified equivalent host.",
    };
  } else if (normMatches.length > 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: undefined,
      matchMethod: "AMBIGUOUS",
      matchConfidence: 0.0,
      explanation: `Multiple crawled pages (${normMatches.length}) matched the normalized GSC URL; match is ambiguous.`,
    };
  }

  // Tier 3: Canonical Target Match (explicitly declared canonical relationship)
  const canonicalMatches = crawledPages.filter((p) => {
    if (!p.canonicalUrl) return false;
    const normCanonical = normalizeUrl(p.canonicalUrl);
    return normCanonical === normalizedGsc || normalizePathAndHost(p.canonicalUrl) === gscPathHost;
  });

  if (canonicalMatches.length === 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: canonicalMatches[0].url,
      matchMethod: "CANONICAL_MATCH",
      matchConfidence: 0.9,
      explanation: "GSC URL is declared as the canonical target of a crawled page.",
    };
  } else if (canonicalMatches.length > 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: undefined,
      matchMethod: "AMBIGUOUS",
      matchConfidence: 0.0,
      explanation: `Multiple crawled pages (${canonicalMatches.length}) declare the GSC URL as their canonical target.`,
    };
  }

  // Tier 4: Redirect Hop Match (GSC URL was the verified origin of a recorded crawl redirect hop)
  const redirectMatches = crawledPages.filter((p) => {
    if (!p.redirectHops || p.redirectHops.length === 0) return false;
    return p.redirectHops.some((hop) => {
      const normHop = normalizeUrl(hop.fromUrl);
      return (
        normHop === normalizedGsc ||
        hop.fromUrl === rawGscUrl ||
        normalizePathAndHost(hop.fromUrl) === gscPathHost
      );
    });
  });

  if (redirectMatches.length === 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: redirectMatches[0].url,
      matchMethod: "REDIRECT_MATCH",
      matchConfidence: 0.85,
      explanation: "GSC URL matches an initial redirect hop leading to this final crawl destination.",
    };
  } else if (redirectMatches.length > 1) {
    return {
      rawGscUrl,
      normalizedGscUrl: normalizedGsc,
      matchedCrawlUrl: undefined,
      matchMethod: "AMBIGUOUS",
      matchConfidence: 0.0,
      explanation: `Multiple crawled pages (${redirectMatches.length}) originate from the same historical redirect origin.`,
    };
  }

  // Tier 5: Unmatched (Strictly UNMATCHED when domain or path has no verified crawl relationship)
  return {
    rawGscUrl,
    normalizedGscUrl: normalizedGsc,
    matchMethod: "UNMATCHED",
    matchConfidence: 0.0,
    explanation: "GSC URL was not discovered during the crawl traversal and has no verified host or redirect relationship.",
  };
}
