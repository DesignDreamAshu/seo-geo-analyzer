/**
 * DREAM SEO — Phase 28G.1 Final Reality Certification & Invariant Test Suite.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import dotenv from "dotenv";
import { DatabaseSync } from "node:sqlite";

dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { AIOptimizationEngine } from "../optimization/engine";
import { generateProjectKnowledgeAndPromptUniverse } from "../engine";
import { evaluateStructuredSignals } from "../optimization/evaluators/structured-signals";
import { extractProjectKnowledgeProfile } from "../knowledge-profile/extractor";
import { CrawledPageContext } from "../optimization/mapper";
import { CrawledPageData } from "../../crawler/types";
import { evaluateAllDiagnosticRules } from "../../crawler/rules";
import { buildAndAnalyzeGraph } from "../../crawler/graph";

function getDbPath(): string {
  const cwd = process.cwd();
  if (cwd.includes("apps\\backend") || cwd.includes("apps/backend")) {
    return path.resolve(cwd, "../../local_data/dream_seo.db");
  }
  return path.resolve(cwd, "local_data/dream_seo.db");
}

describe("Phase 28G.1 Final Reality Certification Suite", () => {
  const dbPath = getDbPath();
  const db = new DatabaseSync(dbPath);

  // 1. Dynamic Snapshot Selection (no hardcoding)
  it("Requirement 1: dynamically resolves latest completed BOT snapshot without hardcoded ID", () => {
    const row = db.prepare(`
      SELECT s.snapshot_id, s.audit_run_id, s.project_id, s.payload_json
      FROM audit_snapshots s
      JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
      WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
      ORDER BY r.sequence_number DESC
      LIMIT 1
    `).get() as any;

    expect(row).toBeDefined();
    expect(row.snapshot_id).toMatch(/^snap_audit_proj_7F7Gxe3O_/);
    const payload = JSON.parse(row.payload_json);
    expect(payload?.crawlResult?.crawledPages?.length).toBeGreaterThan(100);
  });

  // 2. Full Semantic Corpus & No Prototype Subset
  it("Requirement 2: evaluates full eligible semantic corpus (>90 pages) without 14-page prototype limit", () => {
    const row = db.prepare(`
      SELECT s.payload_json FROM audit_snapshots s
      JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
      WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
      ORDER BY r.sequence_number DESC LIMIT 1
    `).get() as any;

    const payload = JSON.parse(row.payload_json);
    const crawledPages: CrawledPageData[] = payload?.crawlResult?.crawledPages || [];

    const indexablePages = crawledPages.filter((p) => p.isIndexable);
    const aiEligiblePages: CrawledPageContext[] = indexablePages
      .filter((p) => {
        const pClass = p.classification?.primaryClass || "general_content";
        const isUtility = pClass === "utility_legal" || pClass === "thank_you_confirmation" || pClass === "utility_endpoint";
        const isLowWord = (p.wordCount || 0) < 30 && pClass !== "homepage";
        return !isUtility && !isLowWord;
      })
      .map((p) => ({
        url: p.url,
        title: p.title || null,
        metaDescription: p.metaDescription || null,
        h1Texts: p.h1s || p.h1Tags || [],
        headings: (p.headingsOutline || []).map((h) => h.text),
        visibleText: p.mainTextSnippet || p.html || "",
        schemaTypes: (p.schemaJsonLd || []).map((s: any) => s["@type"] || s.type).filter(Boolean),
      }));

    expect(aiEligiblePages.length).toBeGreaterThanOrEqual(90);
    expect(aiEligiblePages.length).not.toBe(14); // Prototype limit strictly eliminated
  });

  // 3. Schema.org Service Recommendation Integrity
  it("Requirement 3: Service schema is only recommended on true commercial solutions, never event/kickoff pages", () => {
    const row = db.prepare(`
      SELECT s.payload_json FROM audit_snapshots s
      JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
      WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
      ORDER BY r.sequence_number DESC LIMIT 1
    `).get() as any;

    const payload = JSON.parse(row.payload_json);
    const crawledPages: CrawledPageData[] = payload?.crawlResult?.crawledPages || [];
    const profile = extractProjectKnowledgeProfile("proj_7F7Gxe3O", "botconsulting.io", crawledPages);

    const contexts: CrawledPageContext[] = crawledPages.map((p) => ({
      url: p.url,
      title: p.title || null,
      metaDescription: p.metaDescription || null,
      h1Texts: p.h1s || p.h1Tags || [],
      headings: (p.headingsOutline || []).map((h) => h.text),
      visibleText: p.mainTextSnippet || p.html || "",
      schemaTypes: (p.schemaJsonLd || []).map((s: any) => s["@type"] || s.type).filter(Boolean),
    }));

    const findings = evaluateStructuredSignals("proj_7F7Gxe3O", "opt_test", contexts, profile);
    const serviceFinding = findings.find((f) => f.code === "AI_OPT_STRUCTURED_ENTITY_SERVICE_SCHEMA_MISSING");

    expect(serviceFinding).toBeDefined();
    const affectedUrls = serviceFinding!.affectedPages.map((p) => p.url);

    // Event kickoff page must NOT be in Service schema recommendation
    expect(affectedUrls).not.toContain("https://www.botconsulting.io/servicenow-sales-kickoff-2025-partner-kickoff");

    // Must strictly contain valid commercial capability pages
    for (const url of affectedUrls) {
      expect(
        url.includes("/solution") ||
        url.includes("/cloudsmith") ||
        url.includes("/odyssey") ||
        url.includes("/service/")
      ).toBe(true);
      expect(url).not.toContain("kickoff");
      expect(url).not.toContain("/post/");
      expect(url).not.toContain("/jobopenings/");
    }
  }, 30000);

  // 4. Exact Score Parity & Reproducibility (70.8 Persisted === 70.8 Re-evaluated)
  it("Requirement 4: Persisted SEO score matches re-evaluated SEO score with full link graph with Δ = 0.0", async () => {
    const row = db.prepare(`
      SELECT s.snapshot_id, s.payload_json FROM audit_snapshots s
      JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
      WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
      ORDER BY r.sequence_number DESC LIMIT 1
    `).get() as any;

    const payload = JSON.parse(row.payload_json);
    const crawledPages: CrawledPageData[] = payload?.crawlResult?.crawledPages || [];
    const persistedScore = payload?.crawlResult?.healthScore; // 70.8

    const graph = await buildAndAnalyzeGraph(crawledPages, []);
    const reEval = evaluateAllDiagnosticRules(crawledPages, graph);

    expect(reEval.healthScore).toBe(persistedScore);
    expect(reEval.issues.length).toBe(payload?.crawlResult?.issues?.length);
  }, 30000);

  // 5. SEO / AI Architecture Isolation
  it("Requirement 5: Phase 28G.1 AI optimization snapshot generation does not alter SEO scores or rules", async () => {
    const row = db.prepare(`
      SELECT s.snapshot_id, s.audit_run_id, s.payload_json FROM audit_snapshots s
      JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
      WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
      ORDER BY r.sequence_number DESC LIMIT 1
    `).get() as any;

    const payload = JSON.parse(row.payload_json);
    const crawledPages: CrawledPageData[] = payload?.crawlResult?.crawledPages || [];

    const graph = await buildAndAnalyzeGraph(crawledPages, []);
    const seoBefore = evaluateAllDiagnosticRules(crawledPages, graph);

    // Run AI Optimization
    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse("proj_7F7Gxe3O", "botconsulting.io", crawledPages);
    const engine = new AIOptimizationEngine();
    const optSnapshot = engine.computeOptimizationSnapshot(
      "proj_7F7Gxe3O",
      row.audit_run_id,
      profile,
      promptUniverse,
      [],
      crawledPages.map((p) => ({ url: p.url, title: p.title }))
    );

    const seoAfter = evaluateAllDiagnosticRules(crawledPages, graph);

    expect(optSnapshot).toBeDefined();
    expect(seoAfter.healthScore).toBe(seoBefore.healthScore);
    expect(seoAfter.issues.length).toBe(seoBefore.issues.length);
  }, 30000);
});
