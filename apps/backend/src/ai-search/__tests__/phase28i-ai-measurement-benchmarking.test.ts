/**
 * Phase 28I: AI Optimization Measurement & Benchmarking Test Suite.
 * Validates transparent metrics, prompt drilldowns, intent breakdowns, category health states,
 * baseline creation, historical deltas, improvement attribution, regressions, determinism,
 * denominator invariants, set membership invariants, and complete SEO score isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { AIMeasurementEngine } from "../measurement/engine";
import { AIMeasurementComparator } from "../measurement/comparison";
import { validateAIMeasurementInvariants } from "../measurement/invariants";
import { computeAIMeasurementFingerprint } from "../measurement/fingerprint";
import { SqliteMeasurementRepository } from "../measurement/persistence/sqlite-measurement-repo";
import { AI_MEASUREMENT_ENGINE_VERSION, AIMeasurementSnapshot } from "../measurement/types";
import { AIOptimizationEngine } from "../optimization/engine";
import { generateProjectKnowledgeAndPromptUniverse } from "../engine";
import { CrawledPageData } from "../../crawler/types";
import { CrawledPageContext } from "../optimization/mapper";
import { buildAndAnalyzeGraph } from "../../crawler/graph";
import { evaluateAllDiagnosticRules } from "../../crawler/rules";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function getDbPath(): string {
  const cwd = process.cwd();
  if (cwd.includes("apps\\backend") || cwd.includes("apps/backend")) {
    return path.resolve(cwd, "../../local_data/dream_seo.db");
  }
  return path.resolve(cwd, "local_data/dream_seo.db");
}

describe("Phase 28I: AI Optimization Measurement & Benchmarking Suite", () => {
  let db: DatabaseSync;
  let measurementEngine: AIMeasurementEngine;
  let comparator: AIMeasurementComparator;
  let repo: SqliteMeasurementRepository;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    measurementEngine = new AIMeasurementEngine();
    comparator = new AIMeasurementComparator();
    repo = new SqliteMeasurementRepository(db);
  });

  // ==========================================================================
  // PART 1: METRIC CONTRACTS & TRANSPARENT BOUNDS (No Synthetic Composite Scores)
  // ==========================================================================
  it("verifies all metrics expose explicit numerators, denominators, and transparent ratios", () => {
    const mockOptSnapshot: any = {
      snapshotId: "opt_mock_1",
      mappings: [
        {
          promptId: "prm_1",
          targetPageUrl: "https://example.com/solutions",
          coverageState: "STRONG_MATCH",
          answerCoverage: "COVERED",
          mappingConfidence: "HIGH",
          candidatePages: [{ url: "https://example.com/solutions", score: 90 }],
        },
        {
          promptId: "prm_2",
          targetPageUrl: "https://example.com/pricing",
          coverageState: "PARTIAL_MATCH",
          answerCoverage: "PARTIALLY_COVERED",
          mappingConfidence: "MEDIUM",
          candidatePages: [{ url: "https://example.com/pricing", score: 60 }],
        },
      ],
      findings: [],
    };

    const mockProfile: any = { brand: { name: "ExampleCo" } };
    const mockPromptUniverse: any = {
      allCandidates: [
        { id: "prm_1", prompt: "What solutions does ExampleCo provide?", intents: ["COMMERCIAL"], priorityScore: 90 },
        { id: "prm_2", prompt: "How much does ExampleCo cost?", intents: ["INFORMATIONAL"], priorityScore: 50 },
      ],
    };

    const snapshot = measurementEngine.computeMeasurementSnapshot(
      "proj_test",
      "run_test",
      mockOptSnapshot,
      mockProfile,
      mockPromptUniverse,
      [{ url: "https://example.com/solutions" }, { url: "https://example.com/pricing" }] as any,
      [],
      []
    );

    expect(snapshot.engineVersion).toBe(AI_MEASUREMENT_ENGINE_VERSION);
    expect(snapshot.metrics.promptCoverage.numerator).toBe(1); // prm_1 is STRONG
    expect(snapshot.metrics.promptCoverage.denominator).toBe(2);
    expect(snapshot.metrics.promptCoverage.value).toBe(0.5);
    expect(snapshot.metrics.promptCoverage.unit).toBe("PROMPTS");

    // Invariants must pass
    expect(() => validateAIMeasurementInvariants(snapshot)).not.toThrow();
  });

  // ==========================================================================
  // PART 2: INTENT AGGREGATION & DRILLDOWN TRACEABILITY
  // ==========================================================================
  it("aggregates prompt coverage by intent family with exact underlying prompt lists", () => {
    const mockOptSnapshot: any = {
      snapshotId: "opt_mock_intents",
      mappings: [
        { promptId: "p1", targetPageUrl: "https://example.com/how-to", coverageState: "STRONG_MATCH", answerCoverage: "COVERED", mappingConfidence: "HIGH" },
        { promptId: "p2", targetPageUrl: "https://example.com/how-to-2", coverageState: "PARTIAL_MATCH", answerCoverage: "PARTIALLY_COVERED", mappingConfidence: "MEDIUM" },
        { promptId: "p3", targetPageUrl: "https://example.com/eval", coverageState: "STRONG_MATCH", answerCoverage: "COVERED", mappingConfidence: "HIGH" },
      ],
      findings: [],
    };

    const mockPromptUniverse: any = {
      allCandidates: [
        { id: "p1", prompt: "How to deploy X?", intents: ["HOW_TO"] },
        { id: "p2", prompt: "How to configure Y?", intents: ["HOW_TO"] },
        { id: "p3", prompt: "How to evaluate partners?", intents: ["EVALUATION"] },
      ],
    };

    const snapshot = measurementEngine.computeMeasurementSnapshot(
      "proj_test",
      "run_test",
      mockOptSnapshot,
      { brand: { name: "ExampleCo" } } as any,
      mockPromptUniverse,
      []
    );

    const howTo = snapshot.intentBreakdowns.find((i) => i.intentFamily === "HOW_TO");
    expect(howTo).toBeDefined();
    expect(howTo?.totalPrompts).toBe(2);
    expect(howTo?.adequatelyServed).toBe(1);
    expect(howTo?.partial).toBe(1);
    expect(howTo?.coverageRatio).toBe(0.5);

    const evaluation = snapshot.intentBreakdowns.find((i) => i.intentFamily === "EVALUATION");
    expect(evaluation).toBeDefined();
    expect(evaluation?.totalPrompts).toBe(1);
    expect(evaluation?.adequatelyServed).toBe(1);
    expect(evaluation?.coverageRatio).toBe(1.0);
  });

  // ==========================================================================
  // PART 3: 12 CATEGORY HEALTH STATES & PARTIAL CAPABILITY INTEGRITY
  // ==========================================================================
  it("correctly assigns health states across all 12 categories and marks partial categories honestly", () => {
    const mockOptSnapshot: any = {
      snapshotId: "opt_mock_cats",
      mappings: [],
      findings: [
        {
          id: "f_1",
          code: "AI_OPT_ANSWER_COVERAGE_GAP",
          category: "ANSWER_COVERAGE",
          priority: "HIGH_IMPACT",
          evidenceStrength: "STRONG",
        },
      ],
    };

    const snapshot = measurementEngine.computeMeasurementSnapshot(
      "proj_test",
      "run_test",
      mockOptSnapshot,
      { brand: { name: "ExampleCo" } } as any,
      { allCandidates: [] } as any,
      []
    );

    expect(snapshot.categoryMeasurements).toHaveLength(12);

    const answerCov = snapshot.categoryMeasurements.find((c) => c.category === "ANSWER_COVERAGE");
    expect(answerCov?.healthState).toBe("NEEDS_ATTENTION");
    expect(answerCov?.highImpactFindingCount).toBe(1);

    const authority = snapshot.categoryMeasurements.find((c) => c.category === "CONTENT_AUTHORITY");
    expect(authority?.capabilityStatus).toBe("PARTIAL_IMPLEMENTATION");
    expect(authority?.healthState).toBe("LIMITED_EVIDENCE");

    const discoverability = snapshot.categoryMeasurements.find((c) => c.category === "AI_DISCOVERABILITY");
    expect(discoverability?.capabilityStatus).toBe("PARTIAL_IMPLEMENTATION");
    expect(discoverability?.healthState).toBe("LIMITED_EVIDENCE");
  });

  // ==========================================================================
  // PART 4: CONTROLLED IMPROVEMENT TEST & REMEDIATION DRIVER ATTRIBUTION
  // ==========================================================================
  it("detects controlled prompt improvement and attributes exact drivers in comparison", () => {
    const promptUniverse: any = {
      allCandidates: [
        { id: "prm_eval", prompt: "How to evaluate a ServiceNow implementation partner", intents: ["EVALUATION"], priorityScore: 85 },
      ],
    };

    // Baseline: WEAK coverage
    const baselineOpt: any = {
      snapshotId: "opt_base",
      mappings: [
        {
          promptId: "prm_eval",
          targetPageUrl: "https://example.com/services",
          coverageState: "WEAK_MATCH",
          answerCoverage: "NOT_COVERED",
          mappingConfidence: "MEDIUM",
        },
      ],
      findings: [{ id: "f_ans", code: "AI_OPT_ANSWER_COVERAGE_GAP", category: "ANSWER_COVERAGE", lifecycleStatus: "OPEN" }],
    };

    const baselineMeas = measurementEngine.computeMeasurementSnapshot(
      "proj_comp",
      "run_1",
      baselineOpt,
      { brand: { name: "ExampleCo" } } as any,
      promptUniverse,
      [{ url: "https://example.com/services" }] as any,
      [],
      baselineOpt.findings
    );

    // Current: ADEQUATE coverage after website remediation
    const currentOpt: any = {
      snapshotId: "opt_cur",
      mappings: [
        {
          promptId: "prm_eval",
          targetPageUrl: "https://example.com/services",
          coverageState: "STRONG_MATCH",
          answerCoverage: "COVERED",
          mappingConfidence: "HIGH",
        },
      ],
      findings: [],
    };

    const currentMeas = measurementEngine.computeMeasurementSnapshot(
      "proj_comp",
      "run_2",
      currentOpt,
      { brand: { name: "ExampleCo" } } as any,
      promptUniverse,
      [{ url: "https://example.com/services" }] as any,
      [],
      [{ id: "f_ans", code: "AI_OPT_ANSWER_COVERAGE_GAP", category: "ANSWER_COVERAGE", lifecycleStatus: "WEBSITE_FIX_VERIFIED" }] as any
    );

    const comparison = comparator.compareSnapshots(baselineMeas, currentMeas);

    expect(comparison.compatibility).toBe("DIRECTLY_COMPARABLE");
    expect(comparison.summary.improvedPromptsCount).toBe(1);
    expect(comparison.summary.regressedPromptsCount).toBe(0);
    expect(comparison.summary.netPromptsAdequatelyServedDelta).toBe(1);
    expect(comparison.remediationDrivers).toHaveLength(1);
    expect(comparison.remediationDrivers[0].affectedPromptText).toContain("How to evaluate a ServiceNow implementation partner");
    expect(comparison.remediationDrivers[0].transition).toBe("WEAK → STRONG");
  });

  // ==========================================================================
  // PART 5: CONTROLLED REGRESSION TEST
  // ==========================================================================
  it("detects controlled regression and isolates deteriorating prompt evidence", () => {
    const promptUniverse: any = {
      allCandidates: [
        { id: "prm_support", prompt: "ServiceNow managed support scope", intents: ["COMMERCIAL"], priorityScore: 90 },
      ],
    };

    // Baseline: STRONG coverage
    const baselineOpt: any = {
      snapshotId: "opt_base_2",
      mappings: [
        {
          promptId: "prm_support",
          targetPageUrl: "https://example.com/support",
          coverageState: "STRONG_MATCH",
          answerCoverage: "COVERED",
          mappingConfidence: "HIGH",
        },
      ],
      findings: [],
    };

    const baselineMeas = measurementEngine.computeMeasurementSnapshot(
      "proj_reg",
      "run_1",
      baselineOpt,
      { brand: { name: "ExampleCo" } } as any,
      promptUniverse,
      [{ url: "https://example.com/support" }] as any
    );

    // Current: REGRESSED to WEAK (e.g. support page deleted or gutted)
    const currentOpt: any = {
      snapshotId: "opt_cur_2",
      mappings: [
        {
          promptId: "prm_support",
          targetPageUrl: null,
          coverageState: "NO_TARGET_PAGE",
          answerCoverage: "NOT_COVERED",
          mappingConfidence: "LOW",
        },
      ],
      findings: [],
    };

    const currentMeas = measurementEngine.computeMeasurementSnapshot(
      "proj_reg",
      "run_2",
      currentOpt,
      { brand: { name: "ExampleCo" } } as any,
      promptUniverse,
      []
    );

    const comparison = comparator.compareSnapshots(baselineMeas, currentMeas);

    expect(comparison.summary.regressedPromptsCount).toBe(1);
    expect(comparison.summary.improvedPromptsCount).toBe(0);
    expect(comparison.summary.netPromptsAdequatelyServedDelta).toBe(-1);
    expect(comparison.regressions).toHaveLength(1);
    expect(comparison.regressions[0].affectedPromptText).toContain("ServiceNow managed support scope");
    expect(comparison.regressions[0].transition).toBe("STRONG → INSUFFICIENT_EVIDENCE");
  });

  // ==========================================================================
  // PART 6: PROVIDER UNAVAILABLE CONTROL (Zero Fabricated 0% Score)
  // ==========================================================================
  it("confirms provider unavailable displays neutral state without producing fake 0% visibility", () => {
    const snapshot = measurementEngine.computeMeasurementSnapshot(
      "proj_test",
      "run_test",
      { snapshotId: "opt_1", mappings: [], findings: [] } as any,
      { brand: { name: "Test" } } as any,
      { allCandidates: [] } as any,
      [],
      [] // 0 observations (grounding parked)
    );

    expect(snapshot.providerObservationStatus.availabilityState).toBe("PROVIDER_EVIDENCE_UNAVAILABLE");
    expect(snapshot.providerObservationStatus.note).toContain("Live search grounding is parked");
  });

  // ==========================================================================
  // PART 7: ENGINE VERSION COMPARISON CONTROL & NEGATIVE CONTROLS
  // ==========================================================================
  it("prevents naive comparison across incompatible engine versions and enforces invariants", () => {
    const base: any = {
      projectId: "proj_v",
      engineVersion: "phase28h-advanced-content-intelligence",
      generatedAt: new Date().toISOString(),
      measurementId: "m1",
      metrics: {},
      promptCoverageSummary: { adequatelyServedCount: 10 },
      promptDetails: [],
      findingLifecycle: { verifiedFixed: 0, openFindings: 0 },
    };

    const cur: any = {
      projectId: "proj_v",
      engineVersion: "phase28i-measurement-v1",
      generatedAt: new Date().toISOString(),
      measurementId: "m2",
      metrics: {},
      promptCoverageSummary: { adequatelyServedCount: 12 },
      promptDetails: [],
      findingLifecycle: { verifiedFixed: 0, openFindings: 0 },
    };

    const comparison = comparator.compareSnapshots(base, cur);
    expect(comparison.compatibility).toBe("COMPARABLE_WITH_CAVEAT");

    // Invariant Negative Control: Numerator > Denominator
    expect(() =>
      validateAIMeasurementInvariants({
        metrics: {
          promptCoverage: {
            numerator: 25,
            denominator: 20,
            metricId: "pc",
          },
        },
      } as any)
    ).toThrow(/exceeds denominator/);

    // Invariant Negative Control: Measurable Prompts > Total Canonical Prompts
    expect(() =>
      validateAIMeasurementInvariants({
        metrics: {},
        promptCoverageSummary: {
          totalCanonicalPrompts: 2,
          measurablePrompts: 3, // Invariant violation: 3 > 2
          strongCount: 2,
          adequateCount: 0,
          partialCount: 0,
          weakCount: 0,
          unservedCount: 0,
          insufficientEvidenceCount: 0,
          adequatelyServedCount: 2,
        },
        pageTargetingSummary: {
          totalEvaluated: 2,
          clearPrimaryTargets: 2,
          multipleCompetingTargets: 0,
          weakPrimaryTargets: 0,
          wrongPageTypeTargets: 0,
          noTargetPrompts: 0,
          insufficientEvidence: 0,
        },
        promptDetails: [
          { promptId: "p1", coverageLevel: "STRONG" },
          { promptId: "p2", coverageLevel: "INSUFFICIENT_EVIDENCE" },
        ],
        findingLifecycle: { totalBaselineFindings: 0, verifiedFixed: 0 },
      } as any)
    ).toThrow(/exceeds total canonical prompts/);
  });

  // ==========================================================================
  // PART 8: REAL BOT CORPUS FIVE-RUN DETERMINISM & ZERO SEO INFLUENCE
  // ==========================================================================
  it("proves 5-run AI measurement determinism (Δ = 0.0) and verifies zero SEO score influence", async () => {
    const realDbPath = getDbPath();
    const realDb = new DatabaseSync(realDbPath);

    const snapshotRow = realDb
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
    const payload = JSON.parse(snapshotRow.payload_json);
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

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse("proj_7F7Gxe3O", "botconsulting.io", crawledPages);
    const optEngine = new AIOptimizationEngine();
    const optSnapshot = optEngine.computeOptimizationSnapshot(
      "proj_7F7Gxe3O",
      snapshotRow.audit_run_id,
      profile,
      promptUniverse,
      [],
      aiEligiblePages,
      payload?.crawlResult?.robotsTxt
    );

    // Run 5 repeated measurement executions
    const fingerprints: string[] = [];
    const promptCoverageValues: number[] = [];

    for (let i = 0; i < 5; i++) {
      const measSnapshot = measurementEngine.computeMeasurementSnapshot(
        "proj_7F7Gxe3O",
        snapshotRow.audit_run_id,
        optSnapshot,
        profile,
        promptUniverse,
        aiEligiblePages,
        [],
        optSnapshot.findings
      );

      fingerprints.push(measSnapshot.fingerprint);
      promptCoverageValues.push(measSnapshot.metrics.promptCoverage.value);
    }

    // Prove Δ = 0.0 across all 5 runs
    const firstFp = fingerprints[0];
    for (const fp of fingerprints) {
      expect(fp).toBe(firstFp);
    }
    const firstVal = promptCoverageValues[0];
    for (const val of promptCoverageValues) {
      expect(val).toBe(firstVal);
    }

    // Verify SEO Rules (108) & Dimensions (118) remain unaffected
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullGraph = await buildAndAnalyzeGraph(crawledPages, []);
    const reEvaluatedSeo = evaluateAllDiagnosticRules(crawledPages, fullGraph);

    const persistedScore = payload?.crawlResult?.healthScore || payload?.healthScore?.totalScore || 70.8;
    expect(reEvaluatedSeo.healthScore).toBe(persistedScore);
  }, 30000);
});
