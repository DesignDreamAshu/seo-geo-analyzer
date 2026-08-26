import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";
import { PromptPageMapper, CrawledPageContext } from "../optimization/mapper";
import { AIOptimizationEngine } from "../optimization/engine";
import { evaluateStructuredSignals } from "../optimization/evaluators/structured-signals";
import { evaluateAnswerCoverage } from "../optimization/evaluators/answer-coverage";
import { evaluateEntityClarity } from "../optimization/evaluators/entity-clarity";
import { evaluateCompetitorGap } from "../optimization/evaluators/competitor-gap";
import { evaluateKnowledgeConsistency } from "../optimization/evaluators/knowledge-consistency";
import { evaluateSourceReadiness } from "../optimization/evaluators/source-readiness";
import {
  AI_OPTIMIZATION_ENGINE_VERSION,
  AI_OPTIMIZATION_CATEGORY_CAPABILITIES,
} from "../optimization/types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptCandidate, PromptUniverseReport } from "../prompts/types";
import { AIObservation } from "../observation/types";
import { SqliteOptimizationRepository } from "../optimization/persistence/sqlite-optimization-repo";

describe("Phase 28G.1: AI Visibility Optimization Hardening & Full-Corpus Reality Test Suite", () => {
  let db: DatabaseSync;
  let repo: SqliteOptimizationRepository;
  let engine: AIOptimizationEngine;
  let mapper: PromptPageMapper;

  const mockProfile: ProjectKnowledgeProfile = {
    projectId: "proj_test_hardening",
    domain: "https://www.testbrand.com",
    version: "v1.0",
    generatedAt: new Date().toISOString(),
    brand: {
      name: "TestBrand Consulting",
      canonicalDomain: "testbrand.com",
      brandType: "B2B_SERVICES",
      aliases: ["TestBrand", "TBC"],
      disambiguationTerms: ["TestBrand Cloud Advisory"],
    },
    offerings: [
      {
        id: "off_servicenow",
        name: "ServiceNow Transformation",
        canonicalName: "servicenow-transformation",
        aliases: ["ServiceNow Consulting"],
        type: "SERVICE",
        importance: "PRIMARY",
        description: "Enterprise ServiceNow advisory and workflow automation.",
        supportingUrls: ["https://www.testbrand.com/solution-service-now"],
        confidence: 0.95,
        status: "CONFIRMED",
        audiences: ["Enterprise IT Leaders"],
        industries: ["Finance", "Healthcare"],
        relatedTopics: ["servicenow", "workflows"],
        provenance: [],
      },
      {
        id: "off_cloudsmith",
        name: "Cloudsmith Package Management",
        canonicalName: "cloudsmith-package-management",
        aliases: ["Cloudsmith"],
        type: "PRODUCT",
        importance: "PRIMARY",
        description: "Secure artifact and software supply chain management.",
        supportingUrls: ["https://www.testbrand.com/cloudsmith"],
        confidence: 0.95,
        status: "CONFIRMED",
        audiences: ["DevOps Leaders"],
        industries: ["Technology"],
        relatedTopics: ["cloudsmith", "artifact management"],
        provenance: [],
      },
    ],
    audiences: ["Enterprise IT"],
    industries: ["Technology"],
    competitors: [
      { name: "Competitor Alpha", domain: "competitoralpha.com", competitorType: "PRIMARY_BUSINESS", trackedOffers: [] },
    ],
    brandMentions: [],
    claims: [],
    knowledgeConflicts: [],
  };

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    repo = new SqliteOptimizationRepository(db);
    engine = new AIOptimizationEngine();
    mapper = new PromptPageMapper();
  });

  // PART 1: Engine Version & Capability Matrix
  it("verifies engine version matches Phase 28 active version and 12 categories are defensibly classified", () => {
    expect(AI_OPTIMIZATION_ENGINE_VERSION).toMatch(/^phase28/);
    expect(Object.keys(AI_OPTIMIZATION_CATEGORY_CAPABILITIES)).toHaveLength(12);

    expect(AI_OPTIMIZATION_CATEGORY_CAPABILITIES.ENTITY_CLARITY.status).toBe("FULLY_IMPLEMENTED");
    expect(AI_OPTIMIZATION_CATEGORY_CAPABILITIES.ANSWER_COVERAGE.status).toBe("FULLY_IMPLEMENTED");
    expect(AI_OPTIMIZATION_CATEGORY_CAPABILITIES.PAGE_TARGETING.status).toBe("FULLY_IMPLEMENTED");
    expect(AI_OPTIMIZATION_CATEGORY_CAPABILITIES.STRUCTURED_ENTITY_SIGNAL.status).toBe("FULLY_IMPLEMENTED");
  });

  // PART 2: Intent-Aware Prompt-to-Page Mapping (Case A & B Fixes)
  it("maps general brand discovery prompts to Homepage / Solutions overview, not single blog posts", () => {
    const prompt: PromptCandidate = {
      id: "prm_brand_services",
      prompt: "What services does TestBrand Consulting provide for enterprise clients?",
      promptType: "BRAND_SPECIFIC",
      brandedness: "BRANDED",
      intents: ["INFORMATIONAL", "DEFINITIONAL"],
      funnelStage: "AWARENESS",
      specificity: "MID",
      targetOfferingNames: ["TestBrand Consulting"],
      targetAudiences: ["enterprise"],
      estimatedVolume: "HIGH",
      priorityScore: 90,
      provenance: "TEST",
    };

    const pages: CrawledPageContext[] = [
      {
        url: "https://www.testbrand.com/",
        title: "TestBrand Consulting | Enterprise Cloud Solutions",
        visibleText: "TestBrand Consulting provides enterprise consulting, ServiceNow implementation, and cloud engineering.",
        h1Texts: ["Enterprise Consulting & Technology Solutions"],
      },
      {
        url: "https://www.testbrand.com/post/how-snowflakes-vision-impacts-enterprises",
        title: "How Snowflakes Enterprise Vision Impacts Supply Chain",
        visibleText: "In this blog post we explore Snowflake enterprise analytics.",
        h1Texts: ["Snowflake Enterprise Vision"],
      },
    ];

    const mapping = mapper.mapSinglePrompt(prompt, pages, mockProfile);
    expect(mapping.targetPageUrl).toBe("https://www.testbrand.com/");
    expect(mapping.coverageState).toBe("STRONG_MATCH");
    expect(mapping.candidatePages[0].url).toBe("https://www.testbrand.com/");
  });

  // PART 3: Primary Technology Subject Constraint (Unrelated Tech Never Matches)
  it("strictly prevents unrelated technology blog posts from matching specific technology prompts", () => {
    const prompt: PromptCandidate = {
      id: "prm_cloudsmith_eval",
      prompt: "How should an enterprise evaluate and choose a consulting partner for Cloudsmith?",
      promptType: "DECISION_SUPPORT",
      brandedness: "UNBRANDED",
      intents: ["HOW_TO", "PURCHASE_SELECTION"],
      funnelStage: "DECISION",
      specificity: "SPECIFIC",
      targetOfferingNames: ["Cloudsmith Package Management"],
      targetAudiences: ["enterprise"],
      estimatedVolume: "HIGH",
      priorityScore: 85,
      provenance: "TEST",
    };

    const pages: CrawledPageContext[] = [
      {
        url: "https://www.testbrand.com/post/snowflake-migration-playbook",
        title: "How to evaluate and choose a migration partner for Snowflake enterprise",
        visibleText: "Enterprise guide on choosing consulting partners for Snowflake data warehouses.",
        h1Texts: ["Snowflake Partner Evaluation"],
      },
      {
        url: "https://www.testbrand.com/cloudsmith",
        title: "Cloudsmith Package Management Consulting",
        visibleText: "TestBrand provides Cloudsmith package management implementation and advisory.",
        h1Texts: ["Cloudsmith Consulting"],
      },
    ];

    const mapping = mapper.mapSinglePrompt(prompt, pages, mockProfile);
    expect(mapping.targetPageUrl).toBe("https://www.testbrand.com/cloudsmith");
    expect(mapping.candidatePages.some((c) => c.url.includes("snowflake"))).toBe(false);
  });

  // PART 4: Structured Service Schema Only for Commercial Capability Pages
  it("restricts Schema.org Service recommendations to commercial capability pages and excludes editorial posts", () => {
    const pages: CrawledPageContext[] = [
      {
        url: "https://www.testbrand.com/solution-service-now",
        title: "ServiceNow Solutions",
        schemaTypes: [], // Missing schema on commercial page
      },
      {
        url: "https://www.testbrand.com/post/servicenow-tips-and-tricks",
        title: "ServiceNow Tips Blog",
        schemaTypes: [], // Missing schema on blog post
      },
      {
        url: "https://www.testbrand.com/jobopenings/123456",
        title: "ServiceNow Developer Job",
        schemaTypes: [],
      },
    ];

    const findings = evaluateStructuredSignals("proj_1", "run_1", pages, mockProfile);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("AI_OPT_STRUCTURED_ENTITY_SERVICE_SCHEMA_MISSING");
    expect(findings[0].affectedPages).toHaveLength(1);
    expect(findings[0].affectedPages[0].url).toBe("https://www.testbrand.com/solution-service-now");
  });

  // PART 5: Non-Dogmatic Flexible Answer Coverage Evaluation
  it("evaluates answer coverage flexibly without rigid formatting dogmatism", () => {
    const prompt: PromptCandidate = {
      id: "prm_1",
      prompt: "What is Cloudsmith package management consulting?",
      promptType: "CATEGORY_DISCOVERY",
      brandedness: "UNBRANDED",
      intents: ["INFORMATIONAL"],
      funnelStage: "AWARENESS",
      specificity: "MID",
      targetOfferingNames: ["Cloudsmith Package Management"],
      targetAudiences: ["enterprise"],
      estimatedVolume: "HIGH",
      priorityScore: 80,
      provenance: "TEST",
    };

    // Page with bulleted feature format instead of a 3-sentence H1 block
    const pageWithBullets: CrawledPageContext = {
      url: "https://www.testbrand.com/cloudsmith",
      title: "Cloudsmith Consulting",
      visibleText:
        "We provide Cloudsmith package management advisory and implementation. " +
        "Targeted for enterprise DevOps organizations seeking secure software supply chains. " +
        "Our team helps optimize package workflows, accelerate build pipelines, and eliminate security vulnerabilities.",
    };

    const mapping = mapper.mapSinglePrompt(prompt, [pageWithBullets], mockProfile);
    expect(mapping.answerCoverage).toBe("COVERED");
    expect(mapping.answerCoverageEvidence.missingElements).toHaveLength(0);
  });

  // PART 6: Entity Clarity: Weak Signals vs Strong Site Signals
  it("emits GAP when website lacks Organization schema and opening definition", () => {
    const observations: AIObservation[] = [
      {
        observationId: "obs_1",
        runId: "run_obs_1",
        projectId: "proj_1",
        providerId: "GEMINI",
        model: "gemini-2.5-flash",
        promptId: "prm_1",
        promptText: "What services does TestBrand Consulting provide?",
        promptType: "BRAND_SPECIFIC",
        brandedness: "BRANDED",
        intent: "INFORMATIONAL",
        funnelStage: "AWARENESS",
        observedAt: new Date().toISOString(),
        rawResponse: "TestBrand stands for Technical Benchmark Directory...",
        brandMentioned: false,
        stringMentionDetected: true,
        entityAttribution: {
          brandName: "TestBrand Consulting",
          state: "GENERIC_TERM",
          confidence: 0.9,
          reasoning: "Interpreted as generic benchmark acronym",
          observedSnippets: ["Technical Benchmark Directory"],
          competingEntities: [],
        },
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        competitorsMentioned: [],
        citations: [],
        groundingState: "GROUNDING_ACTIVE",
        extractorVersion: "1.0",
      },
    ];

    const pagesWithoutSchema: CrawledPageContext[] = [
      {
        url: "https://www.testbrand.com/",
        title: "Welcome to Our Platform",
        visibleText: "Empowering next-generation cloud architectures.",
        schemaTypes: [],
      },
    ];

    const findings = evaluateEntityClarity("proj_1", "run_1", observations, pagesWithoutSchema, mockProfile);
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("GAP");
    expect(findings[0].code).toBe("AI_OPT_ENTITY_CLARITY_GENERIC_ACRONYM");
  });

  // PART 7: Competitor Gap: Preserves Observed Fact without Invented Causality
  it("reports competitor gap with non-deterministic hypothesis and 0 invented causality", () => {
    const observations: AIObservation[] = [
      {
        observationId: "obs_comp_1",
        runId: "run_obs_1",
        projectId: "proj_1",
        providerId: "OPENAI",
        model: "gpt-4o",
        promptId: "prm_comp_1",
        promptText: "What are the top enterprise consulting companies for ServiceNow?",
        promptType: "BEST_VENDOR",
        brandedness: "UNBRANDED",
        intent: "RECOMMENDATION",
        funnelStage: "CONSIDERATION",
        observedAt: new Date().toISOString(),
        rawResponse: "Top consulting firms include Competitor Alpha and Accenture.",
        brandMentioned: false,
        stringMentionDetected: false,
        entityAttribution: { brandName: "TestBrand", state: "NO_MENTION", confidence: 1.0, reasoning: "No mention", observedSnippets: [], competingEntities: ["Competitor Alpha"] },
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        competitorsMentioned: [{ name: "Competitor Alpha", isTracked: true, mentionCount: 1 }],
        citations: [],
        groundingState: "GROUNDING_ACTIVE",
        extractorVersion: "1.0",
      },
    ];

    const mappings = mapper.mapPromptsToPages(
      [
        {
          id: "prm_comp_1",
          prompt: "What are the top enterprise consulting companies for ServiceNow?",
          promptType: "BEST_VENDOR",
          brandedness: "UNBRANDED",
          intents: ["RECOMMENDATION"],
          funnelStage: "CONSIDERATION",
          specificity: "MID",
          targetOfferingNames: ["ServiceNow Transformation"],
          targetAudiences: ["enterprise"],
          estimatedVolume: "HIGH",
          priorityScore: 90,
          provenance: "TEST",
        },
      ],
      [
        {
          url: "https://www.testbrand.com/solution-service-now",
          title: "ServiceNow Solutions",
          visibleText: "TestBrand provides ServiceNow implementation.",
        },
      ],
      mockProfile
    );

    const findings = evaluateCompetitorGap("proj_1", "run_1", observations, mappings, mockProfile);
    expect(findings).toHaveLength(1);
    expect(findings[0].code).toBe("AI_OPT_COMPETITOR_VISIBILITY_GAP");
    expect(findings[0].rootCause.isDeterministic).toBe(false);
    expect(findings[0].rootCause.contributingFactors).toContain("Major enterprise consultancies have extensive legacy citation footprints.");
  });

  // PART 8: Full Engine Snapshot Persistence and Two-Level Verification
  it("persists snapshot to SQLite repository and retrieves intact with lifecycle tracking", () => {
    const promptUniverse: PromptUniverseReport = {
      projectId: "proj_test_hardening",
      version: "v1.0",
      generatedAt: new Date().toISOString(),
      summary: { totalPrompts: 1, brandedPromptsCount: 1, unbrandedPromptsCount: 0, informationalCount: 1, commercialInvestigationCount: 0, decisionSupportCount: 0, highVolumeCount: 1 },
      monitoringSet: [
        {
          id: "prm_test_1",
          prompt: "What services does TestBrand Consulting provide?",
          promptType: "BRAND_SPECIFIC",
          brandedness: "BRANDED",
          intents: ["INFORMATIONAL"],
          funnelStage: "AWARENESS",
          specificity: "MID",
          targetOfferingNames: ["TestBrand Consulting"],
          targetAudiences: ["enterprise"],
          estimatedVolume: "HIGH",
          priorityScore: 90,
          provenance: "TEST",
        },
      ],
    };

    const snapshot = engine.computeOptimizationSnapshot(
      "proj_test_hardening",
      "audit_run_1",
      mockProfile,
      promptUniverse,
      [],
      [
        {
          url: "https://www.testbrand.com/",
          title: "TestBrand Consulting Homepage",
          visibleText: "Enterprise IT consulting and ServiceNow services.",
        },
      ]
    );

    expect(snapshot.version).toBe(AI_OPTIMIZATION_ENGINE_VERSION);
    expect(snapshot.certificationStatus).toBe("CERTIFIED");
    expect(snapshot.findings.length).toBeGreaterThan(0);

    repo.saveSnapshot(snapshot);
    const retrieved = repo.getLatestSnapshot("proj_test_hardening");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.snapshotId).toBe(snapshot.snapshotId);
    expect(retrieved?.version).toBe(AI_OPTIMIZATION_ENGINE_VERSION);
    expect(retrieved?.findings.length).toBe(snapshot.findings.length);

    // Test lifecycle update
    const firstFindingId = retrieved!.findings[0].id;
    repo.updateFindingLifecycle(firstFindingId, "WEBSITE_FIX_VERIFIED");
  });
});
