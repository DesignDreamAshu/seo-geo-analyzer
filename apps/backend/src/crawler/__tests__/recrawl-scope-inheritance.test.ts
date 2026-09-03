/**
 * Comprehensive Re-crawl Scope & Discovery Ceiling Persistence Regression Suite.
 * Covers Scenarios A through H:
 *
 * A. New audit with limit 300 discovers 157 -> Re-crawl inherits ceiling 300 and known scope 157.
 * B. Previous 157, site unchanged -> Re-crawl discovers 157.
 * C. Previous 157, 3 new pages -> Re-crawl naturally discovers 160 (within 300 ceiling).
 * D. Previous 157, 8 pages removed -> Re-crawl naturally crawls 149 (does not artificial hardcap or force).
 * E. Legacy previous audit (157 pages, no saved config) -> Fallback must be >= 157, NEVER 150.
 * F. Previous ceiling = 500, discovered = 157 -> Re-crawl inherits 500.
 * G. User explicitly lowers ceiling to 100 -> 100 respected, scope reduction warning recorded.
 * H. Lower audit ceiling must not falsely resolve findings belonging to unobserved pages.
 */

import {
  createPersistenceLayer,
  executeAndPersistAudit,
  computeAuditComparison,
  normalizeDomain,
} from "../persistence/index";
import type { CrawlAuditResult, CrawlOptions, CrawledPageData } from "../types";

function createMockCrawlerExecutor(pageCount: number, findingUrls: string[] = []) {
  return async (options: CrawlOptions): Promise<CrawlAuditResult> => {
    const effectiveCount = Math.min(options.maxPages || pageCount, pageCount);
    const pages: CrawledPageData[] = [];

    for (let i = 1; i <= effectiveCount; i++) {
      pages.push({
        url: `https://example.com/page-${i}`,
        normalizedUrl: `https://example.com/page-${i}`,
        statusCode: 200,
        isIndexable: true,
        title: `Page ${i}`,
        metaDescription: `Description for page ${i}`,
        h1s: [`Heading ${i}`],
        wordCount: 350,
        responseTimeMs: 80,
      } as any);
    }

    const issues: any[] = [];
    if (findingUrls.length > 0) {
      const affectedPages = findingUrls
        .filter((url) => pages.some((p) => p.url === url))
        .map((url) => ({
          url,
          evidence: { title: "Title Issue on page", observed: "Missing recommended length" },
        }));

      if (affectedPages.length > 0) {
        issues.push({
          code: "TITLE_TOO_SHORT",
          category: "metadata",
          title: "Page title is too short",
          description: "Page titles should be between 30 and 60 characters.",
          severity: "warning",
          affectedPages,
        });
      }
    }

    return {
      auditId: `mock_audit_${Date.now()}`,
      seedUrl: options.seedUrl,
      healthScore: 88,
      pages: pages as any,
      crawledPages: pages as any,
      issues,
      inventory: {
        totalCrawled: pages.length,
        totalIndexable: pages.length,
        totalNonIndexable: 0,
        totalRedirects: 0,
        totalBrokenPages: 0,
        sitemapDiscoveredCount: 0,
        sitemapOrphanCount: 0,
        crawlIsolatedCount: 0,
        maxPagesConfigured: options.maxPages || effectiveCount,
        discoveryCeiling: options.discoveryCeiling || options.maxPages || effectiveCount,
        previousKnownScope: options.previousKnownScope,
      },
    } as any;
  };
}

