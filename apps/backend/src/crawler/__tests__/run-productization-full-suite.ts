import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { evaluateAllDiagnosticRules } from "../rules";
import { buildAndAnalyzeGraph } from "../graph";
import { IMPLEMENTED_DIAGNOSTIC_RULES, getImplementedRulesCount } from "../verification/rule-inventory";
import { evaluateOnSiteAISearchReadiness, generateProjectKnowledgeAndPromptUniverse } from "../../ai-search/engine";

async function runFullSuite() {
  console.log("===============================================================================");
  console.log("DREAM SEO — FULL PRODUCTIZATION & INVARIANT VERIFICATION SUITE");
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
  console.log(`Loaded ${pages.length} crawled pages for BOT Consulting (proj_7F7Gxe3O).`);

  // ==========================================
  // SECTION 1: SEO ENGINE & INVARIANTS
  // ==========================================
  console.log("\n--- SECTION 1: SEO ENGINE & INVARIANTS ---");
  const ruleCount = getImplementedRulesCount();
  console.log(`[REQ 1.1] 108 Production Rules Count: ${ruleCount} / 108`);
  if (ruleCount !== 108) throw new Error(`Expected 108 rules, got ${ruleCount}`);

  const graph = await buildAndAnalyzeGraph(pages, []);
  const seoRes = evaluateAllDiagnosticRules(pages, graph);

  console.log(`[REQ 1.2] SEO Health Score: ${seoRes.healthScore} (Invariant exact score: 72.3)`);
  if (seoRes.healthScore !== 72.3) throw new Error(`SEO Health Score mutated! Expected 72.3, got ${seoRes.healthScore}`);

  console.log(`[REQ 1.3] 108/108 Observability Accounting Check:`);
  if (seoRes.ruleExecutionObservability.length !== 108) {
    throw new Error(`Expected 108 observability records, got ${seoRes.ruleExecutionObservability.length}`);
  }
  for (const obs of seoRes.ruleExecutionObservability) {
    if (obs.eligibleCount !== obs.evaluatedCount + obs.skippedCount) {
      throw new Error(`Accounting violation in rule ${obs.ruleCode}`);
    }
    if (obs.evaluatedCount !== obs.passedCount + obs.failedCount) {
      throw new Error(`Accounting violation in rule ${obs.ruleCode}`);
    }
  }
  console.log("  ✓ 108/108 Rule Execution Accounting Passed.");

  // ==========================================
  // SECTION 2: REMEDIATION & SYSTEMIC CLUSTERING
  // ==========================================
  console.log("\n--- SECTION 2: REMEDIATION & SYSTEMIC CLUSTERING ---");
  const lazyIssue = seoRes.issues.find((i) => i.code === "IMAGE_ABOVE_FOLD_LAZY_LOADED");
  console.log(`[REQ 2.1] IMAGE_ABOVE_FOLD_LAZY_LOADED: ${lazyIssue?.affectedUniquePages} pages → ~${lazyIssue?.remediation?.estimatedRealEdits} real edit(s)`);
  if (lazyIssue?.remediation?.estimatedRealEdits !== 1) throw new Error("Lazy load clustering failed");

  const dimIssue = seoRes.issues.find((i) => i.code === "ASSET_MISSING_DIMENSIONS");
  console.log(`[REQ 2.2] ASSET_MISSING_DIMENSIONS: ${dimIssue?.affectedOccurrences} occs across ${dimIssue?.affectedUniquePages} pages → ~${dimIssue?.remediation?.estimatedRealEdits} real edit(s) (${dimIssue?.remediation?.clusters?.length} clusters)`);
  if (dimIssue?.remediation?.estimatedRealEdits !== 5 || dimIssue?.remediation?.clusters?.length !== 3) throw new Error("Missing dimensions clustering failed");

  const headIssue = seoRes.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
  console.log(`[REQ 2.3] CONTENT_SKIPPED_HEADINGS: ${headIssue?.affectedUniquePages} pages → ~${headIssue?.remediation?.estimatedRealEdits} real edit(s) (${headIssue?.remediation?.clusters?.length} clusters)`);
  if (headIssue?.remediation?.estimatedRealEdits !== 2 || headIssue?.remediation?.clusters?.length !== 2) throw new Error("Skipped headings clustering failed");

  for (const iss of seoRes.issues) {
    if (iss.componentGuess === "unknown_shared_component") {
      throw new Error(`Forbidden value unknown_shared_component found on rule ${iss.code}`);
    }
  }
  console.log("  ✓ Elimination of unknown_shared_component verified across all findings.");

  // ==========================================
  // SECTION 3: DETERMINISTIC AI SEARCH READINESS
  // ==========================================
  console.log("\n--- SECTION 3: DETERMINISTIC AI SEARCH READINESS ---");
  const aiReport = evaluateOnSiteAISearchReadiness(pages);
  console.log(`[REQ 3.1] AI Search System: ${aiReport.system} (Methodology: ${aiReport.methodologyVersion})`);
  console.log(`[REQ 3.2] 4 Core Pillar Scores:`);
  console.log(`  - Technical Accessibility (AIO): ${aiReport.scores.technicalAccessibility.score}%`);
  console.log(`  - AEO Answer Readiness: ${aiReport.scores.aeoReadiness.score}%`);
  console.log(`  - GEO Evidence Readiness: ${aiReport.scores.geoEvidenceReadiness.score}%`);
  console.log(`  - Entity Grounding (LLMO): ${aiReport.scores.entityGrounding.score}%`);
  console.log(`[REQ 3.3] AI Readiness Findings Count: ${aiReport.findings.length}`);
  if (aiReport.findings.length === 0) throw new Error("AI Readiness findings unexpectedly empty");

  // ==========================================
  // SECTION 4: KNOWLEDGE PROFILE & 132 CANONICAL PROMPTS
  // ==========================================
  console.log("\n--- SECTION 4: KNOWLEDGE PROFILE & 132 CANONICAL PROMPTS ---");
  const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
    "proj_7F7Gxe3O",
    "botconsulting.io",
    pages
  );
  console.log(`[REQ 4.1] Knowledge Profile Brand: "${profile.brand.name}"`);
  console.log(`[REQ 4.2] Offerings Extracted: ${profile.offerings.length} | Entities: ${profile.entities.length} | Topics: ${profile.topics.length}`);
  console.log(`[REQ 4.3] Canonical Knowledge Prompts Count: ${promptUniverse.allCandidates.length} (Expected: 132)`);
  if (promptUniverse.allCandidates.length !== 132) {
    throw new Error(`Expected 132 canonical prompts, got ${promptUniverse.allCandidates.length}`);
  }
  console.log(`[REQ 4.4] Monitoring Set Count: ${promptUniverse.monitoringSet.length} | Clusters: ${promptUniverse.clusters.length}`);
  console.log("  ✓ 132 Canonical Prompts and Knowledge Profile verified.");

  // ==========================================
  // SECTION 5: BACKWARD COMPATIBILITY
  // ==========================================
  console.log("\n--- SECTION 5: BACKWARD COMPATIBILITY ---");
  const legacyPages = pages.slice(0, 10).map((p: any) => {
    const clone = { ...p };
    delete clone.facts?.aiCrawlers;
    delete clone.classification?.aiIntent;
    return clone;
  });
  const legacyRes = evaluateAllDiagnosticRules(legacyPages);
  console.log(`[REQ 5.1] Legacy Pages Crawl Evaluation: ${legacyRes.issues.length} issues generated gracefully.`);
  const legacyAiReport = evaluateOnSiteAISearchReadiness(legacyPages);
  console.log(`[REQ 5.2] Legacy Pages AI Readiness: ${legacyAiReport.scores.aeoReadiness.score}% AEO score generated gracefully.`);
  console.log("  ✓ Backward compatibility validated.");

  console.log("\n===============================================================================");
  console.log("ALL PRODUCTIZATION & REQUISITE VERIFICATION INVARIANTS PASSED (100% SUCCESS)");
  console.log("===============================================================================");
}

runFullSuite().catch((err) => {
  console.error("Full suite execution failed:", err);
  process.exit(1);
});
