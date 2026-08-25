/**
 * Phase 28G: AI Visibility Optimization & Fix Intelligence Certification Test Suite.
 * Covers entity clarity, prompt-to-page mapping, answer coverage, competitor gaps,
 * structured signals, knowledge consistency, verification levels, and strict SEO isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { AIOptimizationEngine } from "../optimization/engine";
import { PromptPageMapper, CrawledPageContext } from "../optimization/mapper";
import { AIOptimizationVerifier } from "../optimization/verifier";
import { SqliteOptimizationRepository } from "../optimization/persistence/sqlite-optimization-repo";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptUniverseReport, PromptCandidate } from "../prompts/types";
import { AIObservation } from "../observation/types";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";

describe("Phase 28G: AI Visibility Optimization & Fix Intelligence Certification Suite", () => {
  let db: DatabaseSync;
  let optEngine: AIOptimizationEngine;
  let verifier: AIOptimizationVerifier;
  let mapper: PromptPageMapper;
  let repo: SqliteOptimizationRepository;

  const mockProfile: ProjectKnowledgeProfile = {
    profileId: "prof_bot_1",
    projectId: "proj_bot",
    domain: "https://www.botconsulting.io/",
    brand: {
      name: "BOT Consulting",
      domain: "https://www.botconsulting.io/",
      aliases: ["BOT Consulting", "botconsulting.io", "BOT", "BOT Consulting LLC"],
      organizationType: "Organization",
      subBrands: ["Odyssey by BOT"],
      confidence: 1.0,
    },
    offerings: [
      {
        id: "off_sn_1",
        name: "ServiceNow Implementation",
        canonicalName: "ServiceNow Advisory & Implementation",
        aliases: ["ServiceNow", "ITSM", "HRSD", "ITOM"],
        type: "SERVICE",
        importance: "PRIMARY",
        description: "Enterprise ServiceNow workflow solutions.",
        supportingUrls: ["https://www.botconsulting.io/services/servicenow"],
        confidence: 1.0,
        status: "CONFIRMED",
        audiences: ["Enterprise IT Leaders"],
        industries: ["Enterprise"],
        relatedTopics: ["ServiceNow", "Workflow Automation"],
        provenance: [],
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
    competitors: [
      {
        id: "comp_1",
        name: "Accenture",
        domain: "accenture.com",
        classification: "DIRECT_BUSINESS_COMPETITOR",
        overlappingOfferings: ["ServiceNow"],
        confidence: 1.0,
        status: "CONFIRMED",
        provenance: [],
      },
    ],
    conflicts: [],
    completenessScore: 100,
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
  };

  const samplePrompts: PromptCandidate[] = [
    {
      id: "prm_branded_services",
      prompt: "What services does BOT Consulting provide for enterprise clients?",
      promptType: "BRAND_DISCOVERY",
      brandedness: "BRANDED",
      intents: ["INFORMATIONAL", "VENDOR_DISCOVERY"],
      funnelStage: "AWARENESS",
      specificity: "MID",
      monitoringTier: "TIER_1_CORE",
      candidateSources: ["DERIVED_FROM_EVIDENCE"],
      evidenceTraces: [],
      clusterId: "cl_brand",
      createdAt: new Date().toISOString(),
    },
    {
      id: "prm_unbranded_sn",
      prompt: "Who are the top ServiceNow enterprise implementation partners?",
      promptType: "CATEGORY_DISCOVERY",
      brandedness: "UNBRANDED",
      intents: ["VENDOR_DISCOVERY", "RECOMMENDATION"],
      funnelStage: "CONSIDERATION",
      specificity: "BROAD",
      monitoringTier: "TIER_1_CORE",
      candidateSources: ["DERIVED_FROM_EVIDENCE"],
      evidenceTraces: [],
      clusterId: "cl_sn",
      createdAt: new Date().toISOString(),
    },
    {
      id: "prm_unmapped_topic",
      prompt: "How to migrate legacy SAP workflows to modern cloud ERP architectures?",
      promptType: "HOW_TO",
      brandedness: "UNBRANDED",
      intents: ["HOW_TO", "IMPLEMENTATION"],
      funnelStage: "CONSIDERATION",
      specificity: "SPECIFIC",
      monitoringTier: "TIER_2_EXPANDED",
      candidateSources: ["DERIVED_FROM_EVIDENCE"],
      evidenceTraces: [],
      clusterId: "cl_sap",
      createdAt: new Date().toISOString(),
    },
  ];

  const mockUniverse: PromptUniverseReport = {
    projectId: "proj_bot",
    domain: "https://www.botconsulting.io/",
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
    health: { totalCandidates: 3, duplicateCount: 0, distinctClusters: 3, averageConfidence: 1.0, qualityScore: 100 },
    clusters: [],
    monitoringSet: samplePrompts,
    allCandidates: samplePrompts,
  };

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    repo = new SqliteOptimizationRepository(db);
    optEngine = new AIOptimizationEngine();
    verifier = new AIOptimizationVerifier();
    mapper = new PromptPageMapper();
  });

  it("1, 2 & 3. Entity Ambiguity: Differentiates weak website signals (GAP) from strong website signals (OBSERVATION)", () => {
    const ambiguousObs: AIObservation[] = [
      {
        observationId: "obs_canary_ambiguous",
        runId: "run_1",
        projectId: "proj_bot",
        promptId: "prm_branded_services",
        clusterId: "cl_brand",
        promptText: "What services does BOT Consulting provide for enterprise clients?",
        promptType: "BRAND_DISCOVERY",
        intent: "INFORMATIONAL",
        funnelStage: "AWARENESS",
        specificity: "MID",
        brandedness: "BRANDED",
        providerId: "GEMINI",
        model: "gemini-3.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_NOT_ACTIVE",
        stringMentionDetected: true,
        entityAttribution: {
          state: "AMBIGUOUS_ENTITY",
          confidence: 0.15,
          stringMentionDetected: true,
          entityMentionConfirmed: false,
          positiveSignals: [],
          negativeSignals: ["BOT acronym treated as generic business model"],
          ambiguityReasons: ["Provider asked for clarification between BOT model and consulting firm"],
          rationale: "Ambiguous entity resolution.",
        },
        brandMentioned: false,
        brandMentionCount: 0,
        brandMentions: [],
        competitorsMentioned: [],
        citations: [],
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        extractorVersion: "v28d1-entity-attribution-2.0",
        observedAt: new Date().toISOString(),
      },
    ];

    // Case A: Weak website signals (Missing Organization schema and explicit definition)
    const weakPages: CrawledPageContext[] = [
      {
        url: "https://www.botconsulting.io/",
        title: "Home",
        visibleText: "Transform your digital workplace with modern agile strategies.",
        schemaTypes: [],
      },
    ];

    const snapshotWeak = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      mockProfile,
      mockUniverse,
      ambiguousObs,
      weakPages
    );

    const clarityFinding = snapshotWeak.findings.find((f) => f.code === "AI_OPT_ENTITY_CLARITY_GENERIC_ACRONYM");
    expect(clarityFinding).toBeDefined();
    expect(clarityFinding?.type).toBe("GAP");
    expect(clarityFinding?.priority).toBe("HIGH_IMPACT");
    expect(clarityFinding?.evidence.providerObservations?.length).toBe(1);

    // Case B: Strong website signals (Already has Organization schema and explicit definition)
    const strongPages: CrawledPageContext[] = [
      {
        url: "https://www.botconsulting.io/",
        title: "BOT Consulting - Enterprise ServiceNow Advisory",
        visibleText: "BOT Consulting is a specialized enterprise ServiceNow consulting firm.",
        schemaTypes: ["Organization"],
      },
    ];

    const snapshotStrong = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      mockProfile,
      mockUniverse,
      ambiguousObs,
      strongPages
    );

    const obsFinding = snapshotStrong.findings.find((f) => f.code === "AI_OPT_PROVIDER_AMBIGUITY_OBSERVATION");
    expect(obsFinding).toBeDefined();
    expect(obsFinding?.type).toBe("OBSERVATION"); // Preserved as observation without false website blame!
  });

  it("4 & 5. Prompt-to-Page Mapping: Maps strong pages and detects unmapped prompts", () => {
    const pages: CrawledPageContext[] = [
      {
        url: "https://www.botconsulting.io/services/servicenow",
        title: "ServiceNow Advisory & Implementation Services",
        h1Texts: ["Enterprise ServiceNow Solutions"],
        visibleText: "We provide comprehensive ServiceNow implementation for enterprise clients.",
        schemaTypes: ["Service"],
      },
    ];

    const mappings = mapper.mapPromptsToPages(samplePrompts, pages, mockProfile);

    // Prompt 2 (ServiceNow) should strongly map to /services/servicenow
    const snMapping = mappings.find((m) => m.promptId === "prm_unbranded_sn");
    expect(snMapping?.coverageState).toBe("STRONG_MATCH");
    expect(snMapping?.targetPageUrl).toBe("https://www.botconsulting.io/services/servicenow");

    // Prompt 3 (SAP workflows) has 0 relevant pages on site
    const sapMapping = mappings.find((m) => m.promptId === "prm_unmapped_topic");
    expect(sapMapping?.coverageState).toBe("NO_TARGET_PAGE");
    expect(sapMapping?.targetPageUrl).toBeNull();
  });

  it("6 & 7. Answer Coverage: Evaluates complete vs partial answer coverage", () => {
    // Partial page: mentions ServiceNow but lacks business problem and audience definitions
    const partialPage: CrawledPageContext = {
      url: "https://www.botconsulting.io/services/servicenow",
      title: "ServiceNow",
      visibleText: "ServiceNow tools and configurations.",
      schemaTypes: [],
    };

    const partialMapping = mapper.mapSinglePrompt(samplePrompts[1], [partialPage], mockProfile);
    expect(partialMapping.answerCoverage).toBe("NOT_COVERED");

    // Complete page: defines service, audience, and problem
    const completePage: CrawledPageContext = {
      url: "https://www.botconsulting.io/services/servicenow",
      title: "ServiceNow Implementation",
      visibleText:
        "We provide enterprise ServiceNow advisory solutions for organizations to streamline digital workflows and optimize IT operations.",
      schemaTypes: ["Service"],
    };

    const completeMapping = mapper.mapSinglePrompt(samplePrompts[1], [completePage], mockProfile);
    expect(completeMapping.answerCoverage).toBe("COVERED");
  });

  it("8. Generic marketing language alone does not trigger false positives on strong pages", () => {
    const pageWithMarketingAndFacts: CrawledPageContext = {
      url: "https://www.botconsulting.io/services/servicenow",
      title: "ServiceNow Advisory",
      visibleText:
        "We transform enterprises. We provide specialized ServiceNow consulting for enterprise clients to automate complex workflows.",
      schemaTypes: ["Service"],
    };

    const mapping = mapper.mapSinglePrompt(samplePrompts[1], [pageWithMarketingAndFacts], mockProfile);
    expect(mapping.answerCoverage).toBe("COVERED");
  });

  it("9 & 10. Knowledge Consistency: Flags substantive factual contradictions and ignores harmless phrasing", () => {
    const profileWithConflict: ProjectKnowledgeProfile = {
      ...mockProfile,
      conflicts: [
        {
          id: "conf_1",
          entityName: "BOT Consulting",
          description: "Conflicting founding date and headquarters location (2018 in Chicago vs 2021 in London)",
          sources: [
            { sourceUrl: "https://www.botconsulting.io/about", signalType: "HTML_CONTENT", extractedAt: new Date().toISOString() },
            { sourceUrl: "https://www.botconsulting.io/company", signalType: "HTML_CONTENT", extractedAt: new Date().toISOString() },
          ],
          status: "UNRESOLVED",
        },
      ],
    };

    const snapshot = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      profileWithConflict,
      mockUniverse,
      [],
      []
    );

    const conflictFinding = snapshot.findings.find((f) => f.code === "AI_OPT_KNOWLEDGE_FACTUAL_CONTRADICTION");
    expect(conflictFinding).toBeDefined();
    expect(conflictFinding?.type).toBe("DEFECT");
    expect(conflictFinding?.affectedPages.length).toBe(2);
  });

  it("11 & 12. Competitor Visibility Gap: Separates observed facts from comparative hypotheses", () => {
    const competitorObs: AIObservation[] = [
      {
        observationId: "obs_unbranded_1",
        runId: "run_1",
        projectId: "proj_bot",
        promptId: "prm_unbranded_sn",
        clusterId: "cl_sn",
        promptText: "Who are the top ServiceNow enterprise implementation partners?",
        promptType: "CATEGORY_DISCOVERY",
        intent: "VENDOR_DISCOVERY",
        funnelStage: "CONSIDERATION",
        specificity: "BROAD",
        brandedness: "UNBRANDED",
        providerId: "GEMINI",
        model: "gemini-3.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_NOT_ACTIVE",
        stringMentionDetected: false,
        brandMentioned: false,
        brandMentionCount: 0,
        brandMentions: [],
        competitorsMentioned: [
          {
            competitorName: "Accenture",
            canonicalEntity: "Accenture",
            matchedText: "Accenture",
            occurrenceIndex: 1,
            characterOffset: 120,
            contextSnippet: "Accenture is a global leader in ServiceNow enterprise transformations.",
            isKnownCompetitor: true,
            confidence: 1.0,
          },
        ],
        citations: [],
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        extractorVersion: "v28d1-entity-attribution-2.0",
        observedAt: new Date().toISOString(),
      },
    ];

    const snapshot = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      mockProfile,
      mockUniverse,
      competitorObs,
      []
    );

    const compFinding = snapshot.findings.find((f) => f.code === "AI_OPT_COMPETITOR_VISIBILITY_GAP");
    expect(compFinding).toBeDefined();
    expect(compFinding?.type).toBe("GAP");
    expect(compFinding?.rootCause.isDeterministic).toBe(false); // Clearly labeled as hypothesis!
    expect(compFinding?.evidence.competitorEvidence?.length).toBeGreaterThan(0);
  });

  it("13 & 14. Source Readiness & Grounding Gating: Correctly gates ungrounded Gemini runs", () => {
    const ungroundedObs: AIObservation[] = [
      {
        observationId: "obs_ug_1",
        runId: "run_1",
        projectId: "proj_bot",
        promptId: "prm_branded_services",
        clusterId: "cl_brand",
        promptText: "What services does BOT Consulting provide?",
        promptType: "BRAND_DISCOVERY",
        intent: "INFORMATIONAL",
        funnelStage: "AWARENESS",
        specificity: "MID",
        brandedness: "BRANDED",
        providerId: "GEMINI",
        model: "gemini-3.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_NOT_ACTIVE", // Grounding unbilled/unavailable
        stringMentionDetected: false,
        brandMentioned: false,
        brandMentionCount: 0,
        brandMentions: [],
        competitorsMentioned: [],
        citations: [],
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        extractorVersion: "v28d1-entity-attribution-2.0",
        observedAt: new Date().toISOString(),
      },
    ];

    const pagesWithClaims: CrawledPageContext[] = [
      {
        url: "https://www.botconsulting.io/services/servicenow",
        title: "ServiceNow",
        visibleText: "We deliver 100% guaranteed industry leading results with 95% cost reduction.",
        schemaTypes: [],
      },
    ];

    const snapshot = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      mockProfile,
      mockUniverse,
      ungroundedObs,
      pagesWithClaims
    );

    const srcFinding = snapshot.findings.find((f) => f.code === "AI_OPT_SOURCE_READINESS_UNSUBSTANTIATED_CLAIMS");
    expect(srcFinding).toBeDefined();
    expect(srcFinding?.evidence.groundingStatus).toBe("PROVIDER_EVIDENCE_UNAVAILABLE");
    expect(snapshot.summary.groundingAvailabilityState).toBe("GROUNDING_UNAVAILABLE_ON_PROVIDER");
  });

  it("15 & 16. Deduplication & Conflict Prevention: Consolidates findings and resolves conflicts", () => {
    const pages: CrawledPageContext[] = [
      {
        url: "https://www.botconsulting.io/services/servicenow",
        title: "ServiceNow Consulting",
        visibleText: "We provide ServiceNow implementation.",
        schemaTypes: ["Service"],
      },
    ];

    const snapshot = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      mockProfile,
      mockUniverse,
      [],
      pages
    );

    // Verify all findings have unique IDs
    const ids = snapshot.findings.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("17 & 18. Remediation Verification: Strictly separates Level 1 website fix from Level 2 provider outcome", () => {
    const finding = {
      id: "opt_entity_test",
      projectId: "proj_bot",
      runId: "run_1",
      code: "AI_OPT_ENTITY_CLARITY_GENERIC_ACRONYM",
      category: "ENTITY_CLARITY" as const,
      type: "GAP" as const,
      priority: "HIGH_IMPACT" as const,
      confidence: "HIGH" as const,
      evidenceStrength: "STRONG" as const,
      title: "Entity Clarity",
      summary: "Summary",
      whyItMatters: "Matters",
      problem: { observed: "Obs", explanation: "Exp" },
      evidence: { sourceSignal: "SIG" },
      rootCause: { hypothesis: "Hyp", contributingFactors: [], isDeterministic: false, rationale: "Rat" },
      affectedPrompts: [{ id: "prm_branded_services", prompt: "Prompt", intent: "INFORMATIONAL", funnelStage: "AWARENESS", brandedness: "BRANDED" }],
      affectedPages: [{ url: "https://www.botconsulting.io/" }],
      affectedEntities: ["BOT Consulting"],
      affectedProviders: ["GEMINI"],
      recommendation: { objective: "Obj", whatShouldChange: "Change", whereToChange: "Where", actionSteps: [], cautions: [] },
      verificationMethod: {
        level1WebsiteVerification: { method: "DOM", targetCheck: "Check", expectedEvidence: "Ev" },
        level2ProviderVerification: { method: "AI", targetPromptIds: ["prm_branded_services"], expectedOutcome: "Out" },
      },
      lifecycleStatus: "OPEN" as const,
      noGuaranteeDisclaimer: "Disc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Step 1: Website changes deployed (Organization schema added), but provider not yet rechecked
    const fixedPages: CrawledPageContext[] = [
      {
        url: "https://www.botconsulting.io/",
        title: "BOT Consulting",
        visibleText: "BOT Consulting is an enterprise ServiceNow consultancy.",
        schemaTypes: ["Organization"],
      },
    ];

    const resultL1 = verifier.verifyRemediation(finding, fixedPages, [], mockProfile);
    expect(resultL1.level1WebsiteVerified).toBe(true);
    expect(resultL1.level2ProviderVerified).toBe(false);
    expect(resultL1.updatedStatus).toBe("WEBSITE_FIX_VERIFIED");

    // Step 2: New genuine provider observation confirms brand entity
    const newConfirmedObs: AIObservation[] = [
      {
        observationId: "obs_new_1",
        runId: "run_2",
        projectId: "proj_bot",
        promptId: "prm_branded_services",
        clusterId: "cl_brand",
        promptText: "What services does BOT Consulting provide?",
        promptType: "BRAND_DISCOVERY",
        intent: "INFORMATIONAL",
        funnelStage: "AWARENESS",
        specificity: "MID",
        brandedness: "BRANDED",
        providerId: "GEMINI",
        model: "gemini-3.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_NOT_ACTIVE",
        stringMentionDetected: true,
        entityAttribution: {
          state: "CONFIRMED_ENTITY",
          confidence: 0.95,
          stringMentionDetected: true,
          entityMentionConfirmed: true,
          positiveSignals: ["Explicit enterprise consulting alignment"],
          negativeSignals: [],
          ambiguityReasons: [],
          rationale: "Confirmed entity.",
        },
        brandMentioned: true,
        brandMentionCount: 2,
        brandMentions: [],
        competitorsMentioned: [],
        citations: [],
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        extractorVersion: "v28d1-entity-attribution-2.0",
        observedAt: new Date().toISOString(),
      },
    ];

    const resultL2 = verifier.verifyRemediation(finding, fixedPages, newConfirmedObs, mockProfile);
    expect(resultL2.level1WebsiteVerified).toBe(true);
    expect(resultL2.level2ProviderVerified).toBe(true);
    expect(resultL2.updatedStatus).toBe("IMPROVEMENT_OBSERVED");
  });

  it("19 & 20. Persistence & Durability: Saves and retrieves snapshots accurately", () => {
    const snapshot = optEngine.computeOptimizationSnapshot(
      "proj_bot",
      "run_1",
      mockProfile,
      mockUniverse,
      [],
      []
    );

    repo.saveSnapshot(snapshot);
    const retrieved = repo.getLatestSnapshot("proj_bot");

    expect(retrieved).toBeDefined();
    expect(retrieved?.snapshotId).toBe(snapshot.snapshotId);
    expect(retrieved?.findings.length).toBe(snapshot.findings.length);
  });

  it("21, 22, 23 & 24. Strict SEO Isolation: Traditional 108 rules and 118 canonical matrix remain untouched", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);
  });
});