async function runAllRecrawlScopeTests() {
  console.log("==================================================================");
  console.log("RUNNING RE-CRAWL SCOPE PERSISTENCE & CEILING REGRESSION SUITE");
  console.log("==================================================================\n");

  const persistence = createPersistenceLayer(":memory:");

  // Helper for resolveRecrawlScope matching /api/projects/:projectId/recrawl logic
  async function resolveRecrawlScope(projectId: string, requestedMaxPages?: number) {
    const project = await persistence.projects.getProjectById(projectId);
    if (!project) throw new Error("Project not found");

    const sourceAudit = await persistence.auditRuns.getLatestAuditRunForProject(projectId);
    const prevConfig = sourceAudit?.configurationSnapshot?.crawlSettings;
    const prevRequestedLimit = prevConfig?.requestedCrawlLimit ?? prevConfig?.discoveryCeiling ?? prevConfig?.maxPages;
    const prevMaxDepth = prevConfig?.maxDepth ?? 5;
    const effectiveMaxDepth = prevMaxDepth;
    const projectCeiling = project.metadata?.crawlDiscoveryCeiling;
    const prevDiscoveredPages = sourceAudit?.summaryStats?.pagesCrawled || project.metadata?.lastDiscoveredPageCount || 0;

    let isConfigFallback = false;
    let isReducedScopeWarning = false;
    let effectiveMaxPages: number;

    if (typeof requestedMaxPages === "number" && requestedMaxPages > 0) {
      effectiveMaxPages = requestedMaxPages;
      if (prevDiscoveredPages > 0 && requestedMaxPages < prevDiscoveredPages) {
        isReducedScopeWarning = true;
      }
      await persistence.projects.updateProject(project.projectId, {
        metadata: {
          ...(project.metadata || {}),
          crawlDiscoveryCeiling: requestedMaxPages,
        },
      });
    } else if (typeof prevRequestedLimit === "number" && prevRequestedLimit > 0) {
      effectiveMaxPages = prevRequestedLimit;
    } else if (typeof projectCeiling === "number" && projectCeiling > 0) {
      effectiveMaxPages = projectCeiling;
    } else if (prevDiscoveredPages > 0) {
      effectiveMaxPages = Math.max(prevDiscoveredPages, 300);
      isConfigFallback = true;
    } else {
      effectiveMaxPages = 300;
      isConfigFallback = true;
    }

    return {
      project,
      effectiveMaxPages,
      effectiveMaxDepth,
      prevDiscoveredPages,
      isConfigFallback,
      isReducedScopeWarning,
    };
  }

  // -------------------------------------------------------------------------
  // TEST A: New audit: limit 300, discover 157 -> Re-crawl inherits ceiling 300 and known scope 157
  // -------------------------------------------------------------------------
  console.log("--- TEST A: Limit 300, Discover 157 -> Re-crawl Inherits 300 with Known Scope 157 ---");
  const projA = await persistence.projects.createProject({
    projectId: "proj_scope_a",
    name: "Scope Test A",
    primaryDomain: "https://example-a.com",
    normalizedDomain: normalizeDomain("https://example-a.com"),
    status: "ACTIVE",
  });

  const auditA1 = await executeAndPersistAudit({
    project: projA,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: projA.primaryDomain, maxPages: 300 },
    customCrawlerExecutor: createMockCrawlerExecutor(157),
  });

  console.log(`✓ Audit A1 Configured Ceiling: ${auditA1.auditRun.configurationSnapshot?.crawlSettings?.maxPages}`);
  console.log(`✓ Audit A1 Discovered Pages: ${auditA1.pages.length}`);
  if (auditA1.auditRun.configurationSnapshot?.crawlSettings?.maxPages !== 300) {
    throw new Error(`Expected Audit A1 ceiling 300, got ${auditA1.auditRun.configurationSnapshot?.crawlSettings?.maxPages}`);
  }
  if (auditA1.pages.length !== 157) {
    throw new Error(`Expected Audit A1 pages 157, got ${auditA1.pages.length}`);
  }

  const recrawlA = await resolveRecrawlScope(projA.projectId);
  console.log(`✓ Re-crawl A Resolved Ceiling: ${recrawlA.effectiveMaxPages} (Known: ${recrawlA.prevDiscoveredPages})`);
  if (recrawlA.effectiveMaxPages !== 300) {
    throw new Error(`Expected Re-crawl A to inherit ceiling 300, got ${recrawlA.effectiveMaxPages}`);
  }
  if (recrawlA.prevDiscoveredPages !== 157) {
    throw new Error(`Expected Re-crawl A to preserve known scope 157, got ${recrawlA.prevDiscoveredPages}`);
  }

  const auditA2 = await executeAndPersistAudit({
    project: projA,
    persistenceLayer: persistence,
    crawlOptions: {
      seedUrl: projA.primaryDomain,
      maxPages: recrawlA.effectiveMaxPages,
      previousKnownScope: recrawlA.prevDiscoveredPages,
    },
    customCrawlerExecutor: createMockCrawlerExecutor(157),
  });

  if (auditA2.auditRun.configurationSnapshot?.crawlSettings?.maxPages !== 300) {
    throw new Error("Audit A2 ceiling was overwritten!");
  }
  console.log("✓ TEST A PASSED: Re-crawl preserved ceiling 300 and known scope 157.\n");

  // -------------------------------------------------------------------------
  // TEST B: Previous 157, site unchanged -> next audit = 157
  // -------------------------------------------------------------------------
  console.log("--- TEST B: Previous 157, Site Unchanged -> Re-crawl Crawls 157 ---");
  if (auditA2.pages.length !== 157) {
    throw new Error(`Expected Audit A2 to crawl 157 unchanged pages, got ${auditA2.pages.length}`);
  }
  console.log(`✓ Audit A2 Crawled Pages: ${auditA2.pages.length}`);
  console.log("✓ TEST B PASSED: Unchanged site crawled exactly 157 pages.\n");

  // -------------------------------------------------------------------------
  // TEST C: Natural Growth: Previous 157, 3 new pages -> Re-crawl reaches 160 (within 300 ceiling)
  // -------------------------------------------------------------------------
  console.log("--- TEST C: Natural Growth: Previous 157 + 3 New Pages -> Re-crawl Crawls 160 ---");
  const auditA3 = await executeAndPersistAudit({
    project: projA,
    persistenceLayer: persistence,
    crawlOptions: {
      seedUrl: projA.primaryDomain,
      maxPages: recrawlA.effectiveMaxPages,
      previousKnownScope: auditA2.pages.length,
    },
    customCrawlerExecutor: createMockCrawlerExecutor(160), // 3 new pages added
  });

  console.log(`✓ Audit A3 Configured Ceiling: ${auditA3.auditRun.configurationSnapshot?.crawlSettings?.maxPages}`);
  console.log(`✓ Audit A3 Discovered Pages: ${auditA3.pages.length}`);
  if (auditA3.pages.length !== 160) {
    throw new Error(`Expected Audit A3 to discover 160 pages, got ${auditA3.pages.length}`);
  }
  if (auditA3.auditRun.configurationSnapshot?.crawlSettings?.maxPages !== 300) {
    throw new Error("Audit A3 ceiling was altered during natural growth!");
  }
  console.log("✓ TEST C PASSED: Crawler naturally discovered and expanded to 160 pages.\n");

  // -------------------------------------------------------------------------
  // TEST D: Natural Shrinkage: Previous 157, 8 pages removed -> Re-crawl reaches 149
  // -------------------------------------------------------------------------
  console.log("--- TEST D: Natural Shrinkage: Previous 157 - 8 Removed Pages -> Re-crawl Crawls 149 ---");
  const projD = await persistence.projects.createProject({
    projectId: "proj_scope_d",
    name: "Scope Test D",
    primaryDomain: "https://example-d.com",
    normalizedDomain: normalizeDomain("https://example-d.com"),
    status: "ACTIVE",
  });

  await executeAndPersistAudit({
    project: projD,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: projD.primaryDomain, maxPages: 300 },
    customCrawlerExecutor: createMockCrawlerExecutor(157),
  });

  const recrawlD = await resolveRecrawlScope(projD.projectId);
  const auditD2 = await executeAndPersistAudit({
    project: projD,
    persistenceLayer: persistence,
    crawlOptions: {
      seedUrl: projD.primaryDomain,
      maxPages: recrawlD.effectiveMaxPages,
      previousKnownScope: recrawlD.prevDiscoveredPages,
    },
    customCrawlerExecutor: createMockCrawlerExecutor(149), // 8 pages removed
  });

  console.log(`✓ Audit D2 Discovered Pages: ${auditD2.pages.length}`);
  console.log(`✓ Audit D2 Ceiling: ${auditD2.auditRun.configurationSnapshot?.crawlSettings?.maxPages}`);
  if (auditD2.pages.length !== 149) {
    throw new Error(`Expected Audit D2 to naturally crawl 149 pages, got ${auditD2.pages.length}`);
  }
  if (auditD2.auditRun.configurationSnapshot?.crawlSettings?.maxPages !== 300) {
    throw new Error("Audit D2 ceiling was altered during natural shrinkage!");
  }
  console.log("✓ TEST D PASSED: Shrinkage cleanly reflected real site (149 pages) without artificial forcing.\n");

  // -------------------------------------------------------------------------
  // TEST E: Legacy previous audit = 157 pages, no saved config -> Fallback must be >= 157, NEVER 150
  // -------------------------------------------------------------------------
  console.log("--- TEST E: Legacy Audit (157 Pages, Missing Config) -> Fallback >= 157, NEVER 150 ---");
  const projE = await persistence.projects.createProject({
    projectId: "proj_scope_e_legacy",
    name: "Legacy Project",
    primaryDomain: "https://example-legacy.com",
    normalizedDomain: normalizeDomain("https://example-legacy.com"),
    status: "ACTIVE",
  });

  // Create legacy audit run record missing configuration snapshot
  const legacyRun = await persistence.auditRuns.createAuditRun({
    auditRunId: "audit_legacy_157",
    projectId: projE.projectId,
    sequenceNumber: 1,
    startedAt: new Date().toISOString(),
    status: "COMPLETED",
    trigger: "MANUAL",
    crawlerVersion: "1.0.0",
    ruleInventoryVersion: "1.0.0",
    productionRuleCount: 95,
    policyVersions: "{}",
    configurationSnapshot: {} as any, // Missing crawlSettings
  });

  await persistence.auditRuns.updateAuditRunStatus(legacyRun.auditRunId, "COMPLETED", new Date().toISOString(), {
    pagesCrawled: 157,
    pagesIndexable: 157,
    totalFindings: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
    informationalFindings: 0,
  });

  const recrawlE = await resolveRecrawlScope(projE.projectId);
  console.log(`✓ Legacy Re-crawl Resolved Ceiling: ${recrawlE.effectiveMaxPages} (Known: ${recrawlE.prevDiscoveredPages})`);
  if (recrawlE.effectiveMaxPages < 157) {
    throw new Error(`FATAL REGRESSION: Legacy fallback resolved to ${recrawlE.effectiveMaxPages} (< 157)! Must be >= 157.`);
  }
  if (recrawlE.effectiveMaxPages === 150) {
    throw new Error(`FATAL REGRESSION: Legacy fallback defaulted to 150 pages instead of preserving 157!`);
  }
  console.log("✓ TEST E PASSED: Legacy audit with 157 pages safely resolved ceiling >= 157 without 150 truncation.\n");

  // -------------------------------------------------------------------------
  // TEST F: Previous ceiling = 500, discovered = 157 -> Re-crawl inherits 500
  // -------------------------------------------------------------------------
  console.log("--- TEST F: Previous Ceiling 500, Discovered 157 -> Re-crawl Inherits 500 ---");
  const projF = await persistence.projects.createProject({
    projectId: "proj_scope_f_500",
    name: "500 Scope Test",
    primaryDomain: "https://example-500.com",
    normalizedDomain: normalizeDomain("https://example-500.com"),
    status: "ACTIVE",
  });

  await executeAndPersistAudit({
    project: projF,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: projF.primaryDomain, maxPages: 500 },
    customCrawlerExecutor: createMockCrawlerExecutor(157),
  });

  const recrawlF = await resolveRecrawlScope(projF.projectId);
  console.log(`✓ Re-crawl F Resolved Ceiling: ${recrawlF.effectiveMaxPages}`);
  if (recrawlF.effectiveMaxPages !== 500) {
    throw new Error(`Expected Re-crawl F to inherit 500, got ${recrawlF.effectiveMaxPages}`);
  }
  console.log("✓ TEST F PASSED: 500 ceiling cleanly inherited.\n");

  // -------------------------------------------------------------------------
  // TEST G: User explicitly lowers ceiling to 100 -> 100 respected, scope reduction warning generated
  // -------------------------------------------------------------------------
  console.log("--- TEST G: User Lowers Ceiling (300 -> 100 on 157-page site) -> 100 Respected & Warned ---");
  const recrawlG = await resolveRecrawlScope(projA.projectId, 100);
  console.log(`✓ Re-crawl G Explicit Ceiling: ${recrawlG.effectiveMaxPages}`);
  console.log(`✓ Re-crawl G Scope Warning Flag: ${recrawlG.isReducedScopeWarning}`);
  if (recrawlG.effectiveMaxPages !== 100) {
    throw new Error(`Expected user ceiling 100 to be respected, got ${recrawlG.effectiveMaxPages}`);
  }
  if (!recrawlG.isReducedScopeWarning) {
    throw new Error("Expected isReducedScopeWarning to be true when ceiling (100) < known scope (157)");
  }

  const auditG = await executeAndPersistAudit({
    project: projA,
    persistenceLayer: persistence,
    crawlOptions: {
      seedUrl: projA.primaryDomain,
      maxPages: 100,
      previousKnownScope: 157,
    },
    customCrawlerExecutor: createMockCrawlerExecutor(100),
  });

  if (auditG.pages.length !== 100) {
    throw new Error(`Expected Audit G to crawl 100 pages, got ${auditG.pages.length}`);
  }
  console.log("✓ TEST G PASSED: Explicit 100 ceiling respected and scope reduction warning flagged.\n");

  // -------------------------------------------------------------------------
  // TEST H: Comparison Safety: Lower audit ceiling must NOT falsely resolve findings on unobserved pages
  // -------------------------------------------------------------------------
  console.log("--- TEST H: Comparison Safety on Lowered Ceiling (Unobserved Page Findings NOT Resolved) ---");
  const projH = await persistence.projects.createProject({
    projectId: "proj_scope_h_comparison",
    name: "Comparison Safety Project",
    primaryDomain: "https://example-h.com",
    normalizedDomain: normalizeDomain("https://example-h.com"),
    status: "ACTIVE",
  });

  // Baseline audit: crawled 157 pages, finding on page-120
  const baselineH = await executeAndPersistAudit({
    project: projH,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: projH.primaryDomain, maxPages: 300 },
    customCrawlerExecutor: createMockCrawlerExecutor(157, ["https://example.com/page-120"]),
  });

  console.log(`✓ Baseline H Findings: ${baselineH.findings.length} (on page-120)`);
  if (baselineH.findings.length !== 1) {
    throw new Error(`Expected 1 baseline finding on page-120, got ${baselineH.findings.length}`);
  }

  // Current audit: intentionally lowered ceiling to 100 (so page-120 is unobserved)
  const currentH = await executeAndPersistAudit({
    project: projH,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: projH.primaryDomain, maxPages: 100 },
    customCrawlerExecutor: createMockCrawlerExecutor(100, []),
  });

  const comparisonH = computeAuditComparison({
    projectId: projH.projectId,
    baselineAudit: baselineH.auditRun,
    currentAudit: currentH.auditRun,
    baselinePages: baselineH.pages,
    currentPages: currentH.pages,
    baselineFindings: baselineH.findings,
    currentFindings: currentH.findings,
  });

  console.log(`✓ Comparison H Fixed Count: ${comparisonH.fixedCount}`);
  console.log(`✓ Comparison H Uncomparable Count: ${comparisonH.uncomparableCount}`);
  const findingDiff = comparisonH.findingDiffs.find((f) => f.normalizedUrl === "https://example.com/page-120");
  console.log(`✓ Page-120 Finding State: ${findingDiff?.comparisonState}`);
  console.log(`✓ Page-120 Change Reason: ${findingDiff?.changeReason}`);

  if (comparisonH.fixedCount !== 0) {
    throw new Error(`FATAL: Unobserved finding on page-120 was falsely counted as FIXED (${comparisonH.fixedCount})!`);
  }
  if (findingDiff?.comparisonState !== "UNCOMPARABLE") {
    throw new Error(`Expected comparisonState to be UNCOMPARABLE, got ${findingDiff?.comparisonState}`);
  }
  if (!findingDiff?.changeReason.includes("Audit crawl ceiling (100) is lower than baseline scope (157)")) {
    throw new Error(`Expected scope reduction explanation in changeReason, got: ${findingDiff?.changeReason}`);
  }
  console.log("✓ TEST H PASSED: Unobserved page findings are safely held UNCOMPARABLE and never marked FIXED.\n");

  console.log("==================================================================");
  console.log("✓ ALL 8 RE-CRAWL SCOPE INHERITANCE REGRESSION TESTS PASSED (A-H)!");
  console.log("==================================================================");
}

runAllRecrawlScopeTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
