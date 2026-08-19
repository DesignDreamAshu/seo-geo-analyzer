import { runSiteAuditCrawl } from "../engine";
import fs from "fs";
import path from "path";

async function runLiveAudit() {
  const runId = `audit-run-${Date.now()}`;
  const gitSha = "63731e1";
  const startedAtIso = new Date().toISOString();

  console.log("==================================================");
  console.log("  STARTING FULL LIVE AUDIT: https://www.botconsulting.io/");
  console.log(`  Run ID: ${runId} | Git SHA: ${gitSha} | Started: ${startedAtIso}`);
  console.log("==================================================");

  const startTime = Date.now();
  const result = await runSiteAuditCrawl({
    seedUrl: "https://www.botconsulting.io/",
    maxPages: 300,
    concurrency: 5,
    onProgress: (prog) => {
      if (prog.crawledPages % 20 === 0 || prog.status === "completed") {
        console.log(
          `[Progress ${prog.percent}%] Crawled: ${prog.crawledPages}/${prog.maxPages} | Queued: ${prog.queuedPages} | Current: ${prog.currentUrl}`
        );
      }
    },
  });

  const durationSec = Math.round((Date.now() - startTime) / 1000);

  console.log("\n==================================================");
  console.log("  FULL LIVE AUDIT SUMMARY & TELEMETRY");
  console.log("==================================================");
  console.log(`Audit ID: ${result.auditId}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Git SHA: ${gitSha}`);
  console.log(`Seed URL: ${result.seedUrl}`);
  console.log(`Duration: ${durationSec}s (${result.durationMs}ms)`);
  console.log(`Termination Reason: ${result.terminationReason}`);
  console.log(`Pages Crawled: ${result.inventory.totalCrawled}`);
  console.log(`Indexable Pages: ${result.inventory.totalIndexable}`);
  console.log(`Non-Indexable Pages: ${result.inventory.totalNonIndexable}`);
  console.log(`Redirects Found: ${result.inventory.totalRedirects}`);
  console.log(`Broken Pages: ${result.inventory.totalBrokenPages}`);
  console.log(`Sitemap URLs Discovered: ${result.inventory.sitemapDiscoveredCount}`);
  console.log(`Sitemap Orphans: ${result.inventory.sitemapOrphanCount}`);
  console.log(`Crawl Isolated Pages: ${result.inventory.crawlIsolatedCount}`);
  console.log(`Website Health Score: ${result.healthScore}/100`);
  console.log(`Audit Coverage: ${result.auditCoveragePercent}%`);
  console.log(`Severity Totals:`, result.severityCounts);
  console.log(`Issues Generated: ${result.issues.length}`);

  // Inspect Resource Types
  const resourceTypeCounts: Record<string, number> = {};
  const indexabilityCounts: Record<string, number> = {};
  const renderModeCounts: Record<string, number> = {};
  const pageClassCounts: Record<string, number> = {};

  for (const p of result.crawledPages) {
    resourceTypeCounts[p.resourceType] = (resourceTypeCounts[p.resourceType] || 0) + 1;
    indexabilityCounts[p.indexabilityStatus] = (indexabilityCounts[p.indexabilityStatus] || 0) + 1;
    renderModeCounts[p.renderMode] = (renderModeCounts[p.renderMode] || 0) + 1;
    pageClassCounts[p.classification?.primaryClass || "unknown"] =
      (pageClassCounts[p.classification?.primaryClass || "unknown"] || 0) + 1;
  }

  console.log("\n[Resource Type Breakdown]:", resourceTypeCounts);
  console.log("[Indexability Status Breakdown]:", indexabilityCounts);
  console.log("[Render Mode Breakdown]:", renderModeCounts);
  console.log("[Page Class Breakdown]:", pageClassCounts);

  console.log("\n==================================================");
  console.log("  REPRESENTATIVE GOLDEN URL AUDIT SAMPLE");
  console.log("==================================================");

  const keyUrls = [
    "https://www.botconsulting.io/",
    "https://www.botconsulting.io/about-us",
    "https://www.botconsulting.io/solutions",
    "https://www.botconsulting.io/odyssey",
    "https://www.botconsulting.io/servicenow-at-bot",
    "https://www.botconsulting.io/contact-us",
    "https://www.botconsulting.io/job-openings/data-architect",
    "https://www.botconsulting.io/post/2025-year-in-review",
    "https://www.botconsulting.io/sitemap.xml",
  ];

  for (const ku of keyUrls) {
    const page = result.crawledPages.find(
      (p) => p.url === ku || p.normalizedUrl === ku || p.finalUrl === ku
    );
    if (page) {
      console.log(`\nURL: ${page.url}`);
      console.log(
        `  - Status: ${page.statusCode} | Resource: ${page.resourceType} | Indexable: ${page.isIndexable} (${page.indexabilityStatus})`
      );
      console.log(`  - Title (${page.titleLength}ch): "${page.title}"`);
      console.log(`  - H1 Count: ${page.h1Count} | H1s: ${JSON.stringify(page.h1s)}`);
      console.log(
        `  - Word Counts: Main=${page.mainContentWordCount || page.wordCount}, Visible=${page.visibleBodyWordCount || page.wordCount}, Raw=${page.rawDocumentWordCount || page.rawWordCount}`
      );
      console.log(`  - Landmarks: main=${page.landmarks?.hasMain} (count=${page.landmarks?.mainCount})`);
      console.log(`  - Canonical: ${page.canonicalUrl} | Self-ref: ${page.isCanonicalSelfReferencing}`);
    } else {
      console.log(`\nURL: ${ku} -> Not crawled or outside crawl graph`);
    }
  }

  console.log("\n==================================================");
  console.log("  ALL DIAGNOSTIC ISSUES DETECTED");
  console.log("==================================================");
  for (const iss of result.issues) {
    console.log(
      `[${iss.severity.toUpperCase()}] ${iss.code}: ${iss.title} (${iss.affectedUniquePages} pages, ${iss.affectedOccurrences} occurrences, Penalty: -${iss.scorePenalty}pts)`
    );
    if (iss.isSystemicTemplateIssue) {
      console.log(
        `   -> Systemic Template Fingerprint: ${iss.templateFingerprint} (Component: ${iss.componentGuess || "shared"})`
      );
    }
  }

  console.log("\n==================================================");
  console.log("  EXTERNAL LINK TELEMETRY RECONCILIATION");
  console.log("==================================================");
  const extTel = (result.linkGraphSummary as any)?.externalLinkTelemetry;
  if (extTel) {
    console.log(`Discovered Unique URLs: ${extTel.discoveredUniqueUrls}`);
    console.log(`Discovered Total Occurrences: ${extTel.discoveredOccurrences}`);
    console.log(`Verification Sample Cap: ${extTel.verificationLimit}`);
    console.log(`Checked Unique URLs: ${extTel.checkedUniqueUrls}`);
    console.log(`Checked Occurrences: ${extTel.checkedOccurrences}`);
    console.log(`Unchecked Unique URLs: ${extTel.uncheckedUniqueUrls}`);
    console.log(`Unchecked Occurrences: ${extTel.uncheckedOccurrences}`);
    console.log(`Verification Coverage: ${extTel.verificationCoveragePercent}%`);
    console.log(`  - Confirmed OK: ${extTel.confirmedOkUniqueUrls} unique targets (${extTel.confirmedOkOccurrences} occurrences)`);
    console.log(`  - Redirected OK: ${extTel.redirectedOkUniqueUrls} unique targets (${extTel.redirectedOkOccurrences} occurrences)`);
    console.log(`  - Browser Verified OK: ${extTel.browserVerifiedOkUniqueUrls} unique targets (${extTel.browserVerifiedOkOccurrences} occurrences)`);
    console.log(`  - Confirmed Broken: ${extTel.confirmedBrokenUniqueUrls} unique targets (${extTel.confirmedBrokenOccurrences} occurrences)`);
    console.log(`  - Bot Blocked / Inconclusive: ${extTel.inconclusiveUniqueUrls} unique targets (${extTel.inconclusiveOccurrences} occurrences)`);
    console.log(`  - Excluded Placeholder Hash ('#'): ${extTel.excludedPlaceholderHashCount} instances`);
    console.log(`  - Excluded Mailto/Tel/JS: ${extTel.excludedMailtoTelJsCount} instances`);
  }

  console.log("\n==================================================");
  console.log("  CRAWL INVENTORY RECONCILIATION TABLE");
  console.log("==================================================");
  const disputedUrls = [
    "https://www.botconsulting.io/job-categories/sales-marketing",
    "https://www.botconsulting.io/jobopenings/790176000000574221",
    "https://www.botconsulting.io/jobopenings/790176000000574233",
    "https://www.botconsulting.io/jobopenings/790176000000574281",
    "https://www.botconsulting.io/jobopenings-copy/790176000000574229",
    "https://www.botconsulting.io/jobopenings-copy/790176000000574249",
    "https://www.botconsulting.io/post/how-to-build-a-high-performing-gcc-in-india",
  ];

  for (const du of disputedUrls) {
    const page = result.crawledPages.find(
      (p) => p.url === du || p.normalizedUrl === du || p.finalUrl === du
    );
    if (page) {
      console.log(`URL: ${du}`);
      console.log(`  - Present in Crawl Inventory: YES`);
      console.log(`  - HTTP Status: ${page.statusCode} | Resource: ${page.resourceType}`);
      console.log(`  - Indexability: ${page.isIndexable} (${page.indexabilityStatus})`);
      console.log(`  - Class: ${page.classification?.primaryClass}`);
    } else {
      console.log(`URL: ${du}`);
      console.log(`  - Present in Crawl Inventory: NO`);
      console.log(`  - Reason: Not present in live XML sitemap and not linked from any crawled page`);
    }
  }

  // Save canonical result artifact
  const artifactPath = path.join(__dirname, "live-audit-results.json");
  const auditArtifact = {
    runId,
    gitSha,
    auditId: result.auditId,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.durationMs,
    terminationReason: result.terminationReason,
    healthScore: result.healthScore,
    auditCoveragePercent: result.auditCoveragePercent,
    inventory: result.inventory,
    severityCounts: result.severityCounts,
    issues: result.issues,
    linkGraphSummary: result.linkGraphSummary,
  };
  fs.writeFileSync(artifactPath, JSON.stringify(auditArtifact, null, 2), "utf8");
  console.log(`\nSaved canonical audit artifact to: ${artifactPath}`);
}

runLiveAudit().catch(console.error);
