import { normalizeUrl } from "./normalizer";
import { verifyLinkTarget } from "./fetcher";
import type {
  CrawledPageData,
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
  brokenExternalLinks: Array<{ sourceUrl: string; targetUrl: string; statusCode: number | null; statusCategory: string; anchorText: string }>;
  botBlockedExternalLinks: Array<{ sourceUrl: string; targetUrl: string; statusCode: number | null; anchorText: string }>;
}

/**
 * Builds the bidirectional Link Graph, verifies broken external links, and detects sitemap orphans.
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

  const externalUrlsToVerify = new Map<string, Array<{ sourceUrl: string; anchorText: string }>>();
  const brokenInternalLinks: LinkGraphAnalysis["brokenInternalLinks"] = [];
  const brokenExternalLinks: LinkGraphAnalysis["brokenExternalLinks"] = [];
  const botBlockedExternalLinks: LinkGraphAnalysis["botBlockedExternalLinks"] = [];

  // 1. Build Inlinks and classify Internal Link Targets
  for (const page of crawledPages) {
    for (const outlink of page.outlinks) {
      if (outlink.isInternal) {
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
      } else {
        totalExternalLinks++;
        const extTarget = outlink.targetUrl;
        if (!externalUrlsToVerify.has(extTarget)) {
          externalUrlsToVerify.set(extTarget, []);
        }
        externalUrlsToVerify.get(extTarget)!.push({
          sourceUrl: page.url,
          anchorText: outlink.anchorText,
        });
      }
    }
  }

  // 2. Verify Sampled External Links (Concurrently with limit)
  const MAX_EXTERNAL_CHECKS = 25; // Sample check external links to prevent crawl slowdown
  const externalEntries = Array.from(externalUrlsToVerify.entries()).slice(0, MAX_EXTERNAL_CHECKS);

  await Promise.all(
    externalEntries.map(async ([targetUrl, sources]) => {
      if (signal?.aborted) return;
      const checkResult = await verifyLinkTarget(targetUrl, 6000, signal);

      if (checkResult.statusCategory === "confirmed_broken") {
        for (const src of sources) {
          brokenExternalLinks.push({
            sourceUrl: src.sourceUrl,
            targetUrl,
            statusCode: checkResult.statusCode,
            statusCategory: checkResult.statusCategory,
            anchorText: src.anchorText,
          });
        }
      } else if (checkResult.statusCategory === "bot_blocked_inconclusive") {
        for (const src of sources) {
          botBlockedExternalLinks.push({
            sourceUrl: src.sourceUrl,
            targetUrl,
            statusCode: checkResult.statusCode,
            anchorText: src.anchorText,
          });
        }
      }
    })
  );

  // 3. Detect True Sitemap Orphans
  const sitemapOrphans: SitemapUrlEntry[] = [];
  for (const sitemapEntry of sitemapUrls) {
    const norm = normalizeUrl(sitemapEntry.loc);
    if (norm && !crawledUrlSet.has(norm)) {
      sitemapOrphans.push(sitemapEntry);
    }
  }

  // 4. Detect Crawl-Isolated Pages (Depth > 3 with only 1 inlink)
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
  };
}
