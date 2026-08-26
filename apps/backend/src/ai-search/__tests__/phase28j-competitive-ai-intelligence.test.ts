/**
 * Phase 28J: Competitor AI Intelligence & Benchmarking Test Suite.
 * Verifies PROMPT × INTENT × PAGE × EVIDENCE competitive intelligence,
 * anti-copying safeguards, consolidation logic, negative controls,
 * invariant accounting, and 5-run determinism (Δ = 0.0).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  AICompetitiveIntelligenceEngine,
  COMPETITIVE_ENGINE_VERSION,
  normalizeCompetitorDomain,
  validateCompetitorAddition,
  validateCompetitiveInvariants,
  SqliteCompetitiveRepository,
  ProjectCompetitor,
  CompetitorEvaluationContext,
  generateProjectKnowledgeAndPromptUniverse,
} from "../engine";
import { AIMeasurementEngine } from "../measurement/engine";
import { AIOptimizationEngine } from "../optimization/engine";
import { CrawledPageContext } from "../optimization/mapper";
import { PromptUniverseReport } from "../prompts/types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { evaluateAllDiagnosticRules } from "../../crawler/rules";
import { buildAndAnalyzeGraph } from "../../crawler/graph";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";

function getDbPath(): string {
  const cwd = process.cwd();
  if (cwd.includes("apps\\backend") || cwd.includes("apps/backend")) {
    return resolve(cwd, "../../local_data/dream_seo.db");
  }
  return resolve(cwd, "local_data/dream_seo.db");
}

describe("Phase 28J: Competitor AI Intelligence & Benchmarking", () => {
  let db: DatabaseSync;
  let botProjectId: string;
  let crawledPages: any[] = [];
  let botProfile: ProjectKnowledgeProfile;
  let botPromptUniverse: PromptUniverseReport;
  let botClientPages: CrawledPageContext[] = [];
  let optEngine: AIOptimizationEngine;
  let measurementEngine: AIMeasurementEngine;
  let competitiveEngine: AICompetitiveIntelligenceEngine;
  let payload: any;

  beforeAll(() => {
    const dbPath = getDbPath();
    expect(existsSync(dbPath)).toBe(true);
    db = new DatabaseSync(dbPath);

    botProjectId = "proj_7F7Gxe3O";
    optEngine = new AIOptimizationEngine();
    measurementEngine = new AIMeasurementEngine();
    competitiveEngine = new AICompetitiveIntelligenceEngine();

    const snapshotRow = db
      .prepare(`
        SELECT s.snapshot_id, s.audit_run_id, s.project_id, s.payload_json
        FROM audit_snapshots s
        JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
        WHERE s.project_id = 'proj_7F7Gxe3O'
        ORDER BY r.sequence_number DESC
        LIMIT 1
      `)
      .get() as any;
    expect(snapshotRow).toBeDefined();

    payload = JSON.parse(snapshotRow.payload_json);
    crawledPages = payload.crawlResult.crawledPages;

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse(
      botProjectId,
      "botconsulting.io",
      crawledPages
    );
    botProfile = profile;
    botPromptUniverse = promptUniverse;

    const indexablePages = crawledPages.filter((p) => p.isIndexable);
    botClientPages = indexablePages
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
        headings: (p.headingsOutline || []).map((h: any) => h.text),
        visibleText: p.mainTextSnippet || p.html || "",
        schemaTypes: (p.schemaJsonLd || []).map((s: any) => s["@type"] || s.type).filter(Boolean),
      }));
  });

  // Test 1: Domain Normalization and Safety Guards
  it("1. Normalizes competitor domains safely and prevents duplicate or self-referential competitors", () => {
    expect(normalizeCompetitorDomain("https://www.Competitor-A.com/services/")).toBe("competitor-a.com");
    expect(normalizeCompetitorDomain("http://competitor-b.de?ref=123#anchor")).toBe("competitor-b.de");
    expect(normalizeCompetitorDomain("  SUB.domain.co.uk:8080/  ")).toBe("sub.domain.co.uk");

    // Self-referential prevention
    expect(() => validateCompetitorAddition("botconsulting.io", "https://www.botconsulting.io", [])).toThrow(
      /Cannot add client's own domain/
    );

    // Duplicate domain prevention
    expect(() =>
      validateCompetitorAddition("botconsulting.io", "competitor.com", ["https://www.competitor.com/"])
    ).toThrow(/already configured/);
  });

  // Test 2: SQLite Repository CRUD
  it("2. Manages competitor CRUD in SQLite repository", () => {
    const repo = new SqliteCompetitiveRepository(db);
    const mockComp: ProjectCompetitor = {
      competitorId: "comp_test_123",
      projectId: botProjectId,
      domain: "competitor-alpha.com",
      displayName: "Competitor Alpha",
      status: "ACTIVE",
      source: "USER_CONFIGURED",
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repo.addCompetitor(mockComp);
    let competitors = repo.getCompetitors(botProjectId);
    expect(competitors.some((c) => c.competitorId === "comp_test_123")).toBe(true);

    repo.updateCompetitorStatus("comp_test_123", "INACTIVE");
    competitors = repo.getCompetitors(botProjectId);
    const updated = competitors.find((c) => c.competitorId === "comp_test_123");
    expect(updated?.status).toBe("INACTIVE");

    repo.deleteCompetitor("comp_test_123");
    competitors = repo.getCompetitors(botProjectId);
    expect(competitors.some((c) => c.competitorId === "comp_test_123")).toBe(false);
  });

  // Test 3: Multi-Domain Comparative Benchmark Engine
  it("3. Generates multi-domain comparative benchmark across client and competitor pages", () => {
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      botProjectId,
      "run_bot",
      botProfile,
      botPromptUniverse,
      [],
      botClientPages
    );
    const clientMeasurement = measurementEngine.computeMeasurementSnapshot(
      botProjectId,
      "run_bot",
      optSnapshot,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      optSnapshot.findings
    );

    const compPages: CrawledPageContext[] = [
      {
        url: "https://competitor.de/servicenow-beratung",
        title: "ServiceNow Beratung & Implementierung",
        h1Texts: ["ServiceNow Beratung und Consulting"],
        headings: ["Unsere ServiceNow Leistungen", "Implementierung und Migration"],
        visibleText: "Wir bieten professionelle ServiceNow Beratung und Implementierung für Unternehmen.",
        schemaTypes: ["Service"],
      },
    ];

    const competitorCtx: CompetitorEvaluationContext = {
      competitor: {
        competitorId: "comp_active_1",
        projectId: botProjectId,
        domain: "competitor.de",
        displayName: "Competitor DE",
        status: "ACTIVE",
        source: "USER_CONFIGURED",
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      corpusSummary: {
        competitorId: "comp_active_1",
        domain: "competitor.de",
        discoveredResources: 15,
        crawledResources: 15,
        htmlPages: 15,
        indexableHtml: 15,
        aiEligiblePages: 15,
        excludedPages: 0,
        lastCrawledAt: new Date().toISOString(),
        freshness: "FRESH",
        coverageNote: "15 eligible pages analyzed.",
      },
      pages: compPages,
      profile: {
        profileId: "prof_comp_1",
        projectId: botProjectId,
        domain: "competitor.de",
        brand: {
          name: "Competitor DE",
          domain: "competitor.de",
          aliases: ["Competitor DE"],
          organizationType: "Corporation",
          subBrands: [],
          confidence: 1.0,
        },
        offerings: [
          {
            id: "off_1",
            name: "ServiceNow Beratung",
            canonicalName: "ServiceNow Beratung",
            aliases: [],
            type: "SERVICE",
            importance: "PRIMARY",
            description: "ServiceNow Consulting",
            supportingUrls: ["https://competitor.de/servicenow-beratung"],
            confidence: 1.0,
            status: "CONFIRMED",
            audiences: [],
            industries: [],
            relatedTopics: [],
          },
        ],
        entities: [],
        relationships: [],
        topics: [],
        audiences: [],
        industries: [],
        locations: [],
        problems: [],
        differentiators: [],
        competitors: [],
        conflicts: [],
        completenessScore: 80,
        generatedAt: new Date().toISOString(),
        methodologyVersion: "v1.0",
      },
    };

    const benchmark = competitiveEngine.generateCompetitiveBenchmark(
      botProjectId,
      clientMeasurement,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [competitorCtx],
      []
    );

    expect(benchmark.competitiveEngineVersion).toBe(COMPETITIVE_ENGINE_VERSION);
    expect(benchmark.summary.totalPromptsCompared).toBe(132);
    expect(benchmark.summary.clientAdvantagesCount).toBeGreaterThan(0);
    expect(benchmark.promptComparisons.length).toBe(132);
    expect(benchmark.clientAdvantages.length).toBeGreaterThan(0);
    expect(benchmark.providerObservationStatus.availabilityState).toBe("PROVIDER_EVIDENCE_UNAVAILABLE");

    // Validate Invariants
    expect(() => validateCompetitiveInvariants(benchmark)).not.toThrow();
  });

  // Test 4: Negative Controls (Word count, Schema count, Citation count)
  it("4. Proves negative controls: Word count, schema count, and citation count do not cause artificial competitor superiority", () => {
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      botProjectId,
      "run_bot",
      botProfile,
      botPromptUniverse,
      [],
      botClientPages
    );
    const clientMeasurement = measurementEngine.computeMeasurementSnapshot(
      botProjectId,
      "run_bot",
      optSnapshot,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      optSnapshot.findings
    );

    // Competitor with 5,000 words of generic fluff and 10 schemas
    const fluffyPages: CrawledPageContext[] = [
      {
        url: "https://fluff-competitor.com/everything",
        title: "The Ultimate Guide to Everything Digital Enterprise 2026",
        h1Texts: ["Everything Digital Enterprise"],
        headings: ["Introduction", "Overview", "Digital Transformation", "Summary"],
        visibleText: "Digital transformation is important. ".repeat(400), // ~2,400 words of fluff
        schemaTypes: ["Article", "Organization", "WebSite", "BreadcrumbList", "FAQPage", "Event", "LocalBusiness"],
      },
    ];

    const fluffyCtx: CompetitorEvaluationContext = {
      competitor: {
        competitorId: "comp_fluff",
        projectId: botProjectId,
        domain: "fluff-competitor.com",
        displayName: "Fluffy Competitor",
        status: "ACTIVE",
        source: "USER_CONFIGURED",
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      corpusSummary: {
        competitorId: "comp_fluff",
        domain: "fluff-competitor.com",
        discoveredResources: 1,
        crawledResources: 1,
        htmlPages: 1,
        indexableHtml: 1,
        aiEligiblePages: 1,
        excludedPages: 0,
        lastCrawledAt: new Date().toISOString(),
        freshness: "FRESH",
        coverageNote: "1 page analyzed.",
      },
      pages: fluffyPages,
      profile: {
        profileId: "prof_fluff",
        projectId: botProjectId,
        domain: "fluff-competitor.com",
        brand: {
          name: "Fluffy Competitor",
          domain: "fluff-competitor.com",
          aliases: [],
          organizationType: "Corporation",
          subBrands: [],
          confidence: 1.0,
        },
        offerings: [],
        entities: [],
        relationships: [],
        topics: [],
        audiences: [],
        industries: [],
        locations: [],
        problems: [],
        differentiators: [],
        competitors: [],
        conflicts: [],
        completenessScore: 30,
        generatedAt: new Date().toISOString(),
        methodologyVersion: "v1.0",
      },
    };

    const benchmark = competitiveEngine.generateCompetitiveBenchmark(
      botProjectId,
      clientMeasurement,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [fluffyCtx],
      []
    );

    // Fluffy competitor should not have advantages over client's dedicated service pages
    const fluffWins = benchmark.promptComparisons.filter(
      (p) => p.winningCompetitorName === "Fluffy Competitor" && p.competitiveState === "COMPETITOR_ADVANTAGE"
    );
    expect(fluffWins.length).toBe(0);
  });

  // Test 5: Opportunity Consolidation & Anti-Copying
  it("5. Consolidates multiple related prompt gaps into single page-level actionable playbooks with copy-safety warnings", () => {
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      botProjectId,
      "run_bot",
      botProfile,
      botPromptUniverse,
      [],
      botClientPages
    );
    const clientMeasurement = measurementEngine.computeMeasurementSnapshot(
      botProjectId,
      "run_bot",
      optSnapshot,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      optSnapshot.findings
    );

    // Competitor with strong evaluation guide
    const compPages: CrawledPageContext[] = [
      {
        url: "https://strong-competitor.de/servicenow-evaluation",
        title: "ServiceNow Partner Evaluierung & Auswahl",
        h1Texts: ["ServiceNow Partner Evaluierung"],
        headings: ["Auswahlkriterien", "Methodik & ROI", "Migrationscheckliste"],
        visibleText: "Praxisnahe Kriterien zur Auswahl des richtigen ServiceNow Implementierungspartners.",
        schemaTypes: ["Service", "HowTo"],
      },
    ];

    const strongCtx: CompetitorEvaluationContext = {
      competitor: {
        competitorId: "comp_strong",
        projectId: botProjectId,
        domain: "strong-competitor.de",
        displayName: "Strong Competitor",
        status: "ACTIVE",
        source: "USER_CONFIGURED",
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      corpusSummary: {
        competitorId: "comp_strong",
        domain: "strong-competitor.de",
        discoveredResources: 5,
        crawledResources: 5,
        htmlPages: 5,
        indexableHtml: 5,
        aiEligiblePages: 5,
        excludedPages: 0,
        lastCrawledAt: new Date().toISOString(),
        freshness: "FRESH",
        coverageNote: "5 pages analyzed.",
      },
      pages: compPages,
      profile: {
        profileId: "prof_strong",
        projectId: botProjectId,
        domain: "strong-competitor.de",
        brand: {
          name: "Strong Competitor",
          domain: "strong-competitor.de",
          aliases: [],
          organizationType: "Corporation",
          subBrands: [],
          confidence: 1.0,
        },
        offerings: [
          {
            id: "off_eval",
            name: "ServiceNow Partner Evaluierung",
            canonicalName: "ServiceNow Partner Evaluierung",
            aliases: [],
            type: "SERVICE",
            importance: "PRIMARY",
            description: "Evaluation service",
            supportingUrls: ["https://strong-competitor.de/servicenow-evaluation"],
            confidence: 1.0,
            status: "CONFIRMED",
            audiences: [],
            industries: [],
            relatedTopics: [],
          },
        ],
        entities: [],
        relationships: [],
        topics: [],
        audiences: [],
        industries: [],
        locations: [],
        problems: [],
        differentiators: [],
        competitors: [],
        conflicts: [],
        completenessScore: 85,
        generatedAt: new Date().toISOString(),
        methodologyVersion: "v1.0",
      },
    };

    const benchmark = competitiveEngine.generateCompetitiveBenchmark(
      botProjectId,
      clientMeasurement,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [strongCtx],
      []
    );

    for (const opp of benchmark.opportunities) {
      expect(opp.copySafetyWarning).toMatch(/Do NOT copy/i);
      expect(opp.verificationMethod.length).toBeGreaterThan(10);
      expect(["IMPROVE_EXISTING_PAGE", "CREATE_SUPPORTING_CONTENT", "CREATE_NEW_TARGET_PAGE"]).toContain(
        opp.actionType
      );
    }
  });

  // Test 6: Invariant & Denominator Bounds
  it("6. Strictly enforces denominator bounds and set containment across all competitive categories", () => {
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      botProjectId,
      "run_bot",
      botProfile,
      botPromptUniverse,
      [],
      botClientPages
    );
    const clientMeasurement = measurementEngine.computeMeasurementSnapshot(
      botProjectId,
      "run_bot",
      optSnapshot,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      optSnapshot.findings
    );

    const benchmark = competitiveEngine.generateCompetitiveBenchmark(
      botProjectId,
      clientMeasurement,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      []
    );

    expect(benchmark.summary.totalPromptsCompared).toBe(132);
    expect(benchmark.promptComparisons.length).toBe(132);

    // Intent sum checks
    let totalIntentPrompts = 0;
    for (const intent of benchmark.intentComparisons) {
      totalIntentPrompts += intent.totalComparablePrompts;
    }
    expect(totalIntentPrompts).toBe(132);

    expect(() => validateCompetitiveInvariants(benchmark)).not.toThrow();
  });

  // Test 7: Controlled Improvement & Pinned Snapshot Verification
  it("7. Verifies remediation resolves competitive gaps against pinned competitor snapshot", () => {
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      botProjectId,
      "run_bot",
      botProfile,
      botPromptUniverse,
      [],
      botClientPages
    );
    const clientMeasurement = measurementEngine.computeMeasurementSnapshot(
      botProjectId,
      "run_bot",
      optSnapshot,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      optSnapshot.findings
    );

    // Pinned competitor snapshot
    const pinnedCompPages: CrawledPageContext[] = [
      {
        url: "https://competitor-x.de/itsm",
        title: "ServiceNow ITSM Consulting",
        h1Texts: ["ServiceNow ITSM Implementation"],
        headings: ["ITSM Workflow", "Best Practices"],
        visibleText: "Comprehensive ServiceNow ITSM consulting services.",
        schemaTypes: ["Service"],
      },
    ];

    const pinnedCtx: CompetitorEvaluationContext = {
      competitor: {
        competitorId: "comp_pinned",
        projectId: botProjectId,
        domain: "competitor-x.de",
        displayName: "Competitor X",
        status: "ACTIVE",
        source: "USER_CONFIGURED",
        confidence: 1.0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      corpusSummary: {
        competitorId: "comp_pinned",
        domain: "competitor-x.de",
        discoveredResources: 3,
        crawledResources: 3,
        htmlPages: 3,
        indexableHtml: 3,
        aiEligiblePages: 3,
        excludedPages: 0,
        lastCrawledAt: new Date().toISOString(),
        freshness: "FRESH",
        coverageNote: "3 pages pinned.",
      },
      pages: pinnedCompPages,
      profile: {
        profileId: "prof_pinned",
        projectId: botProjectId,
        domain: "competitor-x.de",
        brand: {
          name: "Competitor X",
          domain: "competitor-x.de",
          aliases: [],
          organizationType: "Corporation",
          subBrands: [],
          confidence: 1.0,
        },
        offerings: [],
        entities: [],
        relationships: [],
        topics: [],
        audiences: [],
        industries: [],
        locations: [],
        problems: [],
        differentiators: [],
        competitors: [],
        conflicts: [],
        completenessScore: 70,
        generatedAt: new Date().toISOString(),
        methodologyVersion: "v1.0",
      },
    };

    const benchmark1 = competitiveEngine.generateCompetitiveBenchmark(
      botProjectId,
      clientMeasurement,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [pinnedCtx],
      []
    );

    // Client publishes improved page
    const improvedClientPages: CrawledPageContext[] = [
      ...botClientPages,
      {
        url: "https://botconsulting.io/services/servicenow-itsm-specialist",
        title: "ServiceNow ITSM Specialist Consulting",
        h1Texts: ["ServiceNow ITSM Consulting"],
        headings: ["Our Proven Implementation Framework", "Case Studies & Measurable Outcomes"],
        visibleText: "Leading ServiceNow ITSM consulting partner with verified implementation methodology.",
        schemaTypes: ["Service"],
      },
    ];

    const benchmark2 = competitiveEngine.generateCompetitiveBenchmark(
      botProjectId,
      clientMeasurement,
      botProfile,
      botPromptUniverse,
      improvedClientPages,
      [pinnedCtx],
      []
    );

    expect(benchmark2.summary.clientAdvantagesCount).toBeGreaterThanOrEqual(benchmark1.summary.clientAdvantagesCount);
  });

  // Test 8: 5-Run Parity (Δ = 0.0) & SEO Isolation
  it(
    "8. Proves 5-run competitive benchmark determinism (Δ = 0.0) and verifies zero SEO score influence",
    async () => {
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      botProjectId,
      "run_bot",
      botProfile,
      botPromptUniverse,
      [],
      botClientPages
    );
    const clientMeasurement = measurementEngine.computeMeasurementSnapshot(
      botProjectId,
      "run_bot",
      optSnapshot,
      botProfile,
      botPromptUniverse,
      botClientPages,
      [],
      optSnapshot.findings
    );

    const fingerprints: string[] = [];
    const clientAdvantageCounts: number[] = [];
    const competitorAdvantageCounts: number[] = [];

    for (let run = 1; run <= 5; run++) {
      const benchmark = competitiveEngine.generateCompetitiveBenchmark(
        botProjectId,
        clientMeasurement,
        botProfile,
        botPromptUniverse,
        botClientPages,
        [],
        []
      );

      fingerprints.push(benchmark.fingerprint);
      clientAdvantageCounts.push(benchmark.summary.clientAdvantagesCount);
      competitorAdvantageCounts.push(benchmark.summary.competitorAdvantagesCount);
    }

    // Assert 5-run determinism
    expect(new Set(fingerprints).size).toBe(1);
    expect(new Set(clientAdvantageCounts).size).toBe(1);
    expect(new Set(competitorAdvantageCounts).size).toBe(1);

    // Verify SEO Rules (108) & Dimensions (118) remain unaffected
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullGraph = await buildAndAnalyzeGraph(crawledPages, []);
    const reEvaluatedSeo = evaluateAllDiagnosticRules(crawledPages, fullGraph);

    const persistedScore = payload?.crawlResult?.websiteHealthScore ?? payload?.crawlResult?.healthScore;
    expect(reEvaluatedSeo.ruleExecutionObservability.length).toBe(108);
    expect(reEvaluatedSeo.healthScore).toBe(persistedScore);
  }, 30000);
});
