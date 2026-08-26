import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { existsSync } from "node:fs";
import { reconstructModulesFromCrawlResult } from "../../analysis/reconstruct-modules";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../verification/certify-parity-matrix";
import { evaluateAllDiagnosticRules } from "../rules";
import { buildAndAnalyzeGraph } from "../graph";

function getDbPath(): string {
  const cwd = process.cwd();
  if (cwd.includes("apps\\backend") || cwd.includes("apps/backend")) {
    return path.resolve(cwd, "../../local_data/dream_seo.db");
  }
  return path.resolve(cwd, "local_data/dream_seo.db");
}

describe("Single-Page Modules Regression Suite", () => {
  let db: DatabaseSync;
  let botPayload: any;
  let botAuditRunId: string;

  beforeAll(() => {
    const dbPath = getDbPath();
    expect(existsSync(dbPath)).toBe(true);
    db = new DatabaseSync(dbPath);

    const row = db
      .prepare(`
        SELECT s.snapshot_id, s.audit_run_id, s.payload_json
        FROM audit_snapshots s
        JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
        WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
        ORDER BY r.sequence_number DESC
        LIMIT 1
      `)
      .get() as any;

    expect(row).toBeDefined();
    botAuditRunId = row.audit_run_id;
    botPayload = JSON.parse(row.payload_json);
  });

  it("1. Reconstructs all 8 canonical Single-Page Modules from completed BOT Consulting crawl", () => {
    const crawlResult = botPayload.crawlResult;
    expect(crawlResult).toBeDefined();
    expect(crawlResult.crawledPages.length).toBeGreaterThanOrEqual(90);

    const modules = reconstructModulesFromCrawlResult(crawlResult);
    expect(modules).toBeDefined();
    expect(modules.length).toBe(8);

    const keys = modules.map((m) => m.key);
    expect(keys).toContain("performance");
    expect(keys).toContain("schema");
    expect(keys).toContain("geo");
    expect(keys).toContain("seo_basics");
    expect(keys).toContain("social");
    expect(keys).toContain("security");
    expect(keys).toContain("accessibility");
    expect(keys).toContain("links");

    // Every module must have valid score between 0 and 10
    for (const m of modules) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(10);
      expect(m.weight).toBeGreaterThan(0);
      expect(m.summary.length).toBeGreaterThan(5);
      expect(m.details?.highlights?.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("2. Validates accurate evidence-backed details across all modules", () => {
    const modules = reconstructModulesFromCrawlResult(botPayload.crawlResult);
    
    // SEO Basics
    const seoBasics = modules.find((m) => m.key === "seo_basics")!;
    expect(seoBasics.score).toBe(10);
    const titleHighlight = seoBasics.details?.highlights?.find((h) => h.label.includes("Title"));
    expect(titleHighlight).toBeDefined();

    // Security
    const security = modules.find((m) => m.key === "security")!;
    expect(security.score).toBe(10);
    expect(security.summary).toContain("HTTPS");

    // Schema
    const schema = modules.find((m) => m.key === "schema")!;
    expect(schema.score).toBeGreaterThan(0);

    // Accessibility
    const accessibility = modules.find((m) => m.key === "accessibility")!;
    expect(accessibility.score).toBeGreaterThanOrEqual(8);
  });

  it("3. Historical Compatibility: Reconstructs modules for legacy/empty audits without mutation", () => {
    // Empty result returns []
    expect(reconstructModulesFromCrawlResult(null)).toEqual([]);
    expect(reconstructModulesFromCrawlResult({})).toEqual([]);

    // Single seed page crawl
    const minimalCrawl = {
      seedUrl: "https://example.com",
      crawledPages: [
        {
          url: "https://example.com",
          title: "Example Domain Title That Is Good",
          metaDescription: "This is an example meta description that satisfies length guidelines perfectly.",
          h1s: ["Example Header"],
          responseTimeMs: 200,
          isIndexable: true,
          schemaJsonLd: [{ "@type": "Organization", name: "Example Corp" }],
        },
      ],
    };

    const minimalModules = reconstructModulesFromCrawlResult(minimalCrawl);
    expect(minimalModules.length).toBe(8);
    expect(minimalModules.find((m) => m.key === "seo_basics")?.score).toBeGreaterThanOrEqual(9);
    expect(minimalModules.find((m) => m.key === "schema")?.score).toBeGreaterThan(5);
  });

  it(
    "4. SEO Invariant Safety: 108 Rules, 118 Dimensions, 108/108 Accounting, Score Parity",
    async () => {
      expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
      expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

      const crawledPages = botPayload.crawlResult.crawledPages;
      const graph = await buildAndAnalyzeGraph(crawledPages, []);
      const reEval = evaluateAllDiagnosticRules(crawledPages, graph);

      expect(reEval.ruleExecutionObservability.length).toBe(108);
      const persistedScore = botPayload.crawlResult.websiteHealthScore ?? botPayload.crawlResult.healthScore;
      expect(reEval.healthScore).toBe(persistedScore);
    },
    30000
  );
});
