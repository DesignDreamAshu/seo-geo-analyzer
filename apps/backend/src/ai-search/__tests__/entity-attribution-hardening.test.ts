/**
 * Phase 28D.1: Entity Attribution Hardening & Ambiguity Resolution Test Suite.
 * Verifies that literal string matching is distinguished from confirmed entity visibility.
 * Strictly isolated from traditional SEO diagnostic rules.
 */

import { describe, it, expect } from "vitest";
import { extractObservationIntelligence } from "../observation/extractor";
import { BrandIdentity, CompetitorCandidate, ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";

describe("Phase 28D.1: Multi-Signal Entity Attribution Hardening Suite", () => {
  const botBrand: BrandIdentity = {
    name: "BOT Consulting",
    domain: "https://www.botconsulting.io/",
    aliases: ["BOT Consulting", "botconsulting.io", "BOT", "BOT Consulting LLC"],
    organizationType: "Organization",
    subBrands: ["Odyssey by BOT", "Cloudsmith"],
    confidence: 1.0,
  };

  const competitors: CompetitorCandidate[] = [
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
    {
      id: "comp_2",
      name: "Deloitte",
      domain: "deloitte.com",
      classification: "DIRECT_BUSINESS_COMPETITOR",
      overlappingOfferings: ["Digital Transformation"],
      confidence: 1.0,
      status: "CONFIRMED",
      provenance: [],
    },
  ];

  const knowledgeProfile: Partial<ProjectKnowledgeProfile> = {
    domain: "https://www.botconsulting.io/",
    brand: botBrand,
    offerings: [
      {
        id: "off_1",
        name: "ServiceNow Implementation",
        canonicalName: "ServiceNow Advisory & Implementation",
        aliases: ["ServiceNow", "ITSM", "HRSD", "ITOM", "CSM"],
        type: "SERVICE",
        importance: "PRIMARY",
        description: "Enterprise ServiceNow digital workflow solutions.",
        supportingUrls: ["https://www.botconsulting.io/services"],
        confidence: 1.0,
        status: "CONFIRMED",
        audiences: ["Enterprise IT Leaders"],
        industries: ["Technology", "Healthcare", "Financial Services"],
        relatedTopics: ["ServiceNow", "Digital Transformation"],
        provenance: [],
      },
    ],
  };

  it("A. Positive Control: Confirms entity visibility when domain or canonical profile context is present", () => {
    const response = `
      BOT Consulting (https://www.botconsulting.io) is an enterprise consulting firm specializing in ServiceNow digital transformation and advisory solutions.
      They help enterprise clients modernize their IT workflows, ITSM, and HR service delivery.
    `;

    const result = extractObservationIntelligence(
      "Who are top ServiceNow partners?",
      response,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(result.stringMentionDetected).toBe(true);
    expect(result.entityMentionConfirmed).toBe(true);
    expect(result.brandMentioned).toBe(true);
    expect(result.entityAttribution.state).toBe("CONFIRMED_ENTITY");
    expect(result.entityAttribution.confidence).toBeGreaterThanOrEqual(0.70);
    expect(result.entityAttribution.positiveSignals.length).toBeGreaterThan(0);
    expect(result.brandMentions[0].isConfirmedEntity).toBe(true);
  });

  it("B. Negative Generic Control: Classifies Build-Operate-Transfer generic concept as AMBIGUOUS/GENERIC without inflating visibility", () => {
    const response = `
      Because the term "BOT" in business and enterprise IT typically refers to two different concepts, "BOT Consulting" usually falls into one of two categories:
      1. Build-Operate-Transfer (BOT) Consulting (an outsourcing and expansion model).
      2. "Bot" (Automation, RPA, and AI) Consulting (technological automation).
      
      Definition 1: Build-Operate-Transfer (BOT) Consulting...
      Definition 2: "Bot" (AI, RPA, and Automation) Consulting...

      If you are looking for a specific boutique firm named "BOT Consulting," please provide a bit of context!
    `;

    const result = extractObservationIntelligence(
      "What services does BOT Consulting provide for enterprise clients?",
      response,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(result.stringMentionDetected).toBe(true);
    expect(result.entityMentionConfirmed).toBe(false);
    expect(result.brandMentioned).toBe(false); // False-positive averted!
    expect(result.brandRecommendationOrder).toBeNull();
    expect(result.entityAttribution.state).toBe("AMBIGUOUS_ENTITY");
    expect(result.entityAttribution.negativeSignals).toContain("GENERIC_ACRONYM_OR_HOMONYM_EXPANSION_DETECTED");
  });

  it("C. Explicit Clarification Request: Provider asks user to clarify entity", () => {
    const response = `
      There are several organizations known as BOT Consulting. Which BOT Consulting firm are you referring to?
      Please provide more context such as location or industry.
    `;

    const result = extractObservationIntelligence(
      "Where is BOT Consulting located?",
      response,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(result.stringMentionDetected).toBe(true);
    expect(result.entityMentionConfirmed).toBe(false);
    expect(result.brandMentioned).toBe(false);
    expect(result.entityAttribution.state).toBe("AMBIGUOUS_ENTITY");
  });

  it("D. Different Entity Control: Unrelated company with same string token", () => {
    const response = `
      BOT Consulting is a robotics toy manufacturing company located in Tokyo, Japan, founded in 1985 to manufacture RC bots.
    `;

    const result = extractObservationIntelligence(
      "Tell me about BOT Consulting",
      response,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(result.stringMentionDetected).toBe(true);
    expect(result.entityMentionConfirmed).toBe(false);
    expect(result.brandMentioned).toBe(false);
  });

  it("E. Alias Control: Sub-brand / Alias matches canonical knowledge context", () => {
    const response = `
      For enterprise clients seeking proprietary workflow automation, Odyssey by BOT delivers specialized ServiceNow integrations and platform advisory.
    `;

    const result = extractObservationIntelligence(
      "What is Odyssey by BOT?",
      response,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(result.stringMentionDetected).toBe(true);
    expect(result.entityMentionConfirmed).toBe(true);
    expect(result.brandMentioned).toBe(true);
    expect(["CONFIRMED_ENTITY", "PROBABLE_ENTITY"]).toContain(result.entityAttribution.state);
  });

  it("F. Invariant: Recommendation & Position Order REQUIRE Confirmed Entity Attribution", () => {
    const genericRankedResponse = `
      Here are the top operating models:
      1. Build-Operate-Transfer (BOT) Consulting
      2. Direct Staff Augmentation
      3. Managed Service Provider
    `;

    const genericRes = extractObservationIntelligence(
      "Compare consulting models",
      genericRankedResponse,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(genericRes.brandMentioned).toBe(false);
    expect(genericRes.brandRecommendationOrder).toBeNull(); // Position #1 is NOT assigned to unconfirmed entity!

    const confirmedRankedResponse = `
      Top ServiceNow Partners:
      1. Accenture
      2. BOT Consulting (botconsulting.io)
      3. Deloitte
    `;

    const confirmedRes = extractObservationIntelligence(
      "Top ServiceNow partners",
      confirmedRankedResponse,
      [],
      botBrand,
      competitors,
      "https://www.botconsulting.io/",
      knowledgeProfile as any
    );

    expect(confirmedRes.brandMentioned).toBe(true);
    expect(confirmedRes.brandRecommendationOrder).toBe(2);
    expect(confirmedRes.brandMentions[0].mentionType).toBe("RECOMMENDED");
  });

  it("G. Homonym Disambiguation: Generic across arbitrary entity names (Apple, Jaguar, Amazon)", () => {
    const appleBrand: BrandIdentity = {
      name: "Apple",
      domain: "https://www.apple.com/",
      aliases: ["Apple Inc", "apple.com"],
      organizationType: "Corporation",
      subBrands: ["iPhone", "MacBook", "iOS"],
      confidence: 1.0,
    };

    const fruitResponse = "An apple is a round, edible fruit produced by an apple tree (Malus domestica) commonly grown in orchards.";
    const fruitRes = extractObservationIntelligence("Tell me about apples", fruitResponse, [], appleBrand, [], "https://www.apple.com/");
    expect(fruitRes.brandMentioned).toBe(false);
    expect(fruitRes.entityAttribution.state).toBe("GENERIC_TERM");

    const techResponse = "Apple is an American multinational technology company headquartered in Cupertino, California, that designs the iPhone and MacBook.";
    const techRes = extractObservationIntelligence("Tell me about Apple", techResponse, [], appleBrand, [], "https://www.apple.com/");
    expect(techRes.brandMentioned).toBe(true);
    expect(techRes.entityAttribution.state).toBe("CONFIRMED_ENTITY");
  });

  it("H. Strict SEO Isolation: Traditional 108 SEO rules and 118 canonical matrix remain 100% untouched", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);
  });
});
