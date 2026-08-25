/**
 * Dream SEO — Post-Phase-25 BOT Consulting Live 101-Rule Validation & Certification Script
 */

import fs from "fs";
import path from "path";
import { runSiteAuditCrawl } from "../engine";
import { fetchAllSitemaps } from "../sitemap";
import { fetchAndParseRobotsTxt } from "../robots";
import { createPersistenceLayer, executeAndPersistAudit, normalizeDomain } from "../persistence";
import { verifySingleResource, verifyBatchAffected } from "./issue-verifier";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "./rule-inventory";
import { RULE_VERIFICATION_CAPABILITY_REGISTRY } from "./rule-verification-registry";
import type { CrawledPageData, DiagnosticIssue, RuleExecutionRecord } from "../types";

async function runPostPhase25BotValidation() {
  console.log("==========================================================================");
  console.log("   DREAM SEO — POST-PHASE-25 BOT CONSULTING LIVE 101-RULE VALIDATION      ");
  console.log("==========================================================================\n");

  const seedUrl = "https://www.botconsulting.io/";
  const seedOrigin = new URL(seedUrl);
  const persistence = createPersistenceLayer();

  // 1. Robots.txt and Sitemap Discovery
  console.log("--- 1. Robots.txt & Sitemap Discovery ---");
  const robots = await fetchAndParseRobotsTxt(seedOrigin);
  console.log(`Robots Sitemaps declared:`, robots.sitemaps);
  const sitemapResult = await fetchAllSitemaps(seedUrl, robots.sitemaps);
  console.log(`Discovered ${sitemapResult.urls.length} sitemap URLs.`);

  // 2. Ensure Project
  const domain = normalizeDomain(seedUrl);
  let project = await persistence.projects.getProjectByDomain(domain);
  if (!project) {
    project = await persistence.projects.createProject({
      projectId: "proj_botconsulting",
      name: "BOT Consulting",
      primaryDomain: seedUrl,
      normalizedDomain: domain,
      status: "ACTIVE",
      defaultCountry: "Global",
      defaultDevice: "MOBILE",
    });
  }

  const previousAudits = await persistence.auditRuns.listAuditRunsForProject(project.projectId, 10);
  const latestPreviousAudit = previousAudits[0] || null;

  // 3. Full Live Crawl & Persistence (maxPages = 150)
  console.log("\n--- 2. Executing Full Live Crawl & Persistence (maxPages = 150) ---");
  const startTime = Date.now();
  const persistedOutput = await executeAndPersistAudit({
    project,
    persistenceLayer: persistence,
    crawlOptions: {
      seedUrl,
      maxPages: 150,
      maxDepth: 10,
      concurrency: 5,
      allowSubdomains: false,
      respectRobotsTxt: true,
      onProgress: (p) => {
        if (p.crawledPages % 25 === 0 || p.status === "completed") {
          console.log(`  [Crawl Progress] Crawled: ${p.crawledPages}/${p.maxPages} | Status: ${p.status} | URL: ${p.currentUrl || "N/A"}`);
        }
      },
    },
    trigger: "MANUAL",
  });
  const durationMs = Date.now() - startTime;
  const fullAudit = persistedOutput.crawlResult;

  console.log("\n--- 3. Crawl Completeness & Inventory Summary ---");
  console.log(`- Configured maxPages: 150`);
  console.log(`- Effective maxPages: 150`);
  console.log(`- Crawl Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`- Termination Reason: ${fullAudit.terminationReason}`);
  console.log(`- Total Crawled: ${fullAudit.inventory.totalCrawled}`);
  console.log(`- Total Indexable: ${fullAudit.inventory.totalIndexable}`);
  console.log(`- Total Non-Indexable: ${fullAudit.inventory.totalNonIndexable}`);
  console.log(`- Total Redirects: ${fullAudit.inventory.totalRedirects}`);
  console.log(`- Total Broken: ${fullAudit.inventory.totalBrokenPages}`);
  console.log(`- Sitemap Discovered: ${fullAudit.inventory.sitemapDiscoveredCount}`);
  console.log(`- Sitemap Orphans: ${fullAudit.inventory.sitemapOrphanCount}`);
  console.log(`- Crawl Isolated: ${fullAudit.inventory.crawlIsolatedCount}`);
  console.log(`- Health Score: ${fullAudit.healthScore}/100`);
  console.log(`- Score Model Version: ${fullAudit.scoreModelVersion || "v25-101"}`);

  console.log(`\n✓ Persisted as Audit #${persistedOutput.auditRun.sequenceNumber} (Run ID: ${persistedOutput.auditRun.auditRunId})`);
  console.log(`  Previous Audit #${latestPreviousAudit?.sequenceNumber || "N/A"} (Comparison: ${persistedOutput.comparison ? "Generated" : "Baseline"})`);

  // 4. Rule Execution Observability Analysis (all 101 rules)
  console.log("\n--- 5. Rule Execution Observability Verification (101 Rules) ---");
  const observability = fullAudit.ruleExecutionObservability || [];
  console.log(`Total Rules in Telemetry: ${observability.length} (Expected: 101)`);
  if (observability.length !== 101) {
    throw new Error(`Rule Execution Observability count mismatch! Expected 101, got ${observability.length}`);
  }

  let invariantFailures = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalEvaluated = 0;

  for (const rec of observability) {
    // Invariant 1: eligibleCount = evaluatedCount + skippedCount
    if (rec.eligibleCount !== rec.evaluatedCount + rec.skippedCount) {
      console.error(`❌ Invariant 1 Failure on ${rec.ruleId}: eligible (${rec.eligibleCount}) != evaluated (${rec.evaluatedCount}) + skipped (${rec.skippedCount})`);
      invariantFailures++;
    }
    // Invariant 2: evaluatedCount = passedCount + failedCount
    if (rec.evaluatedCount !== rec.passedCount + rec.failedCount) {
      console.error(`❌ Invariant 2 Failure on ${rec.ruleId}: evaluated (${rec.evaluatedCount}) != passed (${rec.passedCount}) + failed (${rec.failedCount})`);
      invariantFailures++;
    }

    if (rec.status === "PASSED") totalPassed++;
    else if (rec.status === "FAILED") totalFailed++;
    else if (rec.status === "SKIPPED") totalSkipped++;
    if (rec.evaluatedCount > 0) totalEvaluated++;
  }

  console.log(`Invariant Checks: ${invariantFailures === 0 ? "✓ ALL 101 RULES SATISFY INVARIANTS CLEANLY" : `❌ ${invariantFailures} INVARIANT VIOLATIONS`}`);
  console.log(`Observability Summary: ${totalPassed} Passed, ${totalFailed} Failed (Issues Emitted), ${totalSkipped} Skipped (Non-HTML/Utility), ${totalEvaluated} Evaluated`);

  // 5. Deep Dive on 6 New Phase-25 Rules
  console.log("\n--- 6. Detailed Inspection: 6 New Phase-25 Rules on BOT Consulting ---");
  const phase25RuleCodes = [
    "HTML_LANG_MISSING",
    "A11Y_BUTTON_NAME_MISSING",
    "A11Y_IFRAME_TITLE_MISSING",
    "IMAGE_OVERSIZED_FILE",
    "SOCIAL_TWITTER_CARD_MISSING",
    "PERF_COMPRESSION_DISABLED",
  ];

  const phase25Results: Record<string, any> = {};

  for (const ruleCode of phase25RuleCodes) {
    const rec = observability.find((r) => r.ruleId === ruleCode);
    const issue = fullAudit.issues.find((i) => i.code === ruleCode);
    phase25Results[ruleCode] = {
      ruleCode,
      status: rec?.status || "UNKNOWN",
      eligibleCount: rec?.eligibleCount ?? 0,
      evaluatedCount: rec?.evaluatedCount ?? 0,
      passedCount: rec?.passedCount ?? 0,
      failedCount: rec?.failedCount ?? 0,
      skippedCount: rec?.skippedCount ?? 0,
      affectedPages: issue?.affectedPages.length ?? 0,
      affectedOccurrences: issue?.affectedOccurrences ?? 0,
      scorePenalty: issue?.scorePenalty ?? 0,
      sampleUrls: issue?.affectedPages.slice(0, 3).map((p) => p.url) ?? [],
      sampleEvidence: issue?.affectedPages[0]?.evidence ?? null,
    };

    console.log(`• [${rec?.status}] ${ruleCode}:`);
    console.log(`    Eligible: ${rec?.eligibleCount}, Evaluated: ${rec?.evaluatedCount}, Passed: ${rec?.passedCount}, Failed: ${rec?.failedCount}`);
    if (issue) {
      console.log(`    Finding Title: ${issue.title} (Severity: ${issue.severity}, Deduction: -${issue.scorePenalty} pts)`);
      console.log(`    Affected Pages: ${issue.affectedPages.length}, Occurrences: ${issue.affectedOccurrences}`);
      console.log(`    Sample Evidence: ${issue.affectedPages[0]?.evidence?.observed}`);
      console.log(`    Sample URL: ${issue.affectedPages[0]?.url}`);
    } else {
      console.log(`    Finding: 0 issues (CLEAN PASS)`);
    }
  }

  // 6. Deep Dive on HTML Lang
  console.log("\n--- 7. HTML Lang Analysis ---");
  const sampleLangPages = fullAudit.crawledPages.filter((p) => p.htmlLang).slice(0, 5);
  console.log(`Sample HTML lang attributes found on BOT pages:`);
  sampleLangPages.forEach((p) => console.log(`  - ${p.url} -> lang="${p.htmlLang}"`));
  const pagesWithoutLang = fullAudit.crawledPages.filter((p) => !p.htmlLang && p.resourceType === "html_page" && p.statusCode === 200);
  console.log(`Total 200 HTML pages without lang: ${pagesWithoutLang.length}`);

  // 7. Deep Dive on Button Accessible Names
  console.log("\n--- 8. Interactive Button Accessible Names Analysis ---");
  let totalButtons = 0;
  let labelledButtons = 0;
  let unlabelledButtons = 0;
  const unlabelledButtonPages: { url: string; unlabelled: any[] }[] = [];

  for (const page of fullAudit.crawledPages) {
    if (page.buttons && page.buttons.length > 0) {
      totalButtons += page.buttons.length;
      for (const btn of page.buttons) {
        if (btn.isLabelled) labelledButtons++;
        else unlabelledButtons++;
      }
      const unlabelled = page.buttons.filter((b) => !b.isLabelled);
      if (unlabelled.length > 0) {
        unlabelledButtonPages.push({ url: page.url, unlabelled });
      }
    }
  }
  console.log(`Total Interactive Buttons Scanned: ${totalButtons}`);
  console.log(`  - Labelled / Accessible Name Present: ${labelledButtons}`);
  console.log(`  - Unlabelled (Missing Name): ${unlabelledButtons}`);
  console.log(`  - Affected Pages: ${unlabelledButtonPages.length}`);
  if (unlabelledButtonPages.length > 0) {
    console.log(`  - Sample Affected Pages:`);
    unlabelledButtonPages.slice(0, 3).forEach((p) => {
      console.log(`      * ${p.url} -> ${p.unlabelled.map((b) => b.domSelector || b.tag).join(", ")}`);
    });
  }

  // 8. Deep Dive on Iframe Titles
  console.log("\n--- 9. Embedded Iframes Title Analysis ---");
  let totalIframes = 0;
  let titledIframes = 0;
  let untitledIframes = 0;
  let hiddenIframes = 0;
  for (const page of fullAudit.crawledPages) {
    if (page.iframes && page.iframes.length > 0) {
      totalIframes += page.iframes.length;
      for (const f of page.iframes) {
        if (f.isHidden) hiddenIframes++;
        else if (f.title && f.title.trim().length > 0) titledIframes++;
        else untitledIframes++;
      }
    }
  }
  console.log(`Total Iframes Found: ${totalIframes}`);
  console.log(`  - Visible & Titled: ${titledIframes}`);
  console.log(`  - Visible & Untitled (Missing Title): ${untitledIframes}`);
  console.log(`  - Hidden / Tracking Excluded: ${hiddenIframes}`);

  // 9. Deep Dive on Oversized Images
  console.log("\n--- 10. Image Transfer Size & Oversized Assets Analysis ---");
  const uniqueImages = new Map<string, { size: number; urls: Set<string> }>();
  for (const page of fullAudit.crawledPages) {
    for (const img of page.images || []) {
      const src = img.resolvedUrl || img.src;
      if (!uniqueImages.has(src)) {
        uniqueImages.set(src, { size: img.byteSize || 0, urls: new Set() });
      }
      uniqueImages.get(src)!.urls.add(page.url);
    }
  }

  const oversizedImages = Array.from(uniqueImages.entries())
    .filter(([_, data]) => data.size > 250 * 1024)
    .sort((a, b) => b[1].size - a[1].size);

  console.log(`Total Unique Embedded Image Assets: ${uniqueImages.size}`);
  console.log(`Total Unique Assets > 250 KB: ${oversizedImages.length}`);
  oversizedImages.slice(0, 5).forEach(([src, data]) => {
    console.log(`  - ${(data.size / 1024).toFixed(1)} KB (on ${data.urls.size} page(s)): ${src}`);
  });

  // 10. Deep Dive on Twitter Card
  console.log("\n--- 11. Twitter Card Meta Tag Analysis ---");
  const eligibleSocialPages = fullAudit.crawledPages.filter((p) =>
    p.isIndexable &&
    ["homepage", "marketing_landing", "article_blog", "active_job", "product_job_detail", "category_listing"].includes(p.classification.primaryClass)
  );
  const pagesWithTwitterCard = eligibleSocialPages.filter((p) => p.twitterCard?.hasExplicitCard);
  const pagesMissingTwitterCard = eligibleSocialPages.filter((p) => !p.twitterCard?.hasExplicitCard);
  console.log(`Eligible Indexable Social Pages: ${eligibleSocialPages.length}`);
  console.log(`  - Pages with explicit twitter:card: ${pagesWithTwitterCard.length}`);
  console.log(`  - Pages missing twitter:card: ${pagesMissingTwitterCard.length}`);

  // 11. Deep Dive on HTTP Compression
  console.log("\n--- 12. HTTP Compression Analysis ---");
  const html200Over10Kb = fullAudit.crawledPages.filter(
    (p) => p.statusCode === 200 && (p.rawHtmlByteLength || 0) > 10240
  );
  const compressedPages = html200Over10Kb.filter((p) => p.isCompressionEnabled === true);
  const uncompressedPages = html200Over10Kb.filter((p) => p.isCompressionEnabled === false);
  console.log(`HTML 200 OK responses > 10 KB: ${html200Over10Kb.length}`);
  console.log(`  - Compressed (gzip/br/deflate/zstd): ${compressedPages.length}`);
  console.log(`  - Uncompressed: ${uncompressedPages.length}`);

  // 12. Re-validate Old BOT Fixes
  console.log("\n--- 13. Re-Validation of Historical BOT Consulting Fixes ---");
  const historicalCheckRules = [
    { code: "CONTENT_MULTIPLE_H1", expected: 0 },
    { code: "CONTENT_SKIPPED_HEADINGS", expected: 0 },
    { code: "A11Y_MISSING_MAIN_LANDMARK", expected: 0 },
    { code: "ASSET_MISSING_DIMENSIONS", expected: 59 },
    { code: "A11Y_UNLABELLED_FORM_CONTROL", expected: 21 },
    { code: "INDEXABILITY_SITEMAP_ORPHAN", expected: 0 },
  ];

  const historicalResults: Record<string, any> = {};

  for (const item of historicalCheckRules) {
    const issue = fullAudit.issues.find((i) => i.code === item.code);
    const affectedCount = issue?.affectedPages.length ?? 0;
    const occurrences = issue?.affectedOccurrences ?? 0;
    historicalResults[item.code] = {
      ruleCode: item.code,
      affectedPages: affectedCount,
      occurrences,
      status: affectedCount === 0 ? "RESOLVED_ZERO" : `ACTIVE_${affectedCount}_PAGES`,
      deduction: issue?.scorePenalty ?? 0,
    };
    console.log(`• ${item.code}: ${affectedCount} affected pages / ${occurrences} occurrences (Expected baseline: ${item.expected}) -> Status: ${affectedCount === 0 ? "✓ ZERO (RESOLVED)" : `ACTIVE (${affectedCount} pages)`}`);
  }

  // 13. Duplication Safety: A11Y_UNLABELLED_FORM_CONTROL vs A11Y_BUTTON_NAME_MISSING
  console.log("\n--- 14. Accessibility Rule Duplication Safety Check ---");
  const formControlIssue = fullAudit.issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");
  const buttonNameIssue = fullAudit.issues.find((i) => i.code === "A11Y_BUTTON_NAME_MISSING");
  console.log(`A11Y_UNLABELLED_FORM_CONTROL affected pages: ${formControlIssue?.affectedPages.length ?? 0}`);
  console.log(`A11Y_BUTTON_NAME_MISSING affected pages: ${buttonNameIssue?.affectedPages.length ?? 0}`);

  // 14. Issue-Level Live Verification Test
  console.log("\n--- 15. Testing Issue-Level Live Verification Engine ---");
  let testVerificationRule = "";
  let testResourceUrl = "";
  let targetFindingFingerprint = "";

  if (buttonNameIssue && buttonNameIssue.affectedPages.length > 0) {
    testVerificationRule = "A11Y_BUTTON_NAME_MISSING";
    testResourceUrl = buttonNameIssue.affectedPages[0].url;
    targetFindingFingerprint = `${testVerificationRule}:${testResourceUrl}`;
  } else if (formControlIssue && formControlIssue.affectedPages.length > 0) {
    testVerificationRule = "A11Y_UNLABELLED_FORM_CONTROL";
    testResourceUrl = formControlIssue.affectedPages[0].url;
    targetFindingFingerprint = `${testVerificationRule}:${testResourceUrl}`;
  } else {
    testVerificationRule = "A11Y_MISSING_MAIN_LANDMARK";
    testResourceUrl = seedUrl;
    targetFindingFingerprint = `${testVerificationRule}:${seedUrl}`;
  }

  console.log(`Testing Live Verification on Rule: ${testVerificationRule} | URL: ${testResourceUrl}`);
  const liveVerifResult = await verifySingleResource(testVerificationRule, { url: testResourceUrl }, seedOrigin.hostname);
  console.log(`✓ Live Verification Result: Status=${liveVerifResult.status}, isFixed=${liveVerifResult.isFixed}`);
  console.log(`  Message: ${liveVerifResult.message}`);
  console.log(`  Evidence observed: ${liveVerifResult.liveEvidence?.observed || "N/A"}`);

  // 15. Export Validation Artifact
  const outputDir = path.resolve(process.cwd(), "artifacts/verification/latest");
  fs.mkdirSync(outputDir, { recursive: true });
  const validationReport = {
    domain: "www.botconsulting.io",
    validatedAt: new Date().toISOString(),
    auditRunId: persistedOutput.auditRun.auditRunId,
    scoreModelVersion: fullAudit.scoreModelVersion || "v25-101",
    healthScore: fullAudit.healthScore,
    inventory: fullAudit.inventory,
    durationMs,
    ruleExecutionSummary: {
      totalRegistered: 101,
      totalTelemetry: observability.length,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      evaluated: totalEvaluated,
      invariantsSatisfied: invariantFailures === 0,
    },
    phase25NewRules: phase25Results,
    historicalCheckRules: historicalResults,
    liveVerificationTest: {
      ruleId: testVerificationRule,
      url: testResourceUrl,
      result: liveVerifResult,
    },
  };

  fs.writeFileSync(
    path.join(outputDir, "bot-consulting-101-rule-validation.json"),
    JSON.stringify(validationReport, null, 2),
    "utf-8"
  );
  console.log(`\n✓ Exported validation report to artifacts/verification/latest/bot-consulting-101-rule-validation.json\n`);
}

runPostPhase25BotValidation().catch((err) => {
  console.error("FATAL ERROR in post-phase25 bot validation:", err);
  process.exit(1);
});
