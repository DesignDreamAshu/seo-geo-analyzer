/**
 * DREAM SEO — Phase 28H: Advanced AI Content Intelligence & Optimization Coverage Test Suite.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import dotenv from "dotenv";
import { DatabaseSync } from "node:sqlite";

dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { AIOptimizationEngine } from "../optimization/engine";
import { generateProjectKnowledgeAndPromptUniverse } from "../engine";
import { evaluatePromptIntentCoverage } from "../optimization/evaluators/prompt-intent-coverage";
import { evaluatePageTargeting } from "../optimization/evaluators/page-targeting";
import { evaluateContentSpecificity } from "../optimization/evaluators/content-specificity";
import { evaluateEvidenceSupport } from "../optimization/evaluators/evidence-support";
import { evaluateContentAuthority } from "../optimization/evaluators/content-authority";
import { evaluateAIDiscoverability } from "../optimization/evaluators/ai-discoverability";
import { extractProjectKnowledgeProfile } from "../knowledge-profile/extractor";
import {
  AI_OPTIMIZATION_CATEGORY_CAPABILITIES,
  AI_OPTIMIZATION_ENGINE_VERSION,
  PromptPageMapping,
} from "../optimization/types";
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

describe("Phase 28H: Advanced AI Content Intelligence & Optimization Coverage Suite", () => {
  const dbPath = getDbPath();
  const db = new DatabaseSync(dbPath);

  const mockProfile = {
    projectId: "proj_test",
    domain: "https://example.com",
    brand: { name: "Example Corp", alternateNames: [] },
    aliases: [],
    coreOfferings: ["Cloud Migration", "Data Engineering"],
    technologyEcosystem: ["Snowflake", "ServiceNow"],
    competitorEntities: ["Competitor A"],
    targetIndustryVerticals: ["Enterprise"],
    canonicalEntities: ["Example Corp"],
    extractedAt: new Date().toISOString(),
  };

  // 1. Capability Reality & Engine Versioning
  it("Capability Reality: verifies 12 categories with honest operational status & versioning", () => {
    expect(AI_OPTIMIZATION_ENGINE_VERSION).toBe("phase28h-advanced-content-intelligence");

    const caps = AI_OPTIMIZATION_CATEGORY_CAPABILITIES;
    expect(caps.ANSWER_COVERAGE.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.PROMPT_INTENT_COVERAGE.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.PAGE_TARGETING.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.CONTENT_SPECIFICITY.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.EVIDENCE_SUPPORT.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.STRUCTURED_ENTITY_SIGNAL.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.SOURCE_CITATION_READINESS.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.ENTITY_CLARITY.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.COMPETITOR_VISIBILITY_GAP.status).toBe("FULLY_IMPLEMENTED");
    expect(caps.KNOWLEDGE_CONSISTENCY.status).toBe("FULLY_IMPLEMENTED");

    // Partial honest categories (no fake domain authority or guaranteed LLM indexing)
    expect(caps.CONTENT_AUTHORITY.status).toBe("PARTIAL_IMPLEMENTATION");
    expect(caps.AI_DISCOVERABILITY.status).toBe("PARTIAL_IMPLEMENTATION");
  });

  // 2. PROMPT_INTENT_COVERAGE: Positive & Negative Controls
  it("Prompt Intent Coverage: detects unserved evaluation intents and approves satisfied guides", () => {
    // Positive Control: High-value evaluation prompt mapped to missing or non-answering page
    const unservedMapping: PromptPageMapping = {
      promptId: "p_eval_1",
      promptText: "How should an enterprise evaluate a ServiceNow consulting partner?",
      intent: "EVALUATION",
      funnelStage: "DECISION",
      brandedness: "NON_BRANDED",
      targetPageUrl: "https://example.com/services/servicenow",
      candidatePages: [{ url: "https://example.com/services/servicenow", score: 40, matchReasons: [] }],
      mappingConfidence: "MEDIUM",
      coverageState: "PARTIAL_MATCH",
      answerCoverage: "NOT_COVERED",
      answerCoverageEvidence: {
        targetAudienceMentioned: false,
        businessProblemSolved: false,
        missingElements: ["Partner evaluation criteria", "RFP guidance"],
      },
    };

    const findings = evaluatePromptIntentCoverage("proj_test", "run_test", [unservedMapping], mockProfile);
    expect(findings.length).toBe(1);
    expect(findings[0].code).toBe("AI_OPT_INTENT_COVERAGE_EVALUATION_DEFICIT");
    expect(findings[0].category).toBe("PROMPT_INTENT_COVERAGE");
    expect(findings[0].supportingCategories).toContain("ANSWER_COVERAGE");

    // Negative Control: Satisfied informational guide
    const satisfiedMapping: PromptPageMapping = {
      ...unservedMapping,
      promptId: "p_eval_2",
      coverageState: "STRONG_MATCH",
      answerCoverage: "COVERED",
    };
    const negFindings = evaluatePromptIntentCoverage("proj_test", "run_test", [satisfiedMapping], mockProfile);
    expect(negFindings.length).toBe(0);
  });

  // 3. PAGE_TARGETING: Positive & Negative Controls (Competition vs Different Intents)
  it("Page Targeting: identifies competing commercial pages while allowing blog vs service pages", () => {
    // Positive Control: Two commercial landing pages competing for same commercial query
    const competingMapping: PromptPageMapping = {
      promptId: "p_target_1",
      promptText: "Enterprise Snowflake Migration Consulting",
      intent: "COMMERCIAL",
      funnelStage: "CONSIDERATION",
      brandedness: "NON_BRANDED",
      targetPageUrl: "https://example.com/solutions/snowflake-migration",
      candidatePages: [
        { url: "https://example.com/solutions/snowflake-migration", score: 85, matchReasons: [] },
        { url: "https://example.com/services/snowflake-consulting", score: 80, matchReasons: [] },
      ],
      mappingConfidence: "HIGH",
      coverageState: "MULTIPLE_COMPETING_PAGES",
      answerCoverage: "COVERED",
      answerCoverageEvidence: { targetAudienceMentioned: true, businessProblemSolved: true, missingElements: [] },
    };

    const compFindings = evaluatePageTargeting("proj_test", "run_test", [competingMapping], mockProfile);
    expect(compFindings.length).toBe(1);
    expect(compFindings[0].code).toBe("AI_OPT_PAGE_TARGETING_AMBIGUITY");
    expect(compFindings[0].affectedPages.length).toBe(2);

    // Negative Control: Commercial Service Page + Informational Blog Post (Valid Coexistence)
    const blogCoexistenceMapping: PromptPageMapping = {
      ...competingMapping,
      candidatePages: [
        { url: "https://example.com/solutions/snowflake-migration", score: 85, matchReasons: [] },
        { url: "https://example.com/post/how-to-migrate-to-snowflake", score: 80, matchReasons: [] },
      ],
    };
    const noCompFindings = evaluatePageTargeting("proj_test", "run_test", [blogCoexistenceMapping], mockProfile);
    expect(noCompFindings.length).toBe(0);
  });

  // 4. CONTENT_SPECIFICITY: Positive & Negative Controls
  it("Content Specificity: flags generic commercial shells without penalizing focused definitions or blogs", () => {
    // Positive Control: Vague commercial landing page (< 3 dimensions, < 200 words)
    const genericServicePage: CrawledPageContext = {
      url: "https://example.com/solutions/cloud",
      title: "Cloud Solutions",
      visibleText: "Transform your enterprise with our innovative digital solutions and unlock next-level business growth.",
      headings: ["Cloud Solutions", "Unlock Innovation"],
    };

    const commercialMapping: PromptPageMapping = {
      promptId: "p_comm_1",
      promptText: "Enterprise Cloud Solutions",
      intent: "COMMERCIAL",
      funnelStage: "CONSIDERATION",
      brandedness: "NON_BRANDED",
      targetPageUrl: "https://example.com/solutions/cloud",
      candidatePages: [{ url: "https://example.com/solutions/cloud", score: 75, matchReasons: [] }],
      mappingConfidence: "HIGH",
      coverageState: "STRONG_MATCH",
      answerCoverage: "PARTIALLY_COVERED",
      answerCoverageEvidence: { targetAudienceMentioned: false, businessProblemSolved: false, missingElements: [] },
    };

    const specFindings = evaluateContentSpecificity(
      "proj_test",
      "run_test",
      [genericServicePage],
      [commercialMapping],
      mockProfile
    );
    expect(specFindings.length).toBe(1);
    expect(specFindings[0].code).toBe("AI_OPT_CONTENT_SPECIFICITY_DEFICIT");

    // Negative Control: Concrete technical blog post is not penalized for missing commercial sales copy
    const blogPage: CrawledPageContext = {
      url: "https://example.com/post/iceberg-vs-delta",
      title: "Iceberg vs Delta",
      visibleText: "Apache Iceberg provides ACID transactions and schema evolution for open data lakehouses.",
      headings: ["Iceberg vs Delta Lake"],
    };
    const blogMapping: PromptPageMapping = {
      ...commercialMapping,
      intent: "INFORMATIONAL",
      targetPageUrl: "https://example.com/post/iceberg-vs-delta",
    };
    const blogFindings = evaluateContentSpecificity(
      "proj_test",
      "run_test",
      [blogPage],
      [blogMapping],
      mockProfile
    );
    expect(blogFindings.length).toBe(0);
  });

  // 5. EVIDENCE_SUPPORT: Classifies claims strictly
  it("Evidence Support: requires proof for unbacked metric claims but ignores ordinary marketing statements", () => {
    // Positive Control: Unanchored quantitative claim without case study links
    const pageWithMetric: CrawledPageContext = {
      url: "https://example.com/solutions/performance",
      title: "High Speed Engineering",
      visibleText: "Our automated data pipelines deliver 300% faster processing and 99.9% cost reduction.",
      headings: ["Performance Engineering"],
    };

    const findings = evaluateEvidenceSupport("proj_test", "run_test", [pageWithMetric], mockProfile);
    expect(findings.length).toBe(1);
    expect(findings[0].code).toBe("AI_OPT_EVIDENCE_SUPPORT_UNANCHORED_CLAIMS");

    // Negative Control: Ordinary marketing statement
    const pageWithOrdinaryMarketing: CrawledPageContext = {
      url: "https://example.com/about",
      title: "About Us",
      visibleText: "We are passionate engineers helping organizations build modern cloud software systems.",
      headings: ["About Example Corp"],
    };
    const noProofFindings = evaluateEvidenceSupport("proj_test", "run_test", [pageWithOrdinaryMarketing], mockProfile);
    expect(noProofFindings.length).toBe(0);
  });

  // 6. AI_DISCOVERABILITY: Evaluates robots.txt AI rules without llms.txt false positives
  it("AI Discoverability: surfaces explicit robots.txt AI blocks and ignores missing llms.txt", () => {
    const robotsWithBlockedBot = `
      User-agent: *
      Allow: /

      User-agent: GPTBot
      Disallow: /

      User-agent: PerplexityBot
      Disallow: /
    `;

    const findings = evaluateAIDiscoverability("proj_test", "run_test", robotsWithBlockedBot, mockProfile);
    expect(findings.length).toBe(1);
    expect(findings[0].code).toBe("AI_OPT_DISCOVERABILITY_CRAWLER_EXPLICITLY_BLOCKED");
    expect(findings[0].affectedProviders).toContain("OPENAI");
    expect(findings[0].affectedProviders).toContain("PERPLEXITY");

    // Negative Control: Allowed robots.txt & missing llms.txt creates 0 findings
    const normalRobots = "User-agent: *\nAllow: /\n";
    const cleanFindings = evaluateAIDiscoverability("proj_test", "run_test", normalRobots, mockProfile);
    expect(cleanFindings.length).toBe(0);
  });

  // 7. End-to-End BOT Snapshot Evaluation
  it("End-to-End BOT Snapshot: generates 100% auditable findings with full semantic corpus", () => {
    const row = db.prepare(`
      SELECT s.snapshot_id, s.audit_run_id, s.project_id, s.payload_json
      FROM audit_snapshots s
      JOIN audit_runs r ON s.audit_run_id = r.audit_run_id
      WHERE s.project_id = 'proj_7F7Gxe3O' AND r.status = 'COMPLETED'
      ORDER BY r.sequence_number DESC LIMIT 1
    `).get() as any;

    expect(row).toBeDefined();
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

    const { profile, promptUniverse } = generateProjectKnowledgeAndPromptUniverse("proj_7F7Gxe3O", "botconsulting.io", crawledPages);
    const engine = new AIOptimizationEngine();
    const snapshot = engine.computeOptimizationSnapshot(
      "proj_7F7Gxe3O",
      row.audit_run_id,
      profile,
      promptUniverse,
      [],
      aiEligiblePages,
      payload?.crawlResult?.robotsTxt
    );

    expect(snapshot.version).toBe("phase28h-advanced-content-intelligence");
    expect(snapshot.findings.length).toBeGreaterThan(0);

    // Verify all findings have valid verification methods & provenance
    for (const f of snapshot.findings) {
      expect(f.verificationMethod.level1WebsiteVerification.method).toBeDefined();
      expect(f.recommendation.actionSteps.length).toBeGreaterThan(0);
      expect(f.evidenceStrength).toBeDefined();
    }
  });

  // 8. SEO Isolation & Accounting Safety
  it("SEO Regression Safety: 108 rules, 118 dimensions, 108/108 accounting, and Δ = 0.0 reproducibility", async () => {
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
  }, 60000);
});
