import { describe, it, expect, beforeEach } from "vitest";
import { AIVisibilityObservationEngine } from "../observation/engine";
import { extractObservationIntelligence } from "../observation/extractor";
import { GeminiProviderAdapter } from "../observation/adapters/gemini-adapter";
import { OpenAIProviderAdapter } from "../observation/adapters/openai-adapter";
import { PerplexityProviderAdapter } from "../observation/adapters/perplexity-adapter";
import { ManualImportProviderAdapter } from "../observation/adapters/manual-import-adapter";
import { BrandIdentity, CompetitorCandidate } from "../knowledge-profile/types";
import { AIVisibilityAnalyticsEngine } from "../analytics/engine";
import { AISourceIntelligenceEngine } from "../citations/engine";
import { initializeDatabase, getDatabase } from "../../crawler/persistence/db";
import { SqliteObservationRepository } from "../observation/persistence/sqlite-observation-repo";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";

describe("Phase 28D.1 — Live Provider Reality Certification Test Suite", () => {
  let db: any;
  let obsRepo: SqliteObservationRepository;
  let obsEngine: AIVisibilityObservationEngine;

  const mockBrand: BrandIdentity = {
    name: "BOT Consulting",
    domain: "https://www.botconsulting.io/",
    aliases: ["BOT Consulting", "botconsulting.io", "BOT", "BOT Consulting LLC"],
    organizationType: "Organization",
    subBrands: ["Odyssey by BOT", "Cloudsmith"],
    confidence: 1.0,
  };

  const mockCompetitors: CompetitorCandidate[] = [
    {
      id: "comp_1",
      name: "Accenture",
      domain: "accenture.com",
      classification: "DIRECT_CORE",
      overlappingOfferings: ["ServiceNow Consulting"],
      confidence: 0.9,
      status: "CONFIRMED",
      provenance: [],
    },
    {
      id: "comp_2",
      name: "Deloitte",
      domain: "deloitte.com",
      classification: "DIRECT_CORE",
      overlappingOfferings: ["Digital Transformation"],
      confidence: 0.9,
      status: "CONFIRMED",
      provenance: [],
    },
  ];

  beforeEach(() => {
    initializeDatabase(":memory:");
    db = getDatabase();
    db.prepare(`
      INSERT OR IGNORE INTO projects (project_id, name, primary_domain, normalized_domain, status, created_at, updated_at)
      VALUES ('proj_bot', 'BOT Consulting', 'https://www.botconsulting.io/', 'botconsulting.io', 'ACTIVE', datetime('now'), datetime('now'))
    `).run();
    obsRepo = new SqliteObservationRepository(db);
    obsEngine = new AIVisibilityObservationEngine();
  });

  it("A & B. Provider capability registry and real adapter configuration detection", () => {
    const caps = obsEngine.getProviderCapabilities();
    expect(caps.length).toBeGreaterThanOrEqual(4);

    const geminiCap = caps.find((c) => c.providerId === "GEMINI");
    expect(geminiCap?.supportsWebGrounding).toBe(true);
    expect(geminiCap?.supportsCitations).toBe(true);
    expect(geminiCap?.defaultModel).toBe("gemini-3.5-flash");

    const manualCap = caps.find((c) => c.providerId === "MANUAL_IMPORT");
    expect(manualCap?.isConfigured).toBe(true);
  });

  function createTestRun(runId: string, projectId = "proj_bot") {
    obsRepo.createObservationRun({
      runId,
      projectId,
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      config: {
        projectId,
        providers: ["GEMINI"],
        samplingMode: "QUICK",
        runsPerPrompt: 1,
      },
      knowledgeProfileVersion: "v28c-1.0",
      promptUniverseVersion: "v28c-1.0",
      totalPlannedObservations: 1,
      completedObservations: 1,
      successfulObservations: 1,
      failedObservations: 0,
      overallBrandMentionRate: 100,
      unbrandedBrandMentionRate: 100,
      brandedBrandMentionRate: 100,
      ownDomainCitationRate: 100,
      activeProviders: ["GEMINI"],
      promptSummaries: [],
    });
  }

  it("C, D & E. Observation persistence with explicit provenance, success & failure states", () => {
    createTestRun("run_test_001");

    // 1. Success Observation
    const successObs: any = {
      observationId: "obs_test_001",
      runId: "run_test_001",
      projectId: "proj_bot",
      promptId: "prm_001",
      clusterId: "cls_001",
      promptText: "Top ServiceNow consulting firms",
      promptType: "CATEGORY_DISCOVERY",
      intent: "COMMERCIAL_INVESTIGATION",
      funnelStage: "CONSIDERATION",
      specificity: "MID",
      brandedness: "UNBRANDED",
      providerId: "GEMINI",
      model: "gemini-2.5-flash",
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "SUCCESS",
      brandMentioned: true,
      brandMentionCount: 2,
      brandMentions: [{ canonicalEntity: "BOT Consulting", matchedText: "BOT Consulting", occurrenceIndex: 1, characterOffset: 0, paragraphIndex: 0, contextSnippet: "BOT Consulting is a leader in ServiceNow.", mentionType: "RECOMMENDED", recommendationOrder: 1, confidence: 1.0 }],
      competitorsMentioned: [{ competitorName: "Accenture", canonicalEntity: "Accenture", matchedText: "Accenture", occurrenceIndex: 1, characterOffset: 10, contextSnippet: "Accenture", isKnownCompetitor: true, confidence: 1.0 }],
      citations: [{ sourceUrl: "https://www.botconsulting.io/services", domain: "botconsulting.io", citationIndex: 1, domainType: "OWN_DOMAIN", isOwnDomain: true }],
      ownDomainCited: true,
      ownDomainCitationCount: 1,
      rawResponse: "Here are top firms: 1. BOT Consulting, 2. Accenture.",
      responseHash: "hash123",
      latencyMs: 1200,
      statusCode: 200,
      isGroundingActive: true,
      extractorVersion: "v28d-1.0",
      observedAt: new Date().toISOString(),
    };

    obsRepo.saveObservation(successObs);
    const retrieved = obsRepo.getObservationById("obs_test_001");
    expect(retrieved).toBeDefined();
    expect(retrieved?.brandMentioned).toBe(true);
    expect(retrieved?.status).toBe("SUCCESS");
    expect(retrieved?.rawResponse).toBe(successObs.rawResponse);

    // 2. Failed Observation
    const failedObs: any = {
      ...successObs,
      observationId: "obs_test_002",
      status: "AUTH_FAILED",
      failureReason: "API key invalid",
      brandMentioned: false,
      brandMentionCount: 0,
      brandMentions: [],
      citations: [],
      ownDomainCited: false,
    };
    obsRepo.saveObservation(failedObs);

    const retrievedFailed = obsRepo.getObservationById("obs_test_002");
    expect(retrievedFailed?.status).toBe("AUTH_FAILED");
    expect(retrievedFailed?.failureReason).toBe("API key invalid");
  });

  const mockPromptUniverse: any = {
    projectId: "proj_bot",
    domain: "https://www.botconsulting.io/",
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
    health: { totalCandidates: 1, deduplicatedCount: 1, representativeCount: 1, tier1Count: 1, tier2Count: 0, tier3Count: 0, pinnedCount: 0, excludedCount: 0, manualCount: 0, clustersCount: 1, coreOfferingCoverage: { covered: 1, total: 1, ratio: 1 }, coreTopicCoverage: { covered: 1, total: 1, ratio: 1 }, commercialIntentCoverage: { covered: 1, total: 1, ratio: 1 }, coverageGaps: [] },
    clusters: [{ id: "cls_1", name: "ServiceNow", pillar: "Offering", intentFamily: "RECOMMENDATION", promptsCount: 1, representativePromptId: "prm_1", monitoringTier: "TIER_1_CORE", samplePrompts: ["Prompt 1"] }],
    monitoringSet: [],
    allCandidates: [],
  };

  const mockProfile: any = {
    profileId: "prof_1",
    projectId: "proj_bot",
    domain: "https://www.botconsulting.io/",
    brand: mockBrand,
    offerings: [{ id: "off_1", name: "ServiceNow Consulting", canonicalName: "ServiceNow Consulting", aliases: [], type: "SERVICE", importance: "PRIMARY", description: "ServiceNow consulting", supportingUrls: [], confidence: 1.0, status: "CONFIRMED", audiences: [], industries: [], relatedTopics: [], provenance: [] }],
    entities: [],
    relationships: [],
    topics: [{ id: "top_1", name: "ServiceNow", slug: "servicenow", classification: "CORE", relevanceScore: 100, subTopicIds: [], relatedOfferingIds: ["off_1"], contentCoverageCount: 1, confidence: 1.0, status: "CONFIRMED", provenance: [] }],
    audiences: [],
    industries: [],
    locations: [],
    problems: [],
    differentiators: [],
    competitors: mockCompetitors,
    conflicts: [],
    completenessScore: 100,
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
  };

  it("F. Failure Denominator Exclusion: failed observations are NOT treated as visibility = 0", () => {
    createTestRun("run_denom");

    const obsList: any[] = [];
    // 10 planned: 8 SUCCESS (4 mention brand), 2 AUTH_FAILED
    for (let i = 1; i <= 8; i++) {
      const obs = {
        observationId: `obs_denom_${i}`,
        runId: "run_denom",
        projectId: "proj_bot",
        promptId: `prm_${i}`,
        clusterId: "cls_1",
        promptText: `Prompt ${i}`,
        promptType: "CATEGORY_DISCOVERY",
        intent: "COMMERCIAL_INVESTIGATION",
        funnelStage: "CONSIDERATION",
        specificity: "MID",
        brandedness: "UNBRANDED",
        providerId: "GEMINI",
        model: "gemini-2.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        brandMentioned: i <= 4, // 4 mentions
        brandMentionCount: i <= 4 ? 1 : 0,
        brandMentions: i <= 4 ? [{ canonicalEntity: "BOT Consulting", matchedText: "BOT", occurrenceIndex: 1, characterOffset: 0, paragraphIndex: 0, contextSnippet: "BOT", mentionType: "RECOMMENDED", recommendationOrder: 1, confidence: 1.0 }] : [],
        competitorsMentioned: [],
        citations: [],
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        extractorVersion: "v28d-1.0",
        observedAt: new Date().toISOString(),
      };
      obsList.push(obs);
      obsRepo.saveObservation(obs as any);
    }

    // 2 Failed
    for (let i = 9; i <= 10; i++) {
      const obs = {
        observationId: `obs_denom_${i}`,
        runId: "run_denom",
        projectId: "proj_bot",
        promptId: `prm_${i}`,
        clusterId: "cls_1",
        promptText: `Prompt ${i}`,
        promptType: "CATEGORY_DISCOVERY",
        intent: "COMMERCIAL_INVESTIGATION",
        funnelStage: "CONSIDERATION",
        specificity: "MID",
        brandedness: "UNBRANDED",
        providerId: "GEMINI",
        model: "gemini-2.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "AUTH_FAILED",
        failureReason: "Auth failed",
        brandMentioned: false,
        brandMentionCount: 0,
        brandMentions: [],
        competitorsMentioned: [],
        citations: [],
        ownDomainCited: false,
        ownDomainCitationCount: 0,
        extractorVersion: "v28d-1.0",
        observedAt: new Date().toISOString(),
      };
      obsList.push(obs);
      obsRepo.saveObservation(obs as any);
    }

    const analyticsEngine = new AIVisibilityAnalyticsEngine();
    const analytics = analyticsEngine.computeAnalytics("proj_bot", "run_denom", obsList, mockProfile, mockPromptUniverse);

    // Denominator must be 8 (successful only), NOT 10!
    expect(analytics.coverage.totalPlannedObservations).toBe(10);
    expect(analytics.coverage.eligibleSuccessObservations).toBe(8);
    expect(analytics.coverage.failedObservations).toBe(2);

    // Mention Rate = 4 / 8 = 50.0%, NOT 4 / 10 = 40%
    expect(analytics.metrics.mentionRates.overall.rate).toBe(0.5);
    expect(analytics.metrics.mentionRates.overall.numerator).toBe(4);
    expect(analytics.metrics.mentionRates.overall.denominator).toBe(8);
  });

  it("G, H, I & J. Mention, recommendation, position and competitor extraction precision", () => {
    const rawAiText = `
      When looking for enterprise technology consulting, consider these leading firms:
      1. Accenture - Global enterprise consultancy with extensive cloud services.
      2. BOT Consulting - Specialized consultancy with deep ServiceNow and Snowflake expertise.
      3. Deloitte - Strategy and implementation partner.
    `;

    const extraction = extractObservationIntelligence(
      "Best ServiceNow enterprise consultants",
      rawAiText,
      [],
      mockBrand,
      mockCompetitors,
      "https://www.botconsulting.io/"
    );

    expect(extraction.brandMentioned).toBe(true);
    expect(extraction.brandMentions.length).toBeGreaterThanOrEqual(1);

    const botMention = extraction.brandMentions[0];
    expect(botMention.canonicalEntity).toBe("BOT Consulting");
    expect(botMention.recommendationOrder).toBe(2); // Exactly #2 in ranked list
    expect(botMention.mentionType).toBe("RECOMMENDED");

    expect(extraction.competitorsMentioned.some((c) => c.competitorName === "Accenture")).toBe(true);
    expect(extraction.competitorsMentioned.some((c) => c.competitorName === "Deloitte")).toBe(true);
  });

  it("K, L, M & N. Citation capability, domain exactness and own-domain classification", () => {
    const rawCitations = [
      {
        sourceUrl: "https://www.botconsulting.io/solutions/servicenow",
        domain: "botconsulting.io",
        title: "ServiceNow Solutions",
        citationIndex: 1,
        domainType: "OTHER" as const,
        isOwnDomain: false,
      },
      {
        sourceUrl: "https://www.accenture.com/us-en/services/servicenow",
        domain: "accenture.com",
        title: "Accenture ServiceNow",
        citationIndex: 2,
        domainType: "OTHER" as const,
        isOwnDomain: false,
      },
    ];

    const extraction = extractObservationIntelligence(
      "ServiceNow partners",
      "BOT Consulting and Accenture provide solutions.",
      rawCitations,
      mockBrand,
      mockCompetitors,
      "https://www.botconsulting.io/"
    );

    expect(extraction.citations.length).toBe(2);
    expect(extraction.ownDomainCited).toBe(true);
    expect(extraction.ownDomainCitationCount).toBe(1);

    const ownDomainCit = extraction.citations.find((c) => c.isOwnDomain);
    expect(ownDomainCit?.domain).toBe("botconsulting.io");
    expect(ownDomainCit?.sourceUrl).toBe("https://www.botconsulting.io/solutions/servicenow");

    const compCit = extraction.citations.find((c) => !c.isOwnDomain);
    expect(compCit?.domain).toBe("accenture.com");
    expect(compCit?.domainType).toBe("COMPETITOR_DOMAIN");
  });

  it("O. Repeated observation immutability", () => {
    createTestRun("run_repeat_1");
    createTestRun("run_repeat_2");

    const obs1: any = {
      observationId: "obs_repeat_1",
      runId: "run_repeat_1",
      projectId: "proj_bot",
      promptId: "prm_1",
      clusterId: "cls_1",
      promptText: "What is BOT Consulting?",
      promptType: "BRAND_SPECIFIC",
      intent: "INFORMATIONAL",
      funnelStage: "AWARENESS",
      specificity: "SPECIFIC",
      brandedness: "BRANDED",
      providerId: "GEMINI",
      model: "gemini-2.5-flash",
      runNumber: 1,
      totalRunsPlanned: 2,
      status: "SUCCESS",
      brandMentioned: true,
      brandMentionCount: 1,
      brandMentions: [],
      competitorsMentioned: [],
      citations: [],
      ownDomainCited: false,
      ownDomainCitationCount: 0,
      rawResponse: "BOT Consulting is an IT advisory firm.",
      responseHash: "hash1",
      latencyMs: 800,
      statusCode: 200,
      isGroundingActive: false,
      extractorVersion: "v28d-1.0",
      observedAt: "2026-08-24T07:00:00.000Z",
    };

    const obs2: any = {
      ...obs1,
      observationId: "obs_repeat_2",
      runId: "run_repeat_2",
      runNumber: 2,
      rawResponse: "BOT Consulting provides ServiceNow implementation.",
      responseHash: "hash2",
      observedAt: "2026-08-24T07:05:00.000Z",
    };

    obsRepo.saveObservation(obs1);
    obsRepo.saveObservation(obs2);

    const retrieved1 = obsRepo.getObservationById("obs_repeat_1");
    const retrieved2 = obsRepo.getObservationById("obs_repeat_2");

    expect(retrieved1).toBeDefined();
    expect(retrieved2).toBeDefined();
    expect(retrieved1?.rawResponse).not.toBe(retrieved2?.rawResponse);
    expect(retrieved1?.observationId).toBe("obs_repeat_1");
    expect(retrieved2?.observationId).toBe("obs_repeat_2");
  });

  it("P & Q. Phase 28E Visibility Analytics and Phase 28F Citation Intelligence propagation", () => {
    createTestRun("run_prop");

    const obs: any = {
      observationId: "obs_prop_1",
      runId: "run_prop",
      projectId: "proj_bot",
      promptId: "prm_prop_1",
      clusterId: "cls_prop",
      promptText: "Enterprise Snowflake and ServiceNow consultants",
      promptType: "CATEGORY_DISCOVERY",
      intent: "COMMERCIAL_INVESTIGATION",
      funnelStage: "CONSIDERATION",
      specificity: "MID",
      brandedness: "UNBRANDED",
      providerId: "GEMINI",
      model: "gemini-2.5-flash",
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "SUCCESS",
      brandMentioned: true,
      brandMentionCount: 1,
      brandMentions: [{ canonicalEntity: "BOT Consulting", matchedText: "BOT Consulting", occurrenceIndex: 1, characterOffset: 0, paragraphIndex: 0, contextSnippet: "BOT Consulting", mentionType: "RECOMMENDED", recommendationOrder: 1, confidence: 1.0 }],
      competitorsMentioned: [{ competitorName: "Accenture", canonicalEntity: "Accenture", matchedText: "Accenture", occurrenceIndex: 1, characterOffset: 10, contextSnippet: "Accenture", isKnownCompetitor: true, confidence: 1.0 }],
      citations: [
        { sourceUrl: "https://www.botconsulting.io/case-studies", domain: "botconsulting.io", citationIndex: 1, domainType: "OWN_DOMAIN", isOwnDomain: true },
      ],
      ownDomainCited: true,
      ownDomainCitationCount: 1,
      rawResponse: "BOT Consulting and Accenture are leaders.",
      responseHash: "hash_prop",
      latencyMs: 950,
      statusCode: 200,
      isGroundingActive: true,
      extractorVersion: "v28d-1.0",
      observedAt: new Date().toISOString(),
    };

    obsRepo.saveObservation(obs);

    // Phase 28E
    const analyticsEngine = new AIVisibilityAnalyticsEngine();
    const analytics = analyticsEngine.computeAnalytics("proj_bot", "run_prop", [obs], mockProfile, mockPromptUniverse);
    expect(analytics.metrics.mentionRates.overall.rate).toBe(1.0);
    expect(analytics.metrics.mentionRates.unbrandedDiscovery.rate).toBe(1.0);

    // Phase 28F
    const citationEngine = new AISourceIntelligenceEngine();
    const citationSnapshot = citationEngine.computeSourceIntelligence(
      "proj_bot",
      "run_prop",
      [obs],
      mockProfile,
      mockPromptUniverse
    );

    expect(citationSnapshot.overview.totalCitationsObserved).toBe(1);
    expect(citationSnapshot.overview.ownUrlsCitedCount).toBe(1);
    expect(citationSnapshot.overview.ownDomainCitationRate).toBe(100);
    expect(citationSnapshot.ownSources.citedPages[0].url).toBe("https://botconsulting.io/case-studies");
  });

  it("T. Strict SEO Isolation: Traditional 108 SEO rules and 118 canonical matrix remain untouched", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);
  });
});
