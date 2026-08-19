import { nanoid } from "nanoid";
import { normalizeUrl, isUrlInScope, isCrawlTrap } from "./normalizer";
import { fetchAndParseRobotsTxt } from "./robots";
import { fetchAllSitemaps } from "./sitemap";
import { fetchPageHtml, sharedBrowserPool } from "./fetcher";
import { parseHtmlPage } from "./parser";
import { buildAndAnalyzeGraph } from "./graph";
import { evaluateAllDiagnosticRules } from "./rules";
import type {
  CrawlAuditResult,
  CrawlOptions,
  CrawledPageData,
  CrawlInventory,
  CrawlProgress,
  CrawlTerminationReason,
} from "./types";

/**
 * Main Sitechecker-grade Multi-Page Site Crawler Engine.
 */
export async function runSiteAuditCrawl(options: CrawlOptions): Promise<CrawlAuditResult> {
  const startedAt = new Date();
  const seedNormalized = normalizeUrl(options.seedUrl);
  if (!seedNormalized) {
    throw new Error(`Invalid seed URL provided: ${options.seedUrl}`);
  }

  const maxPages = Math.min(1000, Math.max(5, options.maxPages || 50));
  const maxDepth = options.maxDepth || 5;
  const concurrency = Math.min(10, Math.max(1, options.concurrency || 5));
  const seedOrigin = new URL(seedNormalized);

  const reportProgress = (progress: Partial<CrawlProgress>) => {
    if (options.onProgress) {
      options.onProgress({
        crawledPages: 0,
        queuedPages: 0,
        maxPages,
        currentUrl: seedNormalized,
        percent: 0,
        status: "crawling",
        ...progress,
      });
    }
  };

  console.log(`\n========================================`);
  console.log(`[Crawler] STARTING SITE AUDIT CRAWL`);
  console.log(`[Crawler] Target Seed: ${seedNormalized}`);
  console.log(`[Crawler] Max Pages: ${maxPages} | Max Depth: ${maxDepth} | Concurrency: ${concurrency}`);
  console.log(`========================================`);

  // 1. Robots.txt and Sitemap Discovery
  reportProgress({ status: "discovering_sitemap", currentUrl: seedNormalized, percent: 5 });

  const robots = await fetchAndParseRobotsTxt(seedOrigin, options.signal);
  console.log(`[Crawler] robots.txt parsed: ${robots.text ? "Found" : "None"} | Sitemaps: ${robots.sitemaps.length}`);

  const sitemapResult = await fetchAllSitemaps(seedNormalized, robots.sitemaps, options.signal);
  console.log(`[Crawler] Discovered ${sitemapResult.urls.length} URLs from ${sitemapResult.sitemapFiles.length} sitemaps`);

  // 2. Initialize Crawl Queue
  interface QueueItem {
    url: string;
    normalizedUrl: string;
    depth: number;
  }

  const queue: QueueItem[] = [{ url: options.seedUrl, normalizedUrl: seedNormalized, depth: 0 }];
  const queuedSet = new Set<string>([seedNormalized]);
  const crawledMap = new Map<string, CrawledPageData>();

  // Add all discovered sitemap URLs into the queue as seeds up to maxPages
  for (const sitemapEntry of sitemapResult.urls.slice(0, maxPages)) {
    if (!queuedSet.has(sitemapEntry.loc) && isUrlInScope(sitemapEntry.loc, seedNormalized, options.allowSubdomains)) {
      queuedSet.add(sitemapEntry.loc);
      queue.push({
        url: sitemapEntry.loc,
        normalizedUrl: sitemapEntry.loc,
        depth: 1,
      });
      console.log(`[Crawler] Enqueued from sitemap: ${sitemapEntry.loc}`);
    }
  }

  // 3. BFS Async Crawling Loop with Per-Page Resilience
  reportProgress({ status: "crawling", currentUrl: seedNormalized, percent: 10 });

  while (queue.length > 0 && crawledMap.size < maxPages) {
    if (options.signal?.aborted) {
      break;
    }

    // Grab next batch based on concurrency
    const batch = queue.splice(0, Math.min(concurrency, maxPages - crawledMap.size));

    await Promise.allSettled(
      batch.map(async (item) => {
        if (crawledMap.size >= maxPages || options.signal?.aborted) return;

        const currentCrawledCount = crawledMap.size;
        console.log(`[CRAWL LOOP] Crawled: ${currentCrawledCount}/${maxPages} | Queue: ${queue.length} | Target: ${item.url}`);

        if (currentCrawledCount >= 50) {
          console.log(`[CRAWL BEYOND 50] Processing item #${currentCrawledCount + 1}: ${item.url}`);
        }

        try {
          // Normalize item URL safely
          const itemNormalized = item.normalizedUrl || normalizeUrl(item.url) || item.url;

          // Check if disallowed by robots.txt
          let isDisallowed = false;
          try {
            const urlObj = new URL(itemNormalized.startsWith("http") ? itemNormalized : `https://${itemNormalized}`);
            isDisallowed = options.respectRobotsTxt !== false && robots.isUrlDisallowed(urlObj.pathname);
          } catch {
            isDisallowed = false;
          }

          // Fetch HTML with per-page timeout
          const fetchRes = await fetchPageHtml(item.url, options.timeoutMs || 10000, options.signal);

          // Parse HTML
          const pageData = parseHtmlPage(
            item.url,
            itemNormalized,
            fetchRes.finalUrl,
            fetchRes.statusCode,
            fetchRes.redirectHops,
            fetchRes.html,
            fetchRes.headers,
            fetchRes.responseTimeMs,
            item.depth,
            seedNormalized,
            options.allowSubdomains,
            isDisallowed,
          );

          // Conditional Render Trigger for dynamic CMS shells / interactive forms
          if (pageData.resourceType === "html_page" && pageData.statusCode === 200) {
            const urlLower = pageData.url.toLowerCase();
            const pClass = pageData.classification.primaryClass;
            const h1First = pageData.h1s[0]?.toLowerCase().trim();
            const shouldRender =
              (pageData.visibleBodyWordCount < 50 && (pClass === "active_job" || urlLower.includes("/job-openings/") || urlLower.includes("/servicenow-at-bot"))) ||
              h1First === "heading" ||
              ((pClass === "form_application" || urlLower.includes("/application")) && pageData.forms.length === 0);

            if (shouldRender) {
              try {
                const browser = await sharedBrowserPool.getBrowser();
                if (browser) {
                  const ctx = await browser.newContext({
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                  });
                  const p = await ctx.newPage();
                  await p.goto(pageData.url, { waitUntil: "domcontentloaded", timeout: 12000 });
                  await p.waitForTimeout(400);

                  const rendered = await p.evaluate(() => {
                    const docTitle = document.title ? document.title.trim() : null;
                    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
                    const canonicalTag = document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;
                    const h1s = Array.from(document.querySelectorAll("h1")).map((n) => (n.textContent || "").trim()).filter(Boolean);

                    const mainEl = document.querySelector("main, [role='main'], #main-content, .main-content") as HTMLElement | null;
                    const bodyClone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
                    let visWords = 0;
                    if (bodyClone) {
                      bodyClone.querySelectorAll("script, style, noscript, svg, nav, footer, header").forEach((el) => el.remove());
                      const t = (bodyClone.innerText || "").replace(/\s+/g, " ").trim();
                      visWords = t ? t.split(/\s+/).filter(Boolean).length : 0;
                    }
                    let mainWords = visWords;
                    if (mainEl) {
                      const mc = mainEl.cloneNode(true) as HTMLElement;
                      mc.querySelectorAll("script, style, noscript, svg, nav, footer, header").forEach((el) => el.remove());
                      const mt = (mc.innerText || "").replace(/\s+/g, " ").trim();
                      mainWords = mt ? mt.split(/\s+/).filter(Boolean).length : visWords;
                    }

                    const forms = Array.from(document.querySelectorAll("form")).map((f) => {
                      const inputs = Array.from(f.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select"));
                      let unlabelled = 0;
                      inputs.forEach((input) => {
                        const id = input.getAttribute("id");
                        const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false;
                        const hasAria = Boolean(input.getAttribute("aria-label") || input.getAttribute("aria-labelledby"));
                        const isWrapped = Boolean(input.closest("label"));
                        if (!hasLabel && !hasAria && !isWrapped) unlabelled++;
                      });
                      return {
                        id: f.id || undefined,
                        action: f.action || undefined,
                        method: f.method || undefined,
                        controlCount: inputs.length,
                        unlabelledCount: unlabelled,
                        controls: inputs.map((c) => ({
                          tag: c.tagName.toLowerCase(),
                          type: c.getAttribute("type") || undefined,
                          name: c.getAttribute("name") || undefined,
                          id: c.getAttribute("id") || undefined,
                          accessibleName: c.getAttribute("aria-label") || null,
                          isLabelled: Boolean(c.getAttribute("aria-label") || (c.id && document.querySelector(`label[for="${c.id}"]`)) || c.closest("label")),
                        })),
                      };
                    });

                    const missingAlt = Array.from(document.querySelectorAll("img")).filter((img) => !img.hasAttribute("alt")).length;
                    const hasMain = document.querySelectorAll("main, [role='main']").length > 0;

                    return { docTitle, metaDesc, canonicalTag, h1s, visWords, mainWords, forms, missingAlt, hasMain };
                  });

                  await ctx.close();

                  pageData.renderedFacts = {
                    attempted: true,
                    success: true,
                    renderedAt: new Date().toISOString(),
                    renderReason: "dynamic_shell_detected",
                    renderConfidence: "high",
                    title: rendered.docTitle,
                    metaDescription: rendered.metaDesc,
                    canonicalUrl: rendered.canonicalTag,
                    h1Count: rendered.h1s.length,
                    h1Texts: rendered.h1s,
                    formCount: rendered.forms.length,
                    unlabelledFormControlCount: rendered.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
                    missingAltCount: rendered.missingAlt,
                    visibleBodyWordCount: rendered.visWords,
                    mainContentWordCount: rendered.mainWords,
                    hasMainLandmark: rendered.hasMain,
                  };

                  pageData.authoritativeFacts = {
                    source: "rendered",
                    title: rendered.docTitle || pageData.title,
                    metaDescription: rendered.metaDesc || pageData.metaDescription,
                    canonicalUrl: rendered.canonicalTag || pageData.canonicalUrl,
                    h1Count: rendered.h1s.length,
                    h1Texts: rendered.h1s,
                    formCount: rendered.forms.length,
                    unlabelledFormControlCount: rendered.forms.reduce((sum, f) => sum + f.unlabelledCount, 0),
                    missingAltCount: rendered.missingAlt,
                    rawDocumentWordCount: pageData.rawDocumentWordCount,
                    visibleBodyWordCount: rendered.visWords,
                    mainContentWordCount: rendered.mainWords,
                    hasMainLandmark: rendered.hasMain,
                  };

                  pageData.renderMode = "playwright_rendered";
                  pageData.renderReason = "dynamic_shell_detected";
                  pageData.renderConfidence = "high";
                  if (rendered.docTitle) pageData.title = rendered.docTitle;
                  if (rendered.h1s.length > 0) {
                    pageData.h1s = rendered.h1s;
                    pageData.h1Count = rendered.h1s.length;
                    pageData.h1Tags = rendered.h1s;
                  }
                  if (rendered.forms.length > 0) {
                    pageData.forms = rendered.forms;
                  }
                  pageData.visibleBodyWordCount = rendered.visWords;
                  pageData.mainContentWordCount = rendered.mainWords;
                  pageData.wordCount = rendered.mainWords > 0 ? rendered.mainWords : rendered.visWords;
                }
              } catch (rErr: any) {
                pageData.renderedFacts = {
                  attempted: true,
                  success: false,
                  renderReason: "dynamic_shell_detected",
                  renderConfidence: "manual_review",
                };
              }
            }
          }

          crawledMap.set(itemNormalized, pageData);
          console.log(`[Crawler] [${crawledMap.size}/${maxPages}] Fetched: ${pageData.statusCode} | ${pageData.responseTimeMs}ms | ${item.url} (Title: "${pageData.title || "Untitled"}")`);

          // Enqueue newly discovered internal links if depth allows
          if (item.depth < maxDepth && fetchRes.ok) {
            for (const outlink of pageData.outlinks) {
              if (outlink.isInternal && outlink.normalizedTargetUrl && !queuedSet.has(outlink.normalizedTargetUrl)) {
                if (!isCrawlTrap(outlink.normalizedTargetUrl)) {
                  queuedSet.add(outlink.normalizedTargetUrl);
                  queue.push({
                    url: outlink.targetUrl,
                    normalizedUrl: outlink.normalizedTargetUrl,
                    depth: item.depth + 1,
                  });
                }
              }
            }
          }
        } catch (pageErr) {
          console.warn(`[Crawler] Warning: Failed to crawl page ${item.url}:`, (pageErr as Error).message);
          // Insert a graceful error record so link graph & counts stay accurate
          const fallbackNorm = item.normalizedUrl || normalizeUrl(item.url) || item.url;
          crawledMap.set(fallbackNorm, {
            url: item.url,
            requestedUrl: item.url,
            normalizedUrl: item.normalizedUrl,
            finalUrl: item.url,
            statusCode: 0,
            redirectHops: [],
            contentType: "text/html",
            resourceType: "html_page",
            responseTimeMs: 0,
            depth: item.depth,
            html: "",
            headers: {},
            crawledAt: new Date().toISOString(),
            sourceMode: "raw_http",

            // Rendering facts
            renderMode: "raw",
            renderReason: "fetch_error",
            renderConfidence: "high",
            rawWordCount: 0,
            rawDocumentWordCount: 0,
            visibleBodyWordCount: 0,
            mainContentWordCount: 0,
            renderedWordCount: 0,
            rawH1Count: 0,
            renderedH1Count: 0,
            rawTitle: null,
            renderedTitle: null,
            soft404Status: "valid_page",

            title: null,
            titleLength: 0,
            metaDescription: null,
            metaDescriptionLength: 0,
            canonicalUrl: null,
            isCanonicalSelfReferencing: false,
            isCanonicalTargetReachable: false,
            metaRobots: null,
            xRobotsTag: null,
            isIndexable: false,
            indexabilityStatus: "technically_non_indexable",
            h1s: [],
            h1Count: 0,
            h1Tags: [],
            h2Tags: [],
            h3Tags: [],
            headingsOutline: [],
            headingsHierarchyValid: true,
            headingsHierarchyIssues: [],
            wordCount: 0,
            textToHtmlRatio: 0,
            landmarks: { hasMain: false, mainCount: 0, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
            forms: [],
            images: [],
            resources: [],
            outlinks: [],
            openGraph: {},
            twitterCard: {},
            schemaJsonLd: [],
            classification: { primaryClass: "error", confidence: 1.0, signals: ["crawl_fetch_error"] },
          });
        }

        const currentCount = crawledMap.size;
        const progressPercent = Math.min(80, Math.round(10 + (currentCount / maxPages) * 70));
        reportProgress({
          crawledPages: currentCount,
          queuedPages: queue.length,
          currentUrl: item.url,
          percent: progressPercent,
        });
      })
    );
  }

  let terminationReason: CrawlTerminationReason = "queue_exhausted";
  if (crawledMap.size >= maxPages) {
    terminationReason = "max_pages_reached";
  } else if (options.signal?.aborted) {
    terminationReason = "cancelled";
  }

  const crawledPages = Array.from(crawledMap.values());
  console.log(`\n[Crawler] Crawl phase finished. Total pages retrieved: ${crawledPages.length} | Termination Reason: ${terminationReason}`);

  // 4. Build Link Graph & Analyze Inlinks / Outlinks / Sitemap Orphans
  reportProgress({ status: "analyzing_graph", percent: 85 });
  const graphAnalysis = await buildAndAnalyzeGraph(crawledPages, sitemapResult.urls, options.signal);
  console.log(`[Crawler] Graph built: ${graphAnalysis.totalInternalLinks} internal links, ${graphAnalysis.totalExternalLinks} external links, ${graphAnalysis.sitemapOrphans.length} sitemap orphans`);

  // 5. Evaluate All 10 Diagnostic Check Categories
  reportProgress({ status: "evaluating_rules", percent: 95 });
  const ruleResults = evaluateAllDiagnosticRules(crawledPages, graphAnalysis, graphAnalysis.sitemapOrphans);
  console.log(`[Crawler] Evaluated diagnostic rules. Total issues: ${ruleResults.issues.length} | Health Score: ${ruleResults.healthScore}/100`);

  const completedAt = new Date();

  // 6. Compile Crawl Inventory
  const indexablePages = crawledPages.filter((p) => p.isIndexable);
  const redirects = crawledPages.filter((p) => p.redirectHops.length > 0);
  const brokenPages = crawledPages.filter((p) => p.statusCode >= 400);

  const inventory: CrawlInventory = {
    totalCrawled: crawledPages.length,
    totalIndexable: indexablePages.length,
    totalNonIndexable: crawledPages.length - indexablePages.length,
    totalRedirects: redirects.length,
    totalBrokenPages: brokenPages.length,
    sitemapDiscoveredCount: sitemapResult.urls.length,
    sitemapOrphanCount: graphAnalysis.sitemapOrphans.length,
    crawlIsolatedCount: graphAnalysis.crawlIsolatedPages.length,
  };

  const severityCounts = {
    critical: ruleResults.issues.filter((i) => i.severity === "critical").length,
    warnings: ruleResults.issues.filter((i) => i.severity === "warning").length,
    opportunities: ruleResults.issues.filter((i) => i.severity === "opportunity").length,
    notices: ruleResults.issues.filter((i) => i.severity === "notice").length,
  };

  reportProgress({ status: "completed", percent: 100 });

  const finalResult: CrawlAuditResult = {
    auditId: nanoid(12),
    seedUrl: options.seedUrl,
    normalizedSeedUrl: seedNormalized,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    terminationReason,
    healthScore: ruleResults.healthScore,
    auditCoveragePercent: ruleResults.auditCoveragePercent,
    scoreBreakdown: ruleResults.scoreBreakdown,
    inventory,
    severityCounts,
    categories: ruleResults.categories,
    issues: ruleResults.issues,
    // Strip raw HTML from client response to keep payloads light and fast
    crawledPages: crawledPages.map(({ html: _, ...rest }) => rest),
    sitemapOrphans: graphAnalysis.sitemapOrphans,
    linkGraphSummary: {
      totalInternalLinks: graphAnalysis.totalInternalLinks,
      totalExternalLinks: graphAnalysis.totalExternalLinks,
      brokenInternalLinksCount: graphAnalysis.brokenInternalLinks.length,
      brokenExternalLinksCount: graphAnalysis.brokenExternalLinks.length,
      botBlockedExternalCount: graphAnalysis.botBlockedExternalLinks.length,
      externalLinkTelemetry: graphAnalysis.externalLinkTelemetry,
    },
  };

  console.log(`\n========================================`);
  console.log(`[Crawler Engine FINAL RETURN]`);
  console.log(`Audit ID: ${finalResult.auditId}`);
  console.log(`Crawled Pages Count: ${finalResult.crawledPages.length}`);
  console.log(`Indexable Pages: ${finalResult.inventory.totalIndexable}`);
  console.log(`Issues Generated: ${finalResult.issues.length}`);
  console.log(`Severity Breakdown:`, finalResult.severityCounts);
  console.log(`Website Health Score: ${finalResult.healthScore}/100`);
  console.log(`========================================\n`);

  return finalResult;
}
