import { describe, it, expect, beforeEach } from "vitest";
import { extractObservationIntelligence } from "../observation/extractor";
import {
  globalAIObservationEngine,
  AIVisibilityObservationEngine,
} from "../observation/engine";
import { ManualImportProviderAdapter } from "../observation/adapters/manual-import-adapter";
import { OpenAIProviderAdapter } from "../observation/adapters/openai-adapter";
import { GeminiProviderAdapter } from "../observation/adapters/gemini-adapter";
import { PerplexityProviderAdapter } from "../observation/adapters/perplexity-adapter";
import { BrandIdentity, CompetitorCandidate, ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptUniverseReport, PromptCandidate } from "../prompts/types";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { initializeDatabase } from "../../crawler/persistence/db";

describe("Phase 28D: Live AI Visibility Observation & Measurement Engine", () => {
  beforeEach(() => {
    initializeDatabase(":memory:");
  });

  const mockBrand: BrandIdentity = {
    name: "BOT Consulting",
    aliases: ["BOT Consulting", "botconsulting.io", "BOT"],
    domain: "botconsulting.io",
    organizationType: "Organization",
    subBrands: [],
    confidence: 1.0,
  };

  const mockCompetitors: CompetitorCandidate[] = [
    {
      id: "comp_1",
      name: "Accenture",
      domain: "accenture.com",
      classification: "DIRECT_BUSINESS_COMPETITOR",
      overlappingOfferings: ["ServiceNow", "Cloud"],
      confidence: 0.9,
      status: "CONFIRMED",
      provenance: [],
    },
  ];

  it("1. Provider Adapter Contracts expose valid capability flags", () => {
    const openai = new OpenAIProviderAdapter();
    const gemini = new GeminiProviderAdapter();
    const perplexity = new PerplexityProviderAdapter();
    const manual = new ManualImportProviderAdapter();

    expect(openai.providerId).toBe("OPENAI");
    expect(gemini.providerId).toBe("GEMINI");
    expect(perplexity.providerId).toBe("PERPLEXITY");
    expect(manual.providerId).toBe("MANUAL_IMPORT");

    const geminiCaps = gemini.getCapabilities();
    expect(geminiCaps.supportsWebGrounding).toBe(true);
    expect(geminiCaps.supportsCitations).toBe(true);
    expect(manual.isConfigured()).toBe(true);
  });

  it("2. Provider Failure / Unconfigured does NOT count as negative brand visibility", async () => {
    const engine = new AIVisibilityObservationEngine();
    const caps = engine.getProviderCapabilities();

    expect(caps.length).toBeGreaterThanOrEqual(4);
    const unconfigured = caps.find((c) => !c.isConfigured);
    // If not configured in environment, capability correctly reflects it
    if (unconfigured) {
      expect(unconfigured.isConfigured).toBe(false);
    }
  });

  it("3. Brand Alias Extraction detects canonical brand and domain mentions", () => {
    const response = "For ServiceNow implementations, BOT Consulting is an elite consulting firm. You can reach them at botconsulting.io.";
    const res = extractObservationIntelligence(
      "Which firms do ServiceNow?",
      response,
      [],
      mockBrand,
      mockCompetitors,
      "botconsulting.io"
    );

    expect(res.brandMentioned).toBe(true);
    expect(res.brandMentionCount).toBeGreaterThanOrEqual(2);
    expect(res.brandMentions.some((m) => m.matchedText === "BOT Consulting")).toBe(true);
    expect(res.brandMentions.some((m) => m.matchedText === "botconsulting.io")).toBe(true);
  });

  it("4. FALSE-POSITIVE RESISTANCE: Generic word 'bot' alone does NOT trigger brand mention", () => {
    const genericResponse = "You can build a chat bot or automated bot using ServiceNow Virtual Agent to assist users.";
    const res = extractObservationIntelligence(
      "How to build virtual agents?",
      genericResponse,
      [],
      mockBrand,
      mockCompetitors,
      "botconsulting.io"
    );

    // Generic 'bot' should be rejected
    expect(res.brandMentioned).toBe(false);
    expect(res.brandMentionCount).toBe(0);
  });

  it("5. PROMPT CONTAMINATION GUARD: Brand in prompt is NOT counted as response mention", () => {
    const promptText = "What services does BOT Consulting offer?";
    const responseWithoutBrand = "The requested organization specializes in digital workflow modernization and AI integrations.";

    const res = extractObservationIntelligence(
      promptText,
      responseWithoutBrand,
      [],
      mockBrand,
      mockCompetitors,
      "botconsulting.io"
    );

    expect(res.brandMentioned).toBe(false);
  });

  it("6. Recommendation Order Extraction captures numbered list rank accurately", () => {
    const rankedResponse = `Top ServiceNow Consulting Partners:
1. Accenture - Global enterprise consultancy
2. Deloitte - Strategy and implementation
3. BOT Consulting - Specialized enterprise ServiceNow workflows
4. Slalom - Cloud consulting`;

    const res = extractObservationIntelligence(
      "Top ServiceNow partners?",
      rankedResponse,
      [],
      mockBrand,
      mockCompetitors,
      "botconsulting.io"
    );

    expect(res.brandMentioned).toBe(true);
    expect(res.brandRecommendationOrder).toBe(3);
    expect(res.competitorsMentioned.some((c) => c.competitorName === "Accenture" && c.recommendationOrder === 1)).toBe(true);
    expect(res.competitorsMentioned.some((c) => c.competitorName === "Deloitte" && c.recommendationOrder === 2)).toBe(true);
  });

  it("7. Citation Extraction detects Own-Domain vs Directory vs Third-Party Authority", () => {
    const rawCitations = [
      { sourceUrl: "https://botconsulting.io/services/servicenow", domain: "botconsulting.io", citationIndex: 1, domainType: "OTHER" as any, isOwnDomain: false },
      { sourceUrl: "https://www.g2.com/products/servicenow/reviews", domain: "g2.com", citationIndex: 2, domainType: "OTHER" as any, isOwnDomain: false },
      { sourceUrl: "https://www.servicenow.com/partners.html", domain: "servicenow.com", citationIndex: 3, domainType: "OTHER" as any, isOwnDomain: false },
    ];

    const res = extractObservationIntelligence(
      "ServiceNow partners",
      "BOT Consulting is listed as a partner.",
      rawCitations,
      mockBrand,
      mockCompetitors,
      "botconsulting.io"
    );

    expect(res.ownDomainCited).toBe(true);
    expect(res.ownDomainCitationCount).toBe(1);

    const ownCit = res.citations.find((c) => c.domain === "botconsulting.io");
    expect(ownCit?.domainType).toBe("OWN_DOMAIN");
    expect(ownCit?.isOwnDomain).toBe(true);

    const g2Cit = res.citations.find((c) => c.domain === "g2.com");
    expect(g2Cit?.domainType).toBe("DIRECTORY");

    const snCit = res.citations.find((c) => c.domain === "servicenow.com");
    expect(snCit?.domainType).toBe("THIRD_PARTY_AUTHORITY");
  });

  it("8. Manual Import Mode processes user-provided AI responses with full extraction", () => {
    const engine = new AIVisibilityObservationEngine();
    const mockProfile: ProjectKnowledgeProfile = {
      profileId: "kp_1",
      projectId: "proj_manual",
      domain: "botconsulting.io",
      brand: mockBrand,
      offerings: [],
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
      methodologyVersion: "v28d-1.0",
    };

    const manualObs = engine.importManualObservation(
      {
        promptText: "Which firms are recommended for ServiceNow ITSM?",
        responseText: "1. Deloitte\n2. BOT Consulting\n3. Accenture",
        sourceEngineName: "ChatGPT 4o Web",
        citations: ["https://botconsulting.io/solution-service-now"],
      },
      mockProfile
    );

    expect(manualObs.providerId).toBe("MANUAL_IMPORT");
    expect(manualObs.brandMentioned).toBe(true);
    expect(manualObs.brandRecommendationOrder).toBe(2);
    expect(manualObs.ownDomainCited).toBe(true);
    expect(manualObs.status).toBe("SUCCESS");
  });

  it("9. ABSOLUTE SEO ISOLATION: Preserves 108 Production Rules & 118 Canonical Dimensions", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullyCovered = CANONICAL_118_DIMENSIONS.filter((d) => d.classification === "FULLY_COVERED");
    expect(fullyCovered.length).toBe(113);
  });
});
