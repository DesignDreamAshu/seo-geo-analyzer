import { normalizeUrl } from "./normalizer";
import { verifyLinkTarget } from "./fetcher";
import type {
  CrawledPageData,
  ExternalLinkEvidence,
  ExternalLinkTelemetry,
  InlinkEntry,
  SitemapUrlEntry,
} from "./types";

export interface LinkGraphAnalysis {
  inlinksMap: Map<string, InlinkEntry[]>;
  sitemapOrphans: SitemapUrlEntry[];
  crawlIsolatedPages: string[];
  totalInternalLinks: number;
  totalExternalLinks: number;
  brokenInternalLinks: Array<{ sourceUrl: string; targetUrl: string; statusCode: number | null; anchorText: string }>;
  brokenExternalLinks: Array<{ sourceUrl: string; targetUrl: string; statusCode: number | null; statusCategory: string; anchorText: string; evidence: ExternalLinkEvidence }>;
  botBlockedExternalLinks: Array<{ sourceUrl: string; targetUrl: string; statusCode: number | null; anchorText: string; evidence: ExternalLinkEvidence }>;
  externalLinkTelemetry: ExternalLinkTelemetry;
}

/**
 * Builds the bidirectional Link Graph, verifies broken external links with strict exclusion of placeholder/utility links,
 * and compiles comprehensive external link telemetry.
 */
