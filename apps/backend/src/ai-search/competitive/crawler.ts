/**
 * Phase 28J.1: Real Competitor Crawl Engine & Semantic Corpus Builder.
 * Crawls public competitor domains with controlled scope, builds indexable HTML corpus,
 * and extracts semantic page contexts for competitive prompt benchmarking.
 */

import { fetchPageHtml } from "../../crawler/fetcher";
import { processPageAuthoritatively } from "../../crawler/page-processor";
import { normalizeUrl } from "../../crawler/normalizer";
import { CrawledPageContext } from "../optimization/mapper";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { extractProjectKnowledgeProfile } from "../knowledge-profile/extractor";
import { CompetitorCorpusSummary, ProjectCompetitor } from "./types";
import { CompetitorEvaluationContext } from "./engine";

export interface CompetitorCrawlOptions {
  maxPages?: number;
  timeoutMs?: number;
  concurrency?: number;
}

export class CompetitorCrawler {
  public async crawlCompetitor(
    competitor: ProjectCompetitor,
    options: CompetitorCrawlOptions = {}
  ): Promise<CompetitorEvaluationContext> {
    const maxPages = options.maxPages || 25;
    const timeoutMs = options.timeoutMs || 8000;

    const startUrl = `https://${competitor.domain}`;
    const queue: string[] = [startUrl];
    const visited = new Set<string>();
    const discovered = new Set<string>([startUrl]);

    const crawledPagesData: any[] = [];
    let discoveredCount = 1;
    let crawledCount = 0;
    let htmlCount = 0;
    let indexableCount = 0;
    let excludedCount = 0;

    // Fast BFS crawl up to maxPages
    while (queue.length > 0 && visited.size < maxPages) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        const fetchRes = await fetchPageHtml(currentUrl, timeoutMs);
        crawledCount++;

        if (!fetchRes.ok || fetchRes.statusCode >= 400) {
          excludedCount++;
          continue;
        }

        const isHtml = (fetchRes.contentType || "").includes("text/html") || fetchRes.html.includes("<html");
        if (!isHtml) {
          excludedCount++;
          continue;
        }
        htmlCount++;

        // Process page authoritatively
        const normalizedUrl = normalizeUrl(currentUrl);
        const processed = await processPageAuthoritatively(
          currentUrl,
          normalizedUrl,
          fetchRes.finalUrl || currentUrl,
          fetchRes.statusCode,
          fetchRes.redirectHops || [],
          fetchRes.html,
          fetchRes.headers || {},
          fetchRes.responseTimeMs || 100,
          1,
          {
            seedNormalized: normalizeUrl(startUrl),
            allowSubdomains: false,
            isDisallowedByRobots: false,
          }
        );

        if (processed.isIndexable) {
          indexableCount++;
        } else {
          excludedCount++;
        }

        crawledPagesData.push(processed);

        // Discover internal links from HTML
        const hrefMatches = fetchRes.html.matchAll(/href=["'](\/[^"']*|https?:\/\/[^"']*)["']/gi);
        for (const match of hrefMatches) {
          const rawHref = match[1];
          if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) continue;

          try {
            const absolute = new URL(rawHref, currentUrl).href;
            const normalized = normalizeUrl(absolute);
            const parsed = new URL(normalized);

            // Keep within same competitor domain
            const normDomain = competitor.domain.replace(/^www\./, "");
            const parsedDomain = parsed.hostname.replace(/^www\./, "");

            if (parsedDomain === normDomain || parsedDomain.endsWith("." + normDomain)) {
              if (!discovered.has(normalized)) {
                discovered.add(normalized);
                discoveredCount++;
                if (!visited.has(normalized) && queue.length < maxPages * 2) {
                  queue.push(normalized);
                }
              }
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      } catch (err) {
        excludedCount++;
      }
    }

    // Filter AI-eligible semantic pages
    const aiEligible = crawledPagesData.filter((p) => {
      const pClass = p.classification?.primaryClass || "general_content";
      const isUtility = pClass === "utility_legal" || pClass === "thank_you_confirmation" || pClass === "utility_endpoint";
      const isLowWord = (p.wordCount || 0) < 20 && pClass !== "homepage";
      return p.isIndexable && !isUtility && !isLowWord;
    });

    const pageContexts: CrawledPageContext[] = aiEligible.map((p) => ({
      url: p.url,
      title: p.title || null,
      metaDescription: p.metaDescription || null,
      h1Texts: p.h1s || p.h1Tags || [],
      headings: (p.headingsOutline || []).map((h: any) => h.text),
      visibleText: p.mainTextSnippet || p.html || "",
      schemaTypes: (p.schemaJsonLd || []).map((s: any) => s["@type"] || s.type).filter(Boolean),
    }));

    // Generate competitor knowledge profile from its crawled pages
    const profile = extractProjectKnowledgeProfile(
      competitor.competitorId,
      competitor.domain,
      crawledPagesData
    );

    const corpusSummary: CompetitorCorpusSummary = {
      competitorId: competitor.competitorId,
      domain: competitor.domain,
      discoveredResources: discoveredCount,
      crawledResources: crawledCount,
      htmlPages: htmlCount,
      indexableHtml: indexableCount,
      aiEligiblePages: pageContexts.length,
      excludedPages: excludedCount + (crawledCount - pageContexts.length),
      lastCrawledAt: new Date().toISOString(),
      freshness: "FRESH",
      coverageNote: `${pageContexts.length} AI-eligible semantic pages crawled and analyzed across ${competitor.domain}.`,
    };

    return {
      competitor,
      corpusSummary,
      pages: pageContexts,
      profile,
    };
  }
}
