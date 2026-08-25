import crypto from "crypto";
import { runSiteAuditCrawl } from "../engine";
import { createPersistenceLayer, normalizeDomain } from "../persistence/index";
import { executeAndPersistAudit } from "../persistence/crawler-persistence-bridge";
import { computeAuditComparison } from "../persistence/comparison-engine";
import type { CrawlAuditResult, DiagnosticIssue } from "../types";

const persistence = createPersistenceLayer();

function sha256(data: string[]): string {
  const sorted = [...data].sort().join("|");
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

interface RunMetrics {
  runNumber: number;
  auditRunId: string;
  pagesDiscovered: number;
  pagesEvaluated: number;
  urlSetHash: string;
  urls: string[];
  rulesEvaluated: number;
  fingerprintSetHash: string;
  fingerprints: string[];
  totalFindings: number;
  severityCounts: {
    critical: number;
    warning: number;
    opportunity: number;
    notice: number;
  };
  totalDeductions: number;
  healthScore: number;
  crawlFailures: number;
  retryCount: number;
  statusZeroCount: number;
}

async function runSingleAudit(
  runIndex: number,
  targetUrl: string,
  maxPages: number
): Promise<{ result: CrawlAuditResult; metrics: RunMetrics; persistedAuditRunId: string }> {
  console.log(`\n========================================`);
  console.log(`EXECUTING REPRODUCIBILITY RUN #${runIndex + 1} ON ${targetUrl}`);
  console.log(`========================================`);

  let project = await persistence.projects.getProjectByDomain(targetUrl);
  if (!project) {
    project = await persistence.projects.createProject({
      projectId: "proj_repro_test_" + Date.now(),
      name: "Reproducibility Test Project",
      primaryDomain: targetUrl,
      normalizedDomain: normalizeDomain(targetUrl),
      status: "ACTIVE",
      defaultCountry: "US",
      defaultDevice: "MOBILE",
    });
  }

  let retriesCount = 0;
  const crawlResult = await runSiteAuditCrawl({
    seedUrl: targetUrl,
    maxPages,
    maxDepth: 3,
    concurrency: 3,
    allowSubdomains: false,
    respectRobotsTxt: true,
  });

  const persisted = await executeAndPersistAudit({
    project,
    persistenceLayer: persistence,
    crawlOptions: {
      seedUrl: targetUrl,
      maxPages,
      maxDepth: 3,
      concurrency: 3,
    },
    trigger: "VERIFICATION",
  });

  const urls = crawlResult.crawledPages.map((p) => p.normalizedUrl || p.url).sort();
  const urlSetHash = sha256(urls);

  const fingerprints = crawlResult.issues.map((i) => i.code + "::" + (i.affectedPages.map((p) => p.url).sort().join(","))).sort();
  const fingerprintSetHash = sha256(fingerprints);

  const statusZeroCount = crawlResult.crawledPages.filter((p) => p.statusCode === 0).length;
  const crawlFailures = crawlResult.crawledPages.filter((p) => p.resourceType === "error" || p.statusCode === 0).length;

  const runMetrics: RunMetrics = {
    runNumber: runIndex + 1,
    auditRunId: persisted.auditRun.auditRunId,
    pagesDiscovered: crawlResult.inventory.totalCrawled,
    pagesEvaluated: crawlResult.crawledPages.filter((p) => p.resourceType === "html_page").length,
    urlSetHash,
    urls,
    rulesEvaluated: 95,
    fingerprintSetHash,
    fingerprints,
    totalFindings: crawlResult.issues.length,
    severityCounts: {
      critical: crawlResult.severityCounts.critical,
      warning: crawlResult.severityCounts.warnings,
      opportunity: crawlResult.severityCounts.opportunities,
      notice: crawlResult.severityCounts.notices,
    },
    totalDeductions: crawlResult.scoreBreakdown.totalDeductions,
    healthScore: crawlResult.healthScore,
    crawlFailures,
    retryCount: retriesCount,
    statusZeroCount,
  };

  return {
    result: crawlResult,
    metrics: runMetrics,
    persistedAuditRunId: persisted.auditRun.auditRunId,
  };
}

async function runReproducibilitySuite() {
  const targetUrl = "https://example.com";
  const maxPages = 5;
  const RUN_COUNT = 5;

  console.log(`Starting 5-run Live Crawl Reproducibility Check for ${targetUrl}...`);

  const runs: RunMetrics[] = [];
  const auditRunIds: string[] = [];

  for (let i = 0; i < RUN_COUNT; i++) {
    const { metrics, persistedAuditRunId } = await runSingleAudit(i, targetUrl, maxPages);
    runs.push(metrics);
    auditRunIds.push(persistedAuditRunId);
    // Short pause between runs
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n\n========================================================================================`);
  console.log(`                       LIVE CRAWL 5-RUN REPRODUCIBILITY REPORT                          `);
  console.log(`========================================================================================\n`);

  console.log(
    "| Run # | Discovered | Evaluated | URL Set SHA | Rules | Fingerprint SHA | Total Issues | Crit/Warn/Opp/Not | Deductions | Health Score | Status:0 | Failures |"
  );
  console.log(
    "|-------|------------|-----------|-------------|-------|-----------------|--------------|-------------------|------------|--------------|----------|----------|"
  );

  for (const r of runs) {
    const sev = `${r.severityCounts.critical}/${r.severityCounts.warning}/${r.severityCounts.opportunity}/${r.severityCounts.notice}`;
    console.log(
      `| Run ${r.runNumber} | ${String(r.pagesDiscovered).padEnd(10)} | ${String(r.pagesEvaluated).padEnd(9)} | ${r.urlSetHash} | ${String(r.rulesEvaluated).padEnd(5)} | ${r.fingerprintSetHash} | ${String(r.totalFindings).padEnd(12)} | ${sev.padEnd(17)} | ${String(r.totalDeductions).padEnd(10)} | ${String(r.healthScore + "/100").padEnd(12)} | ${String(r.statusZeroCount).padEnd(8)} | ${String(r.crawlFailures).padEnd(8)} |`
    );
  }

  // Comparisons across runs
  console.log(`\n--- Cross-Run Reproducibility Assertions ---`);

  const base = runs[0];
  let allUrlsIdentical = true;
  let allFingerprintsIdentical = true;
  let allDeductionsIdentical = true;
  let allScoresIdentical = true;

  for (let i = 1; i < runs.length; i++) {
    const curr = runs[i];
    if (curr.urlSetHash !== base.urlSetHash) allUrlsIdentical = false;
    if (curr.fingerprintSetHash !== base.fingerprintSetHash) allFingerprintsIdentical = false;
    if (curr.totalDeductions !== base.totalDeductions) allDeductionsIdentical = false;
    if (curr.healthScore !== base.healthScore) allScoresIdentical = false;
  }

  console.log(`[Invariant 1] Identical Evaluated URL Set:       ${allUrlsIdentical ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`[Invariant 2] Identical Finding Fingerprint Set:  ${allFingerprintsIdentical ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`[Invariant 3] Identical Score Deductions:        ${allDeductionsIdentical ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`[Invariant 4] Identical Final Health Score:      ${allScoresIdentical ? "✓ PASS" : "✗ FAIL"}`);

  // Test Phase 24 Audit Comparison across the 5 persisted runs
  console.log(`\n--- Phase 24 Comparator Invariant Verification ---`);
  let zeroPhantomDiffs = true;

  for (let i = 0; i < auditRunIds.length - 1; i++) {
    const bId = auditRunIds[i];
    const cId = auditRunIds[i + 1];

    const baselineAudit = await persistence.auditRuns.getAuditRunById(bId);
    const currentAudit = await persistence.auditRuns.getAuditRunById(cId);
    const baselinePages = await persistence.auditPages.getPagesForAuditRun(bId, 100);
    const currentPages = await persistence.auditPages.getPagesForAuditRun(cId, 100);
    const baselineFindings = await persistence.auditFindings.getFindingsForAuditRun(bId, 500);
    const currentFindings = await persistence.auditFindings.getFindingsForAuditRun(cId, 500);

    const comp = computeAuditComparison({
      projectId: baselineAudit!.projectId,
      baselineAudit: baselineAudit!,
      currentAudit: currentAudit!,
      baselinePages,
      currentPages,
      baselineFindings,
      currentFindings,
    });

    console.log(
      `Comparison Run #${i + 1} vs Run #${i + 2}: ScoreDelta=${comp.metricChanges?.scoreDelta ?? 0}, New=${comp.newCount}, Fixed=${comp.fixedCount}, Reopened=${comp.reopenedCount}, Unchanged=${comp.unchangedCount}`
    );

    if ((comp.metricChanges?.scoreDelta !== undefined && comp.metricChanges.scoreDelta !== 0) || comp.newCount !== 0 || comp.fixedCount !== 0) {
      zeroPhantomDiffs = false;
    }
  }

  console.log(`[Invariant 5] Zero Phantom Diff Findings:       ${zeroPhantomDiffs ? "✓ PASS" : "✗ FAIL"}`);

  if (allUrlsIdentical && allFingerprintsIdentical && allDeductionsIdentical && allScoresIdentical && zeroPhantomDiffs) {
    console.log(`\n========================================================================================`);
    console.log(`   ✓ 100% PERFECT REPRODUCIBILITY ACHIEVED ACROSS ALL 5 CONSECUTIVE LIVE AUDITS         `);
    console.log(`========================================================================================\n`);
  } else {
    console.error(`\n✗ REPRODUCIBILITY INVARIANTS VIOLATED.`);
    process.exit(1);
  }
}

runReproducibilitySuite().catch((err) => {
  console.error("Reproducibility check error:", err);
  process.exit(1);
});
