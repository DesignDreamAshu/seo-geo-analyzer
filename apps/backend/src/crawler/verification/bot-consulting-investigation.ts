/**
 * BOT Consulting Deep Investigation Script.
 * Analyzes sitemaps, crawl termination, orphan calculation, and specific rule changes.
 */

import { fetchAllSitemaps } from "../sitemap";
import { fetchAndParseRobotsTxt } from "../robots";
import { runSiteAuditCrawl } from "../engine";
import { verifySingleResource } from "./issue-verifier";

async function runInvestigation() {
  console.log("==================================================================");
  console.log("INVESTIGATING BOT CONSULTING CRAWL AND FINDINGS");
  console.log("==================================================================\n");

  const seedUrl = "https://www.botconsulting.io/";
  const seedOrigin = new URL(seedUrl);

  // 1. Check Robots and Sitemaps
  console.log("--- 1. Robots & Sitemap Discovery ---");
  const robots = await fetchAndParseRobotsTxt(seedOrigin);
  console.log(`Robots Sitemaps:`, robots.sitemaps);
  const sitemapResult = await fetchAllSitemaps(seedUrl, robots.sitemaps);
  console.log(`Discovered ${sitemapResult.urls.length} sitemap URLs:`);
  sitemapResult.urls.slice(0, 10).forEach((u, i) => console.log(`  [${i + 1}] ${u.loc}`));
  console.log(`  ... and ${sitemapResult.urls.length - 10} more URLs\n`);

  // 2. Run Full Crawl (maxPages = 150)
  console.log("--- 2. Running Full Crawl (maxPages = 150) ---");
  const fullResult = await runSiteAuditCrawl({
    seedUrl,
    maxPages: 150,
    concurrency: 5,
    onProgress: (p) => {
      if (p.crawledPages % 25 === 0 || p.status === "completed") {
        console.log(`  [Full Crawl Progress] Crawled: ${p.crawledPages}/${p.maxPages} | Status: ${p.status}`);
      }
    },
  });

  console.log(`\nFull Crawl Result:`);
  console.log(`- Crawled: ${fullResult.inventory.totalCrawled}`);
  console.log(`- Indexable: ${fullResult.inventory.totalIndexable}`);
  console.log(`- Sitemap Orphans: ${fullResult.inventory.sitemapOrphanCount}`);
  console.log(`- Health Score: ${fullResult.healthScore}/100`);
  console.log(`- Termination Reason: ${fullResult.terminationReason}`);

  // List key issues in full crawl
  const keyRules = [
    "A11Y_UNLABELLED_FORM_CONTROL",
    "A11Y_MISSING_MAIN_LANDMARK",
    "HEADINGS_H1_DUPLICATE",
    "HEADINGS_HIERARCHY_SKIPPED",
    "ASSET_MISSING_DIMENSIONS",
    "INDEXABILITY_SITEMAP_ORPHAN",
  ];

  console.log("\n--- Full Crawl Key Issues Breakdown ---");
  for (const ruleCode of keyRules) {
    const issue = fullResult.issues.find((i) => i.code === ruleCode);
    if (issue) {
      console.log(`• ${ruleCode}: ${issue.affectedPages.length} affected pages / ${issue.affectedOccurrences} occurrences (Severity: ${issue.severity})`);
      if (issue.affectedPages.length <= 5) {
        issue.affectedPages.forEach((p) => console.log(`    - ${p.url}`));
      } else {
        console.log(`    Sample: ${issue.affectedPages.slice(0, 3).map((p) => p.url).join(", ")} ...`);
      }
    } else {
      console.log(`• ${ruleCode}: 0 affected pages (CLEAN / RESOLVED)`);
    }
  }

  // 3. Run Limited Crawl (maxPages = 50) to Reproduce 50-Page Behavior
  console.log("\n--- 3. Running Limited Crawl (maxPages = 50) ---");
  const limitedResult = await runSiteAuditCrawl({
    seedUrl,
    maxPages: 50,
    concurrency: 5,
    onProgress: (p) => {
      if (p.crawledPages % 25 === 0 || p.status === "completed") {
        console.log(`  [Limited Crawl Progress] Crawled: ${p.crawledPages}/${p.maxPages} | Status: ${p.status}`);
      }
    },
  });

  console.log(`\nLimited Crawl (maxPages=50) Result:`);
  console.log(`- Crawled: ${limitedResult.inventory.totalCrawled}`);
  console.log(`- Indexable: ${limitedResult.inventory.totalIndexable}`);
  console.log(`- Sitemap Orphans: ${limitedResult.inventory.sitemapOrphanCount}`);
  console.log(`- Health Score: ${limitedResult.healthScore}/100`);
  console.log(`- Termination Reason: ${limitedResult.terminationReason}`);

  console.log("\n--- Limited Crawl Key Issues Breakdown ---");
  for (const ruleCode of keyRules) {
    const issue = limitedResult.issues.find((i) => i.code === ruleCode);
    if (issue) {
      console.log(`• ${ruleCode}: ${issue.affectedPages.length} affected pages / ${issue.affectedOccurrences} occurrences`);
    } else {
      console.log(`• ${ruleCode}: 0 affected pages`);
    }
  }
}

runInvestigation().catch((err) => {
  console.error("Investigation Error:", err);
  process.exit(1);
});
