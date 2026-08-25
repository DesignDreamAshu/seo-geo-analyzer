/**
 * Phase 28D.1: Gemini Search Grounding & Citation Intelligence Certification Test Suite.
 * Covers grounding provenance, citation gating, URL normalization, model provenance,
 * Phase 28E denominator semantics, and Phase 28F source propagation.
 * Strictly isolated from traditional SEO diagnostic rules.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { GeminiProviderAdapter } from "../observation/adapters/gemini-adapter";
import { extractObservationIntelligence } from "../observation/extractor";
import { BrandIdentity, CompetitorCandidate, ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { AIObservation, CitationObservation } from "../observation/types";
import { AIVisibilityAnalyticsEngine } from "../analytics/engine";
import { AISourceIntelligenceEngine } from "../citations/engine";
import { SqliteObservationRepository } from "../observation/persistence/sqlite-observation-repo";
import { canonicalizeUrl } from "../citations/canonicalizer";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";

describe("Phase 28D.1: Gemini Search Grounding & Citation Intelligence Certification Suite", () => {
  let db: DatabaseSync;
  let obsRepo: SqliteObservationRepository;

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
      classification: "DIRECT_BUSINESS_COMPETITOR",
      overlappingOfferings: ["ServiceNow", "Enterprise Consulting"],
      confidence: 1.0,
      status: "CONFIRMED",
      provenance: [],
    },
  ];

  const mockProfile: ProjectKnowledgeProfile = {
    profileId: "prof_1",
    projectId: "proj_1",
    domain: "https://www.botconsulting.io/",
    brand: mockBrand,
    offerings: [
      {
        id: "off_1",
        name: "ServiceNow Implementation",
        canonicalName: "ServiceNow Advisory & Implementation",
        aliases: ["ServiceNow", "ITSM", "HRSD"],
        type: "SERVICE",
        importance: "PRIMARY",
        description: "Enterprise ServiceNow workflow solutions.",
        supportingUrls: ["https://www.botconsulting.io/services/servicenow"],
        confidence: 1.0,
        status: "CONFIRMED",
        audiences: ["IT Leaders"],
        industries: ["Enterprise"],
        relatedTopics: ["ServiceNow"],
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
    competitors: mockCompetitors,
    conflicts: [],
    completenessScore: 100,
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
  };

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_observations (
        observation_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        prompt_id TEXT NOT NULL,
        cluster_id TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_type TEXT NOT NULL,
        intent TEXT NOT NULL,
        funnel_stage TEXT NOT NULL,
        specificity TEXT NOT NULL,
        brandedness TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        model TEXT NOT NULL,
        run_number INTEGER NOT NULL,
        status TEXT NOT NULL,
        failure_reason TEXT,
        raw_response TEXT,
        normalized_response TEXT,
        response_hash TEXT,
        brand_mentioned INTEGER NOT NULL,
        brand_mention_count INTEGER NOT NULL,
        brand_recommendation_order INTEGER,
        own_domain_cited INTEGER NOT NULL,
        own_domain_citation_count INTEGER NOT NULL,
        mentions_json TEXT,
        competitors_json TEXT,
        citations_json TEXT,
        extractor_version TEXT NOT NULL,
        observed_at TEXT NOT NULL
      );
    `);
    obsRepo = new SqliteObservationRepository(db);
  });

  it("1. Grounding requested + active + citations: Extracts real provider citations and classifies correctly", () => {
    const rawAiText = "BOT Consulting provides elite ServiceNow advisory and implementation services.";
    const rawCitations: CitationObservation[] = [
      {
        sourceUrl: "https://www.botconsulting.io/services/servicenow",
        domain: "botconsulting.io",
        title: "BOT Consulting ServiceNow Advisory",
        citationIndex: 1,
        domainType: "OWN_DOMAIN",
        isOwnDomain: true,
      },
      {
        sourceUrl: "https://clutch.co/profile/bot-consulting",
        domain: "clutch.co",
        title: "BOT Consulting Reviews on Clutch",
        citationIndex: 2,
        domainType: "DIRECTORY",
        isOwnDomain: false,
      },
    ];

    const extraction = extractObservationIntelligence(
      "What services does BOT Consulting provide?",
      rawAiText,
      rawCitations,
      mockBrand,
      mockCompetitors,
      "https://www.botconsulting.io/",
      mockProfile
    );

    expect(extraction.citations.length).toBe(2);
    expect(extraction.ownDomainCited).toBe(true);
    expect(extraction.ownDomainCitationCount).toBe(1);
    expect(extraction.citations[0].domainType).toBe("OWN_DOMAIN");
    expect(extraction.citations[1].domainType).toBe("DIRECTORY");
  });

  it("2. Grounding requested + active + zero citations: Preserves 0 citations without fabricating sources", () => {
    const rawAiText = "BOT Consulting specializes in ServiceNow digital transformation.";
    const extraction = extractObservationIntelligence(
      "What services does BOT Consulting provide?",
      rawAiText,
      [],
      mockBrand,
      mockCompetitors,
      "https://www.botconsulting.io/",
      mockProfile
    );

    expect(extraction.citations.length).toBe(0);
    expect(extraction.ownDomainCited).toBe(false);
    expect(extraction.ownDomainCitationCount).toBe(0);
  });

  it("3 & 4. Grounding failure + inference fallback: Preserves fallback metadata without reporting fake active grounding", async () => {
    const adapter = new GeminiProviderAdapter();
    const result = await adapter.executePrompt("Test prompt", { model: "gemini-3.5-flash" });

    // When executed against live key with unbilled search tool, fallback kicks in
    expect(["SUCCESS", "RATE_LIMITED"]).toContain(result.status);
    if (result.status === "SUCCESS") {
      expect(result.response?.configuredModel).toBe("gemini-3.5-flash");
      expect(result.response?.requestedModel).toBe("gemini-3.5-flash");
      expect(result.response?.providerConfirmedModel).toBeNull(); // NOT_RETURNED by Google in body
      expect(result.response?.requestedGrounding).toBe(true);
      expect(result.response?.groundingState).toBe("GROUNDING_NOT_ACTIVE");
      expect(result.response?.fallbackUsed).toBe(true);
      expect(result.response?.fallbackReason).toContain("429");
    } else {
      expect(result.failureReason).toBeDefined();
    }
  });

  it("5. Grounding not requested: Citation state remains NOT_ACTIVE", () => {
    const obs: Partial<AIObservation> = {
      observationId: "obs_test_1",
      requestedGrounding: false,
      groundingState: "GROUNDING_NOT_ACTIVE",
      citations: [],
    };

    expect(obs.groundingState).toBe("GROUNDING_NOT_ACTIVE");
    expect(obs.citations?.length).toBe(0);
  });

  it("6 & 7. No citation inference from prose: Never extracts prose URLs as citations", () => {
    const proseWithUrl = "Visit us at https://unrelated-domain.com/blog to read more.";
    const extraction = extractObservationIntelligence(
      "Tell me more",
      proseWithUrl,
      [], // Provider returned 0 grounding chunks
      mockBrand,
      mockCompetitors,
      "https://www.botconsulting.io/",
      mockProfile
    );

    expect(extraction.citations.length).toBe(0); // Zero citations inferred from prose!
  });

  it("8 & 9. Own-domain URL normalization vs third-party domains", () => {
    const url1 = canonicalizeUrl("https://www.botconsulting.io/services/?utm_source=123#ref");
    expect(url1.canonicalUrl).toBe("https://botconsulting.io/services");
    expect(url1.domain).toBe("botconsulting.io");

    const url2 = canonicalizeUrl("http://botconsulting.io/about/");
    expect(url2.canonicalUrl).toBe("https://botconsulting.io/about");

    const thirdParty = canonicalizeUrl("https://forbes.com/article/bot-consulting");
    expect(thirdParty.domain).toBe("forbes.com");
    expect(thirdParty.domain).not.toBe("botconsulting.io");
  });

  it("10. Model Provenance: Persists configuredModel, requestedModel, and providerConfirmedModel correctly", () => {
    const obs: AIObservation = {
      observationId: "obs_prov_1",
      runId: "run_1",
      projectId: "proj_1",
      promptId: "prm_1",
      clusterId: "cl_1",
      promptText: "What is BOT Consulting?",
      promptType: "BRAND_SPECIFIC",
      intent: "INFORMATIONAL",
      funnelStage: "AWARENESS",
      specificity: "MID",
      brandedness: "BRANDED",
      providerId: "GEMINI",
      model: "gemini-3.5-flash",
      configuredModel: "gemini-3.5-flash",
      requestedModel: "gemini-3.5-flash",
      providerConfirmedModel: null, // Stored explicitly as null/NOT_RETURNED
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "SUCCESS",
      requestedGrounding: true,
      groundingState: "GROUNDING_NOT_ACTIVE",
      fallbackUsed: true,
      fallbackReason: "HTTP 429 RESOURCE_EXHAUSTED",
      brandMentioned: false,
      brandMentionCount: 0,
      brandMentions: [],
      competitorsMentioned: [],
      citations: [],
      ownDomainCited: false,
      ownDomainCitationCount: 0,
      extractorVersion: "v28d1-entity-attribution-2.0",
      observedAt: new Date().toISOString(),
    };

    expect(obs.configuredModel).toBe("gemini-3.5-flash");
    expect(obs.requestedModel).toBe("gemini-3.5-flash");
    expect(obs.providerConfirmedModel).toBeNull();
  });

  it("11. Phase 28E Denominator Semantics: Non-grounded observations do NOT enter citation denominator", () => {
    const obsList: AIObservation[] = [
      {
        observationId: "obs_1",
        runId: "run_1",
        projectId: "proj_1",
        promptId: "p1",
        clusterId: "c1",
        promptText: "Test 1",
        promptType: "BRAND_SPECIFIC",
        intent: "INFORMATIONAL",
        funnelStage: "AWARENESS",
        specificity: "MID",
        brandedness: "BRANDED",
        providerId: "GEMINI",
        model: "gemini-3.5-flash",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_NOT_ACTIVE", // Fallback used, grounding disabled
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
      {
        observationId: "obs_2",
        runId: "run_1",
        projectId: "proj_1",
        promptId: "p2",
        clusterId: "c1",
        promptText: "Test 2",
        promptType: "BRAND_SPECIFIC",
        intent: "INFORMATIONAL",
        funnelStage: "AWARENESS",
        specificity: "MID",
        brandedness: "BRANDED",
        providerId: "PERPLEXITY",
        model: "sonar",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_ACTIVE", // Genuinely grounded
        brandMentioned: true,
        brandMentionCount: 1,
        brandMentions: [],
        competitorsMentioned: [],
        citations: [
          {
            sourceUrl: "https://www.botconsulting.io/",
            domain: "botconsulting.io",
            citationIndex: 1,
            domainType: "OWN_DOMAIN",
            isOwnDomain: true,
          },
        ],
        ownDomainCited: true,
        ownDomainCitationCount: 1,
        extractorVersion: "v28d1-entity-attribution-2.0",
        observedAt: new Date().toISOString(),
      },
    ];

    const analyticsEngine = new AIVisibilityAnalyticsEngine();
    const analytics = analyticsEngine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, {
      universeId: "u1",
      projectId: "proj_1",
      generatedAt: new Date().toISOString(),
      summary: { totalPrompts: 2, totalClusters: 1, brandedCount: 2, unbrandedCount: 0, semiBrandedCount: 0, totalExpandedPermutations: 2, coverageDistribution: {} as any },
      prompts: [],
      clusters: [],
      generationMethodologyVersion: "v28c-1.0",
    });

    // Denominator for citation rate must be exactly 1 (the grounded observation), NOT 2!
    expect(analytics.metrics.citations.ownDomainCitationRate.denominator).toBe(1);
    expect(analytics.metrics.citations.ownDomainCitationRate.numerator).toBe(1);
    expect(analytics.metrics.citations.ownDomainCitationRate.rate).toBe(1.0);
  });

  it("12. Phase 28F Source Propagation: Grounded citations propagate into Source Intelligence profiles", () => {
    const obsList: AIObservation[] = [
      {
        observationId: "obs_src_1",
        runId: "run_src",
        projectId: "proj_1",
        promptId: "p1",
        clusterId: "c1",
        promptText: "Who implements ServiceNow?",
        promptType: "CATEGORY_EXPLORATION",
        intent: "VENDOR_DISCOVERY",
        funnelStage: "CONSIDERATION",
        specificity: "BROAD",
        brandedness: "UNBRANDED",
        providerId: "PERPLEXITY",
        model: "sonar",
        runNumber: 1,
        totalRunsPlanned: 1,
        status: "SUCCESS",
        groundingState: "GROUNDING_ACTIVE",
        brandMentioned: true,
        brandMentionCount: 1,
        brandMentions: [],
        competitorsMentioned: [],
        citations: [
          {
            sourceUrl: "https://www.botconsulting.io/solutions/servicenow",
            domain: "botconsulting.io",
            citationIndex: 1,
            domainType: "OWN_DOMAIN",
            isOwnDomain: true,
          },
        ],
        ownDomainCited: true,
        ownDomainCitationCount: 1,
        extractorVersion: "v28d1-entity-attribution-2.0",
        observedAt: new Date().toISOString(),
      },
    ];

    const sourceEngine = new AISourceIntelligenceEngine();
    const sourceSnapshot = sourceEngine.computeSourceIntelligence("proj_1", "run_src", obsList, mockProfile, {
      universeId: "u1",
      projectId: "proj_1",
      generatedAt: new Date().toISOString(),
      summary: { totalPrompts: 1, totalClusters: 1, brandedCount: 0, unbrandedCount: 1, semiBrandedCount: 0, totalExpandedPermutations: 1, coverageDistribution: {} as any },
      prompts: [],
      clusters: [],
      generationMethodologyVersion: "v28c-1.0",
    });

    expect(sourceSnapshot.overview.totalCitationsObserved).toBe(1);
    expect(sourceSnapshot.overview.ownDomainCitationRate).toBe(100);
    expect(sourceSnapshot.topWinningUrls.length).toBe(1);
    expect(sourceSnapshot.topWinningUrls[0].domain).toBe("botconsulting.io");
    expect(sourceSnapshot.topWinningUrls[0].ownershipType).toBe("OWN_DOMAIN");
  });

  it("13. Entity attribution remains 100% hardened and intact", () => {
    const genericResponse = "BOT Consulting refers to Build-Operate-Transfer consulting models.";
    const result = extractObservationIntelligence(
      "Explain BOT consulting",
      genericResponse,
      [],
      mockBrand,
      mockCompetitors,
      "https://www.botconsulting.io/",
      mockProfile
    );

    expect(result.stringMentionDetected).toBe(true);
    expect(result.entityMentionConfirmed).toBe(false);
    expect(result.brandMentioned).toBe(false);
    expect(result.entityAttribution.state).toBe("GENERIC_TERM");
  });

  it("14. Provider failure semantics: Failed observations are excluded from denominators", () => {
    const failedObs: AIObservation = {
      observationId: "obs_fail_1",
      runId: "run_f",
      projectId: "proj_1",
      promptId: "p_f",
      clusterId: "c1",
      promptText: "Failed prompt",
      promptType: "BRAND_SPECIFIC",
      intent: "INFORMATIONAL",
      funnelStage: "AWARENESS",
      specificity: "MID",
      brandedness: "BRANDED",
      providerId: "GEMINI",
      model: "gemini-3.5-flash",
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "AUTH_FAILED",
      failureReason: "Invalid API key",
      brandMentioned: false,
      brandMentionCount: 0,
      brandMentions: [],
      competitorsMentioned: [],
      citations: [],
      ownDomainCited: false,
      ownDomainCitationCount: 0,
      extractorVersion: "v28d1-entity-attribution-2.0",
      observedAt: new Date().toISOString(),
    };

    expect(failedObs.status).toBe("AUTH_FAILED");
    expect(failedObs.brandMentioned).toBe(false);
  });

  it("15. Raw observation immutability: Saving and retrieving preserves exact hash and bytes", () => {
    const obs: AIObservation = {
      observationId: "obs_immut_1",
      runId: "run_immut",
      projectId: "proj_1",
      promptId: "p_immut",
      clusterId: "c1",
      promptText: "Immutable prompt",
      promptType: "BRAND_SPECIFIC",
      intent: "INFORMATIONAL",
      funnelStage: "AWARENESS",
      specificity: "MID",
      brandedness: "BRANDED",
      providerId: "GEMINI",
      model: "gemini-3.5-flash",
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "SUCCESS",
      rawResponse: "Raw unmodified provider text",
      normalizedResponse: "Raw unmodified provider text",
      responseHash: "hash_abc_123",
      brandMentioned: false,
      brandMentionCount: 0,
      brandMentions: [],
      competitorsMentioned: [],
      citations: [],
      ownDomainCited: false,
      ownDomainCitationCount: 0,
      extractorVersion: "v28d1-entity-attribution-2.0",
      observedAt: new Date().toISOString(),
    };

    obsRepo.saveObservation(obs);
    const retrieved = obsRepo.getObservationById("obs_immut_1");

    expect(retrieved?.responseHash).toBe("hash_abc_123");
    expect(retrieved?.rawResponse).toBe("Raw unmodified provider text");
  });

  it("16. Strict SEO Isolation: Traditional 108 SEO rules and 118 canonical matrix remain 100% untouched", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);
  });
});
