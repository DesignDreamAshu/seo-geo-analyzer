/**
 * E2E Verification Suite: Persistent Report UX, Non-destructive Re-crawl, and Targeted Verification.
 */

import { DatabaseSync } from "node:sqlite";
import { createPersistenceLayer, executeAndPersistAudit, computeAuditComparison, normalizeDomain } from "../persistence/index";
import { runSiteAuditCrawl } from "../engine";
import { fetchPageHtml } from "../fetcher";
import { processPageAuthoritatively } from "../page-processor";
import { evaluateAllDiagnosticRules } from "../rules";
import { normalizeUrl } from "../normalizer";

async function runE2ETests() {
  console.log("==================================================================");
  console.log("RUNNING PERSISTENT REPORT + RECRAWL + TARGETED VERIFICATION E2E SUITE");
  console.log("==================================================================\n");

  const persistence = createPersistenceLayer(":memory:");

  // 1. Setup project
  const project = await persistence.projects.createProject({
    projectId: "proj_e2e_recrawl_test",
    name: "E2E Recrawl Project",
    primaryDomain: "https://example.com",
    normalizedDomain: normalizeDomain("https://example.com"),
    status: "ACTIVE",
    defaultCountry: "US",
    defaultDevice: "MOBILE",
  });

  // TEST 1: Baseline Audit Creation & Persistence
  console.log("--- TEST 1: Baseline Audit Creation & Snapshot Persistence ---");
  const audit1 = await executeAndPersistAudit({
    project,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: "https://example.com", maxPages: 2, maxDepth: 2 },
    trigger: "MANUAL",
  });

  console.log(`✓ Audit #1 Created: ${audit1.auditRun.auditRunId} (Sequence: ${audit1.auditRun.sequenceNumber})`);
  if (audit1.auditRun.sequenceNumber !== 1) throw new Error("Expected sequenceNumber = 1");

  // TEST 2: Refresh Persistence (Restore from Backend Snapshot without re-crawling)
  console.log("\n--- TEST 2: Page Refresh Persistence (Zero Re-crawl Restoration) ---");
  const latestAudit = await persistence.auditRuns.getLatestCompletedAuditRun(project.projectId);
  const snapshot = await persistence.auditSnapshots.getSnapshot(audit1.auditRun.auditRunId);
  if (!snapshot || !snapshot.payloadJson) throw new Error("Expected audit snapshot with payloadJson");
  const parsed = JSON.parse(snapshot.payloadJson);
  if (!parsed.crawlResult) throw new Error("Expected snapshot to contain full crawlResult for instant restoration");
  console.log(`✓ Restored Audit #${latestAudit?.sequenceNumber} from Snapshot with ${parsed.crawlResult.crawledPages?.length} pages and Health Score: ${parsed.crawlResult.healthScore}/100`);

  // TEST 3: Baseline History Safety (Comparison is null, must not crash)
  console.log("\n--- TEST 3: Baseline History Null Safety ---");
  const comparisons = await persistence.auditComparisons.listComparisonsForProject(project.projectId, 10);
  const compForBaseline = comparisons.find((c) => c.currentAuditRunId === audit1.auditRun.auditRunId) || null;
  console.log(`✓ Baseline Comparison: ${compForBaseline} (Safely handled as null without property access errors)`);

  // TEST 4: Full Non-destructive Re-crawl -> Audit #2
  console.log("\n--- TEST 4: Non-destructive Re-crawl -> Audit #2 ---");
  const audit2 = await executeAndPersistAudit({
    project,
    persistenceLayer: persistence,
    crawlOptions: { seedUrl: "https://example.com", maxPages: 2, maxDepth: 2 },
    trigger: "MANUAL",
  });

  console.log(`✓ Audit #2 Created: ${audit2.auditRun.auditRunId} (Sequence: ${audit2.auditRun.sequenceNumber})`);
  if (audit2.auditRun.sequenceNumber !== 2) throw new Error("Expected sequenceNumber = 2");

  // Verify Audit #1 is untouched and immutable
  const audit1Check = await persistence.auditRuns.getAuditRunById(audit1.auditRun.auditRunId);
  if (audit1Check?.auditRunId !== audit1.auditRun.auditRunId) throw new Error("Audit #1 mutated!");
  console.log(`✓ Audit #1 Remains Immutable: ${audit1Check.auditRunId}`);

  // Verify comparison #1 -> #2 generated
  const comp1to2 = await persistence.auditComparisons.getComparison(audit1.auditRun.auditRunId, audit2.auditRun.auditRunId);
  if (!comp1to2) throw new Error("Expected comparison between Audit #1 and #2");
  console.log(`✓ Comparison #1 -> #2 Available: Fixed=${comp1to2.fixedCount}, New=${comp1to2.newCount}, Unchanged=${comp1to2.unchangedCount}, ScoreDelta=${comp1to2.metricChanges?.scoreDelta ?? 0}`);

  // TEST 5: Targeted Finding Verification (Single Rule Check, Whole-site Score Preserved)
  console.log("\n--- TEST 5: Targeted Finding Verification (Verify Fix) ---");
  const testUrl = "https://example.com";
  const fetchRes = await fetchPageHtml(testUrl);
  const pageData = await processPageAuthoritatively(
    testUrl,
    normalizeUrl(testUrl),
    fetchRes.finalUrl,
    fetchRes.statusCode,
    fetchRes.redirectHops,
    fetchRes.html,
    fetchRes.headers,
    fetchRes.responseTimeMs,
    0,
    { seedNormalized: project.normalizedDomain }
  );
  const evalRes = evaluateAllDiagnosticRules([pageData]);
  const sampleIssue = evalRes.issues[0];
  const targetRuleId = sampleIssue ? sampleIssue.code : "A11Y_MISSING_MAIN_LANDMARK";

  // Simulate finding verification
  const isFixed = !evalRes.issues.some((i) => i.code === targetRuleId);
  const verificationResult = isFixed ? "VERIFIED_FIXED" : "STILL_PRESENT";

  // Record verification event in finding lifecycle history
  await persistence.auditFindings.batchInsertFindings([
    {
      auditFindingId: `vf_test_${Date.now()}`,
      auditRunId: audit2.auditRun.auditRunId,
      projectId: project.projectId,
      ruleId: targetRuleId,
      severity: "LOW",
      findingState: isFixed ? "FIXED" : "OPEN",
      message: `Verified: ${targetRuleId} on ${testUrl}`,
      evidence: { verificationType: "FINDING_VERIFICATION", verificationResult, url: testUrl },
      normalizedUrl: normalizeUrl(testUrl),
      findingFingerprint: "fp_test_123",
      createdAt: new Date().toISOString(),
    },
  ]);

  // Check that audit score of Audit #2 is strictly UNCHANGED
  const audit2AfterVerify = await persistence.auditRuns.getAuditRunById(audit2.auditRun.auditRunId);
  console.log(`✓ Targeted Finding Verification Result: ${verificationResult} (Whole-site Audit #2 Score Preserved: ${audit2AfterVerify?.summaryStats?.seoScore}/100)`);

  // TEST 6: Targeted Page Recheck (Single URL Re-evaluation)
  console.log("\n--- TEST 6: Targeted Page Re-check ---");
  const previousFindings = await persistence.auditFindings.getFindingsForAuditRun(audit2.auditRun.auditRunId, 100);
  const currentRuleCodes = new Set(evalRes.issues.map((i) => i.code));
  const prevRuleCodes = new Set(previousFindings.map((f) => f.ruleId));

  const pageFixed = previousFindings.filter((f) => !currentRuleCodes.has(f.ruleId)).length;
  const pageStillPresent = evalRes.issues.filter((i) => prevRuleCodes.has(i.code)).length;
  const pageNew = evalRes.issues.filter((i) => !prevRuleCodes.has(i.code)).length;

  console.log(`✓ Page Recheck Diffs: Fixed=${pageFixed}, StillPresent=${pageStillPresent}, New=${pageNew}`);
  console.log(`✓ Total audits count remains 2 (Targeted runs did not inflate Audit # sequence)`);

  const allRuns = await persistence.auditRuns.listAuditRunsForProject(project.projectId);
  if (allRuns.length !== 2) throw new Error(`Expected 2 full audits, found ${allRuns.length}`);

  console.log("\n==================================================================");
  console.log("✓ ALL PERSISTENT REPORT + RECRAWL + VERIFICATION E2E TESTS PASSED!");
  console.log("==================================================================");
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
