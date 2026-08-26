import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { evaluateAllDiagnosticRules } from "../rules";
import { buildAndAnalyzeGraph } from "../graph";
import { IMPLEMENTED_DIAGNOSTIC_RULES, getImplementedRulesCount } from "../verification/rule-inventory";

async function run() {
  console.log("===============================================================================");
  console.log("REMEDIATION INTELLIGENCE & ACTIONABILITY REGRESSION SUITE");
  console.log("===============================================================================\n");

  const cwd = process.cwd();
  const dbPath = cwd.includes("apps\\backend") || cwd.includes("apps/backend")
    ? path.resolve(cwd, "../../local_data/dream_seo.db")
    : path.resolve(cwd, "local_data/dream_seo.db");
  const db = new DatabaseSync(dbPath);

  const row = db.prepare(`
    SELECT s.payload_json 
    FROM audit_snapshots s 
    JOIN audit_runs r ON s.audit_run_id = r.audit_run_id 
    WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
    ORDER BY r.sequence_number DESC 
    LIMIT 1
  `).get() as any;

  if (!row) {
    console.error("ERROR: No BOT Consulting snapshot found in database!");
    process.exit(1);
  }

  const payload = JSON.parse(row.payload_json);
  const pages = payload.crawlResult?.crawledPages || [];
  console.log(`Loaded ${pages.length} crawled pages for BOT Consulting.`);

  // Test 1: Rule Inventory & Observability Accounting
  const ruleCount = getImplementedRulesCount();
  console.log(`[TEST 1] Implemented Diagnostic Rules Count: ${ruleCount} (Expected: 108)`);
  if (ruleCount !== 108) throw new Error(`Expected 108 rules, got ${ruleCount}`);

  const graph = await buildAndAnalyzeGraph(pages, []);
  const res = evaluateAllDiagnosticRules(pages, graph);

  console.log(`[TEST 1] Observability Records Count: ${res.ruleExecutionObservability.length} (Expected: 108)`);
  if (res.ruleExecutionObservability.length !== 108) throw new Error(`Expected 108 records, got ${res.ruleExecutionObservability.length}`);

  for (const obs of res.ruleExecutionObservability) {
    if (obs.eligibleCount !== obs.evaluatedCount + obs.skippedCount) {
      throw new Error(`Accounting failure for rule ${obs.ruleCode}: eligible !== evaluated + skipped`);
    }
    if (obs.evaluatedCount !== obs.passedCount + obs.failedCount) {
      throw new Error(`Accounting failure for rule ${obs.ruleCode}: evaluated !== passed + failed`);
    }
  }
  console.log("  ✓ 108/108 Observability Accounting Invariants Passed.");

  // Test 2: IMAGE_ABOVE_FOLD_LAZY_LOADED
  const lazyIssue = res.issues.find((i) => i.code === "IMAGE_ABOVE_FOLD_LAZY_LOADED");
  console.log(`\n[TEST 2] IMAGE_ABOVE_FOLD_LAZY_LOADED:`);
  console.log(`  - Affected Pages: ${lazyIssue?.affectedUniquePages} | Occurrences: ${lazyIssue?.affectedOccurrences}`);
  console.log(`  - Estimated Real Edits: ${lazyIssue?.remediation?.estimatedRealEdits} (Expected: 1)`);
  console.log(`  - Primary Fix Location: ${lazyIssue?.remediation?.primaryFixLocation}`);
  console.log(`  - Clusters Count: ${lazyIssue?.remediation?.clusters?.length}`);
  if (!lazyIssue || lazyIssue.affectedUniquePages !== 108 || lazyIssue.remediation?.estimatedRealEdits !== 1) {
    throw new Error(`IMAGE_ABOVE_FOLD_LAZY_LOADED clustering failed`);
  }
  console.log("  ✓ IMAGE_ABOVE_FOLD_LAZY_LOADED clustered to 1 global edit successfully.");

  // Test 3: ASSET_MISSING_DIMENSIONS
  const dimIssue = res.issues.find((i) => i.code === "ASSET_MISSING_DIMENSIONS");
  console.log(`\n[TEST 3] ASSET_MISSING_DIMENSIONS:`);
  console.log(`  - Affected Pages: ${dimIssue?.affectedUniquePages} | Occurrences: ${dimIssue?.affectedOccurrences}`);
  console.log(`  - Estimated Real Edits: ${dimIssue?.remediation?.estimatedRealEdits} (Expected: 5)`);
  console.log(`  - Clusters Count: ${dimIssue?.remediation?.clusters?.length} (Expected: 3)`);
  for (const cl of dimIssue?.remediation?.clusters || []) {
    console.log(`    * [${cl.clusterId}] ${cl.label}: ~${cl.estimatedRealEdits} edit(s) → ${cl.affectedUniquePages} pages`);
  }
  if (!dimIssue || dimIssue.remediation?.estimatedRealEdits !== 5 || dimIssue.remediation?.clusters?.length !== 3) {
    throw new Error(`ASSET_MISSING_DIMENSIONS clustering failed`);
  }
  console.log("  ✓ ASSET_MISSING_DIMENSIONS clustered to 5 real edits successfully.");

  // Test 4: CONTENT_SKIPPED_HEADINGS
  const headIssue = res.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
  console.log(`\n[TEST 4] CONTENT_SKIPPED_HEADINGS:`);
  console.log(`  - Affected Pages: ${headIssue?.affectedUniquePages} | Occurrences: ${headIssue?.affectedOccurrences}`);
  console.log(`  - Estimated Real Edits: ${headIssue?.remediation?.estimatedRealEdits} (Expected: 2)`);
  console.log(`  - Clusters Count: ${headIssue?.remediation?.clusters?.length} (Expected: 2)`);
  for (const cl of headIssue?.remediation?.clusters || []) {
    console.log(`    * [${cl.clusterId}] ${cl.label}: ~${cl.estimatedRealEdits} edit(s) → ${cl.affectedUniquePages} pages`);
  }
  if (!headIssue || headIssue.remediation?.estimatedRealEdits !== 2 || headIssue.remediation?.clusters?.length !== 2) {
    throw new Error(`CONTENT_SKIPPED_HEADINGS clustering failed`);
  }
  console.log("  ✓ CONTENT_SKIPPED_HEADINGS clustered to 2 CMS templates successfully.");

  // Test 5: SEC_MISSING_NOSNIFF
  const nosniffIssue = res.issues.find((i) => i.code === "SEC_MISSING_NOSNIFF");
  console.log(`\n[TEST 5] SEC_MISSING_NOSNIFF:`);
  console.log(`  - Affected Pages: ${nosniffIssue?.affectedUniquePages} | Real Edits: ${nosniffIssue?.remediation?.estimatedRealEdits}`);
  console.log(`  - Primary Fix Location: ${nosniffIssue?.remediation?.primaryFixLocation} (Expected: CLOUDFLARE)`);
  if (!nosniffIssue || nosniffIssue.remediation?.estimatedRealEdits !== 1 || nosniffIssue.remediation?.primaryFixLocation !== "CLOUDFLARE") {
    throw new Error(`SEC_MISSING_NOSNIFF clustering failed`);
  }
  console.log("  ✓ SEC_MISSING_NOSNIFF clustered to Cloudflare edge rule successfully.");

  // Test 6: Elimination of unknown_shared_component
  console.log(`\n[TEST 6] Verifying zero occurrences of unknown_shared_component...`);
  for (const iss of res.issues) {
    if (iss.componentGuess === "unknown_shared_component") {
      throw new Error(`Forbidden value unknown_shared_component found on rule ${iss.code}`);
    }
  }
  console.log("  ✓ Zero unknown_shared_component occurrences verified across all findings.");

  // Test 7: Category Partial Evaluation Disclosure
  const assetCat = res.categories.find((c) => c.category === "page_speed_assets");
  console.log(`\n[TEST 7] Category Partial Evaluation Disclosure:`);
  console.log(`  - Status: ${assetCat?.evaluationStatus} (Expected: partially_evaluated)`);
  console.log(`  - Reason: ${assetCat?.partialEvaluationReason}`);
  console.log(`  - Missing APIs: ${assetCat?.missingIntegrations?.join(", ")}`);
  if (assetCat?.evaluationStatus !== "partially_evaluated" || !assetCat?.partialEvaluationReason?.includes("3 / 5 checks evaluated")) {
    throw new Error(`Category partial evaluation disclosure failed`);
  }
  console.log("  ✓ Category Partial Evaluation Disclosure verified.");

  console.log("\n===============================================================================");
  console.log("ALL 7 REMEDIATION INTELLIGENCE REGRESSION TESTS PASSED (100% SUCCESS)");
  console.log("===============================================================================");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