export async function buildAndAnalyzeGraph(
  crawledPages: CrawledPageData[],
  sitemapUrls: SitemapUrlEntry[],
  signal?: AbortSignal,
): Promise<LinkGraphAnalysis> {
  const crawledUrlSet = new Set<string>();
  const pageStatusMap = new Map<string, number>();

  for (const page of crawledPages) {
    crawledUrlSet.add(page.normalizedUrl);
    crawledUrlSet.add(page.url);
    pageStatusMap.set(page.normalizedUrl, page.statusCode);
  }

  const inlinksMap = new Map<string, InlinkEntry[]>();
  let totalInternalLinks = 0;
  let totalExternalLinks = 0;
  let excludedPlaceholderHashCount = 0;
  let excludedMailtoTelJsCount = 0;

  const externalUrlsToVerify = new Map<string, Array<{ sourceUrl: string; anchorText: string; rawHref: string }>>();
  const brokenInternalLinks: LinkGraphAnalysis["brokenInternalLinks"] = [];
  const brokenExternalLinks: LinkGraphAnalysis["brokenExternalLinks"] = [];
  const botBlockedExternalLinks: LinkGraphAnalysis["botBlockedExternalLinks"] = [];

  const externalDomainCounts = new Map<string, number>();

  // 1. Classify Outlinks & Segregate External Navigational URLs from Placeholders/Utilities
  for (const page of crawledPages) {
    for (const outlink of page.outlinks) {
      if (outlink.isInternal || outlink.linkClassification === "internal_navigation") {
        totalInternalLinks++;
        const targetNorm = outlink.normalizedTargetUrl;

        // Record inlink
        const existingInlinks = inlinksMap.get(targetNorm) || [];
        existingInlinks.push({
          sourceUrl: page.url,
          anchorText: outlink.anchorText,
          rel: outlink.rel,
          isNofollow: outlink.isNofollow,
          isImageLink: outlink.anchorText === "" && page.images.some((img) => img.resolvedUrl === targetNorm),
        });
        inlinksMap.set(targetNorm, existingInlinks);

        // Check internal status
        const knownStatus = pageStatusMap.get(targetNorm);
        if (knownStatus !== undefined && knownStatus >= 400) {
          brokenInternalLinks.push({
            sourceUrl: page.url,
            targetUrl: outlink.targetUrl,
            statusCode: knownStatus,
            anchorText: outlink.anchorText,
          });
        }
      } else if (
        outlink.linkClassification === "placeholder_hash" ||
        outlink.linkClassification === "fragment" ||
        outlink.rawHref === "#" ||
        outlink.rawHref.startsWith("#")
      ) {
        // Explicitly exclude placeholder / fragment links from external verification queue
        excludedPlaceholderHashCount++;
      } else if (
        outlink.linkClassification === "mailto" ||
        outlink.linkClassification === "tel" ||
        outlink.linkClassification === "javascript_action" ||
        outlink.rawHref.startsWith("mailto:") ||
        outlink.rawHref.startsWith("tel:") ||
        outlink.rawHref.startsWith("javascript:")
      ) {
        // Explicitly exclude non-HTTP scheme actions
        excludedMailtoTelJsCount++;
      } else if (outlink.linkClassification === "external") {
        // Genuine external link candidate
        const extTarget = outlink.resolvedAbsoluteHref || outlink.targetUrl;
        try {
          const parsed = new URL(extTarget);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            totalExternalLinks++;
            externalDomainCounts.set(parsed.hostname, (externalDomainCounts.get(parsed.hostname) || 0) + 1);

            if (!externalUrlsToVerify.has(extTarget)) {
              externalUrlsToVerify.set(extTarget, []);
            }
            externalUrlsToVerify.get(extTarget)!.push({
              sourceUrl: page.url,
              anchorText: outlink.anchorText,
              rawHref: outlink.rawHref,
            });
          } else {
            excludedMailtoTelJsCount++;
          }
        } catch {
          // Invalid URL format
          excludedMailtoTelJsCount++;
        }
      }
    }
  }

  // 2. Verify External Links Concurrently with Safe Limit
  const MAX_EXTERNAL_CHECKS = 30; // Sample check distinct external targets
  const externalEntries = Array.from(externalUrlsToVerify.entries()).slice(0, MAX_EXTERNAL_CHECKS);

  let confirmedOkCount = 0;
  let redirectedOkCount = 0;
  let confirmedBrokenCount = 0;
  let botBlockedCount = 0;
  let rateLimitedCount = 0;
  let timeoutCount = 0;
  let networkDnsSslCount = 0;

  await Promise.all(
    externalEntries.map(async ([targetUrl, sources]) => {
      if (signal?.aborted) return;
      const primarySource = sources[0];
      const checkResult = await verifyLinkTarget(
        targetUrl,
        primarySource.sourceUrl,
        primarySource.rawHref,
        7000,
        signal
      );

      switch (checkResult.outcome) {
        case "confirmed_ok":
          confirmedOkCount += sources.length;
          break;
        case "redirected_ok":
          redirectedOkCount += sources.length;
          break;
        case "confirmed_broken":
          confirmedBrokenCount += sources.length;
          for (const src of sources) {
            brokenExternalLinks.push({
              sourceUrl: src.sourceUrl,
              targetUrl,
              statusCode: checkResult.httpStatus,
              statusCategory: "confirmed_broken",
              anchorText: src.anchorText,
              evidence: checkResult,
            });
          }
          break;
        case "bot_blocked_inconclusive":
          botBlockedCount += sources.length;
          for (const src of sources) {
            botBlockedExternalLinks.push({
              sourceUrl: src.sourceUrl,
              targetUrl,
              statusCode: checkResult.httpStatus,
              anchorText: src.anchorText,
              evidence: checkResult,
            });
          }
          break;
        case "rate_limited_inconclusive":
          rateLimitedCount += sources.length;
          break;
        case "timeout_inconclusive":
          timeoutCount += sources.length;
          break;
        case "dns_failure":
        case "ssl_failure":
        case "network_failure":
          networkDnsSslCount += sources.length;
          break;
        default:
          break;
      }
    })
  );

  // 3. Compile Top External Domains
  const topExternalDomains = Array.from(externalDomainCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const externalLinkTelemetry: ExternalLinkTelemetry = {
    uniqueExternalUrlsCount: externalUrlsToVerify.size,
    totalExternalOccurrences: totalExternalLinks,
    confirmedOkCount,
    redirectedOkCount,
    confirmedBrokenCount,
    botBlockedCount,
    rateLimitedCount,
    timeoutCount,
    networkDnsSslCount,
    excludedPlaceholderHashCount,
    excludedMailtoTelJsCount,
    topExternalDomains,
  };

  // 4. Detect True Sitemap Orphans
  const sitemapOrphans: SitemapUrlEntry[] = [];
  for (const sitemapEntry of sitemapUrls) {
    const norm = normalizeUrl(sitemapEntry.loc);
    if (norm && !crawledUrlSet.has(norm)) {
      sitemapOrphans.push(sitemapEntry);
    }
  }

  // 5. Detect Crawl-Isolated Pages (Depth >= 4 with only <= 1 inlink)
  const crawlIsolatedPages: string[] = [];
  for (const page of crawledPages) {
    if (page.depth >= 4) {
      const inlinks = inlinksMap.get(page.normalizedUrl) || [];
      if (inlinks.length <= 1) {
        crawlIsolatedPages.push(page.url);
      }
    }
  }

  return {
    inlinksMap,
    sitemapOrphans,
    crawlIsolatedPages,
    totalInternalLinks,
    totalExternalLinks,
    brokenInternalLinks,
    brokenExternalLinks,
    botBlockedExternalLinks,
    externalLinkTelemetry,
  };
}
