/**
 * Phase 28C.1: AI Search Readiness Scoring Calibration & Hardening Test Suite (Methodology: ai-readiness-v2 / v28c-2.1).
 * Validates zero-evidence non-100 semantics, granular deterministic scoring, eligibility,
 * sensitivity, anti-gaming safeguards, version comparability, zero-API offline operation, and SEO isolation.
 */

import { describe, it, expect } from "vitest";
import {
  computeCalibratedPillarScore,
  computeAIReadinessScores,
} from "../scoring/readiness-scoring";
import {
  SCORING_MODEL_VERSION,
  METHODOLOGY_VERSION,
  PILLAR_WEIGHTS,
  EVALUATOR_DEFINITIONS,
  determineHistoricalComparability,
} from "../scoring/scoring-contract";
import { evaluateOnSiteAISearchReadiness } from "../engine";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import type { EvaluatorResult, AISearchFinding, AIObservabilityRecord } from "../types";
import type { CrawledPageData } from "../../crawler/types";
import type { ProjectKnowledgeProfile } from "../knowledge-profile/types";

describe("AI Search Readiness Scoring Calibration v2 (v28c-2.1 / ai-readiness-v2)", () => {
  // =========================================================================
  // 1. Zero Evaluated Evidence != 100
  // =========================================================================
  it("A. Zero evaluated checks produces score: null and INSUFFICIENT_EVIDENCE (NEVER 100)", () => {
    // 0 evaluators in pillar
    const resultEmpty = computeCalibratedPillarScore("AEO", []);
    expect(resultEmpty.score).toBeNull();
    expect(resultEmpty.evaluationCoverage).toBe(0);
    expect(resultEmpty.evaluationStatus).toBe("INSUFFICIENT_EVIDENCE");

    // Evaluators exist but all NOT_EVALUATED
    const evaluatorsNotEvaluated: EvaluatorResult[] = [
      {
        evaluatorId: "AEO_QUESTION_DIRECT_ANSWER",
        evaluatorName: "Direct Answer Proximity",
        pillar: "AEO",
        weight: 50,
        aggregationLevel: "PAGE_LEVEL",
        status: "NOT_EVALUATED",
        score: 0,
        earnedPoints: 0,
        maxPoints: 50,
        rawObservation: "No check executed",
        threshold: ">=75%",
      },
    ];

    const resultNotEval = computeCalibratedPillarScore("AEO", evaluatorsNotEvaluated);
    expect(resultNotEval.score).toBeNull();
    expect(resultNotEval.evaluatedDimensions).toBe(0);
    expect(resultNotEval.evaluationCoverage).toBe(0);
    expect(resultNotEval.evaluationStatus).toBe("INSUFFICIENT_EVIDENCE");
  });

  // =========================================================================
  // 2. Eligibility & NOT_APPLICABLE Semantics
  // =========================================================================
  it("B. NOT_APPLICABLE checks do not penalize earned eligible score ratio", () => {
    const evaluators: EvaluatorResult[] = [
      {
        evaluatorId: "GEO_AUTHOR_ENTITY_CREDENTIALS",
        evaluatorName: "Author Entity Verification",
        pillar: "GEO",
        weight: 20,
        aggregationLevel: "PAGE_LEVEL",
        status: "NOT_APPLICABLE",
        score: 0,
        earnedPoints: 0,
        maxPoints: 20,
        rawObservation: "Site has 0 editorial blog pages requiring author Person attribution.",
        threshold: ">=80%",
      },
      {
        evaluatorId: "GEO_CONTENT_DEPTH_SUBSTANCE",
        evaluatorName: "Substantive Topical Depth",
        pillar: "GEO",
        weight: 80,
        aggregationLevel: "PAGE_LEVEL",
        status: "PASS",
        score: 1.0,
        earnedPoints: 80,
        maxPoints: 80,
        rawObservation: "100% of pages contain substantive depth.",
        threshold: ">=70%",
      },
    ];

    const result = computeCalibratedPillarScore("GEO", evaluators);
    // 80 earned / 80 eligible max points = 100%
    expect(result.score).toBe(100);
    expect(result.notApplicableCount).toBe(1);
    expect(result.eligibleDimensions).toBe(1);
    expect(result.evaluatedDimensions).toBe(1);
  });

  // =========================================================================
  // 3. Granular Deterministic Scoring (Partial Credit)
  // =========================================================================
  it("C. Computes granular partial credit accurately from deterministic metrics", () => {
    const evaluators: EvaluatorResult[] = [
      {
        evaluatorId: "AIO_STRUCTURED_DATA_SYNTAX",
        evaluatorName: "Machine-Readable Schema Presence & Syntax",
        pillar: "TECHNICAL",
        weight: 50,
        aggregationLevel: "PAGE_LEVEL",
        status: "PARTIAL",
        score: 0.6,
        earnedPoints: 30,
        maxPoints: 50,
        rawObservation: "60% of pages have valid schema.",
        threshold: ">=70%",
      },
      {
        evaluatorId: "AIO_INDEXABLE_CORPUS_HYGIENE",
        evaluatorName: "Clean Canonical Indexability Ratio",
        pillar: "TECHNICAL",
        weight: 50,
        aggregationLevel: "SITE_LEVEL",
        status: "PASS",
        score: 1.0,
        earnedPoints: 50,
        maxPoints: 50,
        rawObservation: "95% indexable.",
        threshold: ">=90%",
      },
    ];

    const result = computeCalibratedPillarScore("TECHNICAL", evaluators);
    // (30 + 50) / 100 = 80%
    expect(result.score).toBe(80);
    expect(result.passedDimensions).toBe(1);
    expect(result.partialChecks?.length).toBe(1);
    expect(result.failedDimensions).toBe(0);
  });

  // =========================================================================
  // 4. Overall AI Readiness Quorum & Aggregation
  // =========================================================================
  it("D. Overall AI Readiness requires at least 2 evaluated pillars and >=50% coverage", () => {
    const validPillarResult = (pillar: any, score: number, weight: number): EvaluatorResult => ({
      evaluatorId: `${pillar}_CHECK_1`,
      evaluatorName: `${pillar} Check`,
      pillar,
      weight,
      aggregationLevel: "SITE_LEVEL",
      status: "PASS",
      score: score / 100,
      earnedPoints: (score / 100) * weight,
      maxPoints: weight,
      rawObservation: "Passed",
      threshold: ">=80%",
    });

    // Case 1: 4 evaluated pillars
    const all4Evaluators: EvaluatorResult[] = [
      validPillarResult("TECHNICAL", 90, 100),
      validPillarResult("AEO", 50, 100),
      validPillarResult("GEO", 40, 100),
      validPillarResult("ENTITY_LLM", 60, 100),
    ];
    const scores4 = computeAIReadinessScores(all4Evaluators);
    expect(scores4.overallScore).toBe(Math.round((90 + 50 + 40 + 60) / 4)); // 60
    expect(scores4.overallCoverage).toBe(100);
    expect(scores4.overallStatus).toBe("FULLY_EVALUATED");

    // Case 2: Only 1 pillar evaluated (Insufficient Quorum -> overallScore: null)
    const only1Evaluator: EvaluatorResult[] = [
      validPillarResult("TECHNICAL", 90, 100),
    ];
    const scores1 = computeAIReadinessScores(only1Evaluator);
    expect(scores1.overallScore).toBeNull();
    expect(scores1.overallStatus).toBe("INSUFFICIENT_EVIDENCE");

    // Case 3: 2 pillars evaluated with 50% coverage -> averages evaluated pillars (90 + 50)/2 = 70
    const twoEvaluators: EvaluatorResult[] = [
      validPillarResult("TECHNICAL", 90, 100),
      validPillarResult("AEO", 50, 100),
    ];
    const scores2 = computeAIReadinessScores(twoEvaluators);
    expect(scores2.overallScore).toBe(70);
    expect(scores2.overallCoverage).toBe(50);
    expect(scores2.overallStatus).toBe("PARTIALLY_EVALUATED");
  });

  // =========================================================================
  // 5. LLMO Entity Grounding Integration & Calibration
  // =========================================================================
  it("E. LLMO does not collapse to 0 when brand consistency, offerings, and topics exist without homepage Organization schema", () => {
    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        title: "BOT Consulting — Enterprise Digital Transformation",
        classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
        html: `<html><head><title>BOT Consulting</title></head><body><h1>BOT Consulting</h1><p>We deliver ServiceNow and AI solutions.</p></body></html>`,
        schemaJsonLd: [], // Missing Organization schema
      } as any,
      {
        url: "https://example.com/solutions/servicenow",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        title: "ServiceNow Solutions | BOT Consulting",
        classification: { primaryClass: "marketing_landing", confidence: 1.0, signals: [] },
        html: `<html><head><title>ServiceNow Solutions | BOT Consulting</title></head><body><h1>ServiceNow Solutions</h1></body></html>`,
      } as any,
    ];

    const mockProfile: ProjectKnowledgeProfile = {
      projectId: "proj_test",
      domain: "example.com",
      brand: { name: "BOT Consulting", domain: "example.com", primaryDescription: "Consulting", aliases: [] },
      offerings: [
        { id: "off_1", name: "ServiceNow Implementation", type: "SERVICE", confidence: 0.9, primaryUrl: "https://example.com/solutions/servicenow", status: "CONFIRMED" },
        { id: "off_2", name: "AI Automation", type: "SERVICE", confidence: 0.9, primaryUrl: "https://example.com/solutions/ai", status: "CONFIRMED" },
        { id: "off_3", name: "Cloud Architecture", type: "SERVICE", confidence: 0.9, primaryUrl: "https://example.com/solutions/cloud", status: "CONFIRMED" },
        { id: "off_4", name: "Managed DevOps", type: "SERVICE", confidence: 0.9, primaryUrl: "https://example.com/solutions/devops", status: "CONFIRMED" },
      ],
      entities: [
        { id: "ent_1", name: "BOT Consulting", category: "ORGANIZATION", confidence: 1.0, mentions: 10, isBrandEntity: true },
      ],
      topics: [
        { id: "top_1", name: "Enterprise IT", relevanceScore: 0.9, associatedPages: ["https://example.com/"], source: "PAGE_CORPUS" },
        { id: "top_2", name: "Digital Transformation", relevanceScore: 0.9, associatedPages: ["https://example.com/"], source: "PAGE_CORPUS" },
        { id: "top_3", name: "Cloud Strategy", relevanceScore: 0.8, associatedPages: ["https://example.com/"], source: "PAGE_CORPUS" },
        { id: "top_4", name: "ServiceNow", relevanceScore: 0.95, associatedPages: ["https://example.com/solutions/servicenow"], source: "PAGE_CORPUS" },
        { id: "top_5", name: "Workflow Automation", relevanceScore: 0.85, associatedPages: ["https://example.com/"], source: "PAGE_CORPUS" },
      ],
      knowledgeGraphSummary: { totalOfferings: 4, totalEntities: 1, totalTopics: 5, totalRelationships: 4, profileCompleteness: 0.75 },
    };

    const report = evaluateOnSiteAISearchReadiness(mockPages, { profile: mockProfile });
    const llmo = report.scores.entityGrounding;

    // LLMO should earn credit for Brand Consistency (20%), Offerings (20%), Topics (15%) = 55%
    expect(llmo.score).toBeGreaterThanOrEqual(50);
    expect(llmo.score).toBeLessThanOrEqual(60);

    const schemaEvaluator = llmo.evaluators?.find((e) => e.evaluatorId === "LLMO_ORGANIZATION_SCHEMA");
    expect(schemaEvaluator?.status).toBe("FAIL");

    const brandEvaluator = llmo.evaluators?.find((e) => e.evaluatorId === "LLMO_BRAND_IDENTITY_CONSISTENCY");
    expect(brandEvaluator?.status).toBe("PASS");

    const offeringEvaluator = llmo.evaluators?.find((e) => e.evaluatorId === "LLMO_OFFERING_SERVICE_GROUNDING");
    expect(offeringEvaluator?.status).toBe("PASS");
  });

  // =========================================================================
  // 6. Sensitivity & Monotonic Behavior
  // =========================================================================
  it("F. Controlled mutations exhibit strictly monotonic scoring behavior", () => {
    const basePages: CrawledPageData[] = [
      {
        url: "https://example.com/",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        title: "Acme Corp",
        classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
        html: `<html><head><title>Acme Corp</title></head><body><main><h1>Acme Corp</h1><p>Leading provider of innovative engineering services across the country with substantive depth.</p></main></body></html>`,
        schemaJsonLd: [
          {
            "@type": "Organization",
            name: "Acme Corp",
            url: "https://example.com",
            sameAs: ["https://www.linkedin.com/company/acme", "https://twitter.com/acme"],
          },
        ],
      } as any,
    ];

    const reportBase = evaluateOnSiteAISearchReadiness(basePages);
    const baseLLMO = reportBase.scores.entityGrounding.score || 0;

    // Mutation 1: Remove Organization schema
    const mutatedPagesWithoutSchema = [
      {
        ...basePages[0],
        schemaJsonLd: [],
      },
    ];
    const reportWithoutSchema = evaluateOnSiteAISearchReadiness(mutatedPagesWithoutSchema);
    const degradedLLMO = reportWithoutSchema.scores.entityGrounding.score || 0;

    expect(degradedLLMO).toBeLessThan(baseLLMO);

    // Mutation 2: Block search bot in robots.txt -> Technical score decreases
    const robotsAllowAll = "User-agent: *\nAllow: /";
    const robotsBlockSearch = "User-agent: OAI-SearchBot\nDisallow: /\nUser-agent: PerplexityBot\nDisallow: /";

    const reportAllow = evaluateOnSiteAISearchReadiness(basePages, { robotsTxtContent: robotsAllowAll });
    const reportBlock = evaluateOnSiteAISearchReadiness(basePages, { robotsTxtContent: robotsBlockSearch });

    expect(reportBlock.scores.technicalAccessibility.score!).toBeLessThan(
      reportAllow.scores.technicalAccessibility.score!
    );
  });

  // =========================================================================
  // 7. Anti-Gaming Safeguards
  // =========================================================================
  it("G. Anti-gaming safeguards prevent keyword/FAQ/schema stuffing from manufacturing artificial 100s", () => {
    // 1. FAQ Stuffing on single page with 100 questions but site-level missing structured schema
    const faqStuffedPage: CrawledPageData[] = [
      {
        url: "https://example.com/spam-faq",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "marketing_landing", confidence: 1.0, signals: [] },
        html: `
          <html><body>
            ${Array.from({ length: 50 }, (_, i) => `<h3>What is fake question #${i}?</h3><p>This is answer #${i} to question.</p>`).join("\n")}
          </body></html>
        `,
        schemaJsonLd: [], // No structured FAQPage schema
      } as any,
    ];

    const faqReport = evaluateOnSiteAISearchReadiness(faqStuffedPage);
    // AEO should NOT be 100 because FAQ schema is absent and prompt coverage is evaluated separately
    expect(faqReport.scores.aeoReadiness.score).toBeLessThan(100);

    // 2. Citation link stuffing without quantitative context
    const linkStuffedPage: CrawledPageData[] = [
      {
        url: "https://example.com/links",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "marketing_landing", confidence: 1.0, signals: [] },
        html: `
          <html><body>
            <p>Visit <a href="https://example1.com">link 1</a>, <a href="https://example2.com">link 2</a>, <a href="https://example3.com">link 3</a>.</p>
          </body></html>
        `,
        schemaJsonLd: [],
      } as any,
    ];

    const linkReport = evaluateOnSiteAISearchReadiness(linkStuffedPage);
    // GEO should NOT be 100 because first-party evidence, author credentials, and timestamps are absent
    expect(linkReport.scores.geoEvidenceReadiness.score).toBeLessThan(60);
  });

  // =========================================================================
  // 8. Versioning & Historical Comparability
  // =========================================================================
  it("H. Historical comparability recognizes material methodology change", () => {
    expect(SCORING_MODEL_VERSION).toBe("v28c-2.1");
    expect(METHODOLOGY_VERSION).toBe("ai-readiness-v2");

    // Comparison between old v28b-1.0 and calibrated v28c-2.1
    const compOldNew = determineHistoricalComparability("v28b-1.0", "v28c-2.1");
    expect(compOldNew.isComparable).toBe(false);
    expect(compOldNew.status).toBe("NOT_DIRECTLY_COMPARABLE");
    expect(compOldNew.message).toContain("Scoring methodology changed");

    // Same version comparison
    const compSame = determineHistoricalComparability("v28c-2.1", "v28c-2.1");
    expect(compSame.isComparable).toBe(true);
    expect(compSame.status).toBe("DIRECTLY_COMPARABLE");
  });

  // =========================================================================
  // 9. Zero-API Guarantee
  // =========================================================================
  it("I. Runs completely offline with all external AI provider API keys absent", () => {
    const originalEnv = { ...process.env };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;

    try {
      const mockPages: CrawledPageData[] = [
        {
          url: "https://example.com/",
          statusCode: 200,
          resourceType: "html_page",
          isIndexable: true,
          title: "Offline Test",
          classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
          html: `<html><body><main><h1>Offline Verification</h1><p>Testing deterministic readiness calculation without provider dependencies.</p></main></body></html>`,
        } as any,
      ];

      const report = evaluateOnSiteAISearchReadiness(mockPages);
      expect(report.scores.scoreModelVersion).toBe(SCORING_MODEL_VERSION);
      expect(typeof report.scores.technicalAccessibility.score).toBe("number");
      expect(typeof report.scores.aeoReadiness.score).toBe("number");
      expect(typeof report.scores.geoEvidenceReadiness.score).toBe("number");
      expect(typeof report.scores.entityGrounding.score).toBe("number");
    } finally {
      process.env = originalEnv;
    }
  });

  // =========================================================================
  // 10. Traditional SEO Isolation Invariant
  // =========================================================================
  it("J. Traditional SEO diagnostics and parity matrix remain 100% isolated and invariant", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);
  });
});
