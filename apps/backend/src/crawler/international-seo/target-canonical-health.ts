/**
 * Target Health & Canonical Compatibility Engine.
 * Cross-references hreflang targets against crawl HTTP status, indexability, redirects, and canonical tags.
 */

import { HreflangCluster, CanonicalCompatibilityState } from "./types";

export interface TargetHealthIssue {
  sourceUrl: string;
  targetUrl: string;
  hreflang: string;
  targetStatusCode?: number;
  issueType: "HREFLANG_TARGET_404" | "HREFLANG_TARGET_REDIRECT" | "HREFLANG_TARGET_NOINDEX" | "HREFLANG_TARGET_CANONICAL_MISMATCH";
  details: string;
}

export interface CanonicalConflictFinding {
  url: string;
  locale: string;
  canonicalUrl: string;
  conflictType: CanonicalCompatibilityState;
  details: string;
}

export function evaluateHreflangTargetAndCanonicalHealth(
  clusters: HreflangCluster[],
  crawlMetadataMap: Map<string, { statusCode?: number; isNoindex?: boolean; isRedirect?: boolean; canonicalUrl?: string; redirectDestination?: string }>
): {
  targetIssues: TargetHealthIssue[];
  canonicalConflicts: CanonicalConflictFinding[];
} {
  const targetIssues: TargetHealthIssue[] = [];
  const canonicalConflicts: CanonicalConflictFinding[] = [];

  for (const cluster of clusters) {
    for (const edge of cluster.declaredAlternates) {
      const targetMeta = crawlMetadataMap.get(edge.targetUrl);
      if (!targetMeta) continue;

      // 1. Broken Target (404/410)
      if (targetMeta.statusCode === 404 || targetMeta.statusCode === 410) {
        targetIssues.push({
          sourceUrl: edge.sourceUrl,
          targetUrl: edge.targetUrl,
          hreflang: edge.hreflang,
          targetStatusCode: targetMeta.statusCode,
          issueType: "HREFLANG_TARGET_404",
          details: `Hreflang tag on [${edge.sourceUrl}] declares '${edge.hreflang}' target [${edge.targetUrl}] which returns HTTP ${targetMeta.statusCode}.`,
        });
      }

      // 2. Redirect Target (301/302)
      if (targetMeta.isRedirect || (targetMeta.statusCode && targetMeta.statusCode >= 300 && targetMeta.statusCode < 400)) {
        targetIssues.push({
          sourceUrl: edge.sourceUrl,
          targetUrl: edge.targetUrl,
          hreflang: edge.hreflang,
          targetStatusCode: targetMeta.statusCode,
          issueType: "HREFLANG_TARGET_REDIRECT",
          details: `Hreflang tag on [${edge.sourceUrl}] declares '${edge.hreflang}' target [${edge.targetUrl}] which redirects to [${targetMeta.redirectDestination || "destination"}]. Alternate tags must point directly to HTTP 200 destinations.`,
        });
      }

      // 3. Noindex Target
      if (targetMeta.isNoindex) {
        targetIssues.push({
          sourceUrl: edge.sourceUrl,
          targetUrl: edge.targetUrl,
          hreflang: edge.hreflang,
          issueType: "HREFLANG_TARGET_NOINDEX",
          details: `Hreflang tag on [${edge.sourceUrl}] declares '${edge.hreflang}' target [${edge.targetUrl}] which has a noindex directive.`,
        });
      }
    }

    // 4. Canonical vs Hreflang Compatibility
    for (const page of cluster.pages) {
      const pageMeta = crawlMetadataMap.get(page.url);
      if (!pageMeta || !pageMeta.canonicalUrl) continue;

      const normPage = page.url.replace(/\/$/, "");
      const normCanonical = pageMeta.canonicalUrl.replace(/\/$/, "");

      if (normCanonical !== normPage) {
        // Cross-locale or cross-language canonical
        const isCrossLanguage = page.localeCode.startsWith("fr") || page.localeCode.startsWith("de") || page.localeCode.startsWith("es");
        if (isCrossLanguage && (normCanonical.includes("/en") || normCanonical.includes("/us"))) {
          canonicalConflicts.push({
            url: page.url,
            locale: page.localeCode,
            canonicalUrl: pageMeta.canonicalUrl,
            conflictType: "CROSS_LANGUAGE_CANONICAL_REVIEW",
            details: `Localized page [${page.url}] (${page.localeCode}) specifies a cross-language canonical URL [${pageMeta.canonicalUrl}]. Translated pages intended for separate indexing should self-canonicalize.`,
          });
        } else {
          canonicalConflicts.push({
            url: page.url,
            locale: page.localeCode,
            canonicalUrl: pageMeta.canonicalUrl,
            conflictType: "HREFLANG_CANONICAL_CONFLICT",
            details: `Regional page [${page.url}] (${page.localeCode}) declares self in hreflang but canonicalizes to [${pageMeta.canonicalUrl}]. Alternate regional signals and canonical consolidation signals conflict.`,
          });
        }
      }
    }
  }

  return {
    targetIssues,
    canonicalConflicts,
  };
}
