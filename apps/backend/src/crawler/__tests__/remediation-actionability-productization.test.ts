import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { evaluateAllDiagnosticRules } from "../rules";
import { buildAndAnalyzeGraph } from "../graph";
import { IMPLEMENTED_DIAGNOSTIC_RULES, getImplementedRulesCount } from "../verification/rule-inventory";
import { buildActionableRemediation } from "../fix-intelligence/remediation-normalizer";

describe("Remediation Intelligence & Report Actionability Certification", () => {
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
    it.skip("No BOT Consulting audit snapshot found in database", () => {});
    return;
  }

  const payload = JSON.parse(row.payload_json);
  const pages = payload.crawlResult?.crawledPages || [];

  it("1. Verifies 108 Implemented Diagnostic Rules and 108/108 Observability Accounting", async () => {
    expect(getImplementedRulesCount()).toBe(108);
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);

    expect(res.ruleExecutionObservability.length).toBe(108);
    for (const obs of res.ruleExecutionObservability) {
      expect(obs.eligibleCount).toBe(obs.evaluatedCount + obs.skippedCount);
      expect(obs.evaluatedCount).toBe(obs.passedCount + obs.failedCount);
    }
  });

  it("2. Verifies IMAGE_ABOVE_FOLD_LAZY_LOADED clusters 108 pages into 1 Global Edit", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);
    const issue = res.issues.find((i) => i.code === "IMAGE_ABOVE_FOLD_LAZY_LOADED");

    expect(issue).toBeDefined();
    expect(issue!.affectedUniquePages).toBe(108);
    expect(issue!.affectedOccurrences).toBe(108);
    expect(issue!.remediation).toBeDefined();
    expect(issue!.remediation!.estimatedRealEdits).toBe(1);
    expect(issue!.remediation!.fixScope).toBe("GLOBAL_TEMPLATE_QUICK_WIN");
    expect(issue!.remediation!.clusters.length).toBeGreaterThanOrEqual(1);
    expect(issue!.remediation!.clusters[0].estimatedRealEdits).toBe(1);
  });

  it("3. Verifies ASSET_MISSING_DIMENSIONS clusters 86 occurrences into 5 Real Edits", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);
    const issue = res.issues.find((i) => i.code === "ASSET_MISSING_DIMENSIONS");

    expect(issue).toBeDefined();
    expect(issue!.affectedUniquePages).toBe(45);
    expect(issue!.affectedOccurrences).toBe(86);
    expect(issue!.remediation).toBeDefined();
    expect(issue!.remediation!.estimatedRealEdits).toBe(5);
    expect(issue!.remediation!.clusters.length).toBe(3); // Blog post rich text, Solutions/case studies, Static
  });

  it("4. Verifies CONTENT_SKIPPED_HEADINGS clusters 63 pages into 2 CMS Templates", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);
    const issue = res.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");

    expect(issue).toBeDefined();
    expect(issue!.affectedUniquePages).toBe(63);
    expect(issue!.remediation).toBeDefined();
    expect(issue!.remediation!.estimatedRealEdits).toBe(2);
    expect(issue!.remediation!.clusters.length).toBe(2); // Blog post template (52) + Job openings template (11)
  });

  it("5. Verifies SEC_MISSING_NOSNIFF clusters 112 pages into 1 Edge / Cloudflare Rule", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);
    const issue = res.issues.find((i) => i.code === "SEC_MISSING_NOSNIFF");

    expect(issue).toBeDefined();
    expect(issue!.affectedUniquePages).toBe(112);
    expect(issue!.remediation).toBeDefined();
    expect(issue!.remediation!.estimatedRealEdits).toBe(1);
    expect(issue!.remediation!.primaryFixLocation).toBe("CLOUDFLARE");
  });

  it("6. Verifies elimination of 'unknown_shared_component' across all findings", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);

    for (const issue of res.issues) {
      expect(issue.componentGuess).not.toBe("unknown_shared_component");
    }
  });

  it("7. Verifies mathematical invariants and score precision across all findings", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);

    for (const issue of res.issues) {
      expect(issue.affectedUniquePages).toBeLessThanOrEqual(issue.affectedOccurrences);
      expect(issue.remediation?.potentialScoreGain).toBeGreaterThanOrEqual(0);
      expect(issue.remediation?.estimatedRealEdits).toBeLessThanOrEqual(issue.affectedUniquePages);
    }
  });

  it("8. Verifies Category Partial Evaluation metadata for Assets & Performance", async () => {
    const graph = await buildAndAnalyzeGraph(pages, []);
    const res = evaluateAllDiagnosticRules(pages, graph);
    const assetCat = res.categories.find((c) => c.category === "page_speed_assets");

    expect(assetCat).toBeDefined();
    expect(assetCat!.evaluationStatus).toBe("partially_evaluated");
    expect(assetCat!.partialEvaluationReason).toContain("3 / 5 checks evaluated");
    expect(assetCat!.missingIntegrations).toBeDefined();
    expect(assetCat!.missingIntegrations!.length).toBeGreaterThanOrEqual(1);
  });
});
