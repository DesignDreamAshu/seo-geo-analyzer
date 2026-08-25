import { describe, it, expect, beforeEach } from "vitest";
import { canonicalizeUrl, canonicalizeDomain } from "../citations/canonicalizer";
import { classifySourceOwnership, classifySourcePageType } from "../citations/classifier";
import { AISourceIntelligenceEngine } from "../citations/engine";
import { SqliteCitationRepository } from "../citations/persistence/sqlite-citation-repo";
import { AIObservation } from "../observation/types";
import { ProjectKnowledgeProfile, BrandIdentity } from "../knowledge-profile/types";
import { PromptUniverseReport } from "../prompts/types";
import { AI_SOURCE_INTELLIGENCE_VERSION } from "../citations/types";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { initializeDatabase } from "../../crawler/persistence/db";

describe("Phase 28F: AI Citation & Source Intelligence Engine", () => {
  beforeEach(() => {
    initializeDatabase(":memory:");
  });

  const mockBrand: BrandIdentity = {
    name: "BOT Consulting",
    aliases: ["BOT Consulting", "botconsulting.io"],
    domain: "botconsulting.io",
    organizationType: "Organization",
    subBrands: [],
    confidence: 1.0,
  };

  const mockProfile: ProjectKnowledgeProfile = {
    profileId: "kp_1",
    projectId: "proj_1",
    domain: "botconsulting.io",
    brand: mockBrand,
    offerings: [
      {
        id: "off_1",
        name: "ServiceNow",
        description: "Enterprise workflows",
        importance: "PRIMARY",
        relatedEntities: ["ServiceNow", "ITSM"],
        confidence: 1.0,
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
        confidence: 0.9,
        status: "CONFIRMED",
        provenance: [],
      },
    ],
    conflicts: [],
    completenessScore: 100,
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
  };

  const mockPromptUniverse: PromptUniverseReport = {
    projectId: "proj_1",
    domain: "botconsulting.io",
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
    health: { totalCandidates: 10, clusterCount: 1, representativeCount: 5, healthScore: 100 },
    clusters: [
      {
        id: "cls_1",
        name: "ServiceNow Vendor Discovery",
        dominantIntent: "VENDOR_DISCOVERY",
        pillar: "AEO",
        candidateCount: 10,
        tier1PromptIds: ["prm_1", "prm_2"],
        tier2PromptIds: [],
        tier3PromptIds: [],
        clusterSummary: "Vendor questions",
      },
    ],
    monitoringSet: { tier1Core: [], tier2Expanded: [], tier3Experimental: [], totalCount: 0, clusterCoverageRatio: 1.0 },
    allCandidates: [],
  };

  function createMockObservation(overrides: Partial<AIObservation> = {}): AIObservation {
    return {
      observationId: `obs_${Math.random().toString(36).slice(2)}`,
      runId: "run_1",
      projectId: "proj_1",
      promptId: "prm_1",
      clusterId: "cls_1",
      promptText: "Top ServiceNow consulting partners?",
      promptType: "VENDOR_RECOMMENDATION",
      intent: "VENDOR_DISCOVERY",
      funnelStage: "CONSIDERATION",
      specificity: "MID",
      brandedness: "UNBRANDED",
      providerId: "OPENAI",
      model: "gpt-4o",
      runNumber: 1,
      totalRunsPlanned: 1,
      status: "SUCCESS",
      brandMentioned: false,
      brandMentionCount: 0,
      brandMentions: [],
      competitorsMentioned: [],
      citations: [],
      ownDomainCited: false,
      ownDomainCitationCount: 0,
      extractorVersion: "v28d-1.0",
      observedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("1. URL Canonicalization strips UTMs, tracking parameters, and default ports while preserving distinct paths", () => {
    const res1 = canonicalizeUrl("https://www.botconsulting.io/services/servicenow/?utm_source=chatgpt&utm_medium=referral");
    expect(res1.canonicalUrl).toBe("https://botconsulting.io/services/servicenow");
    expect(res1.domain).toBe("botconsulting.io");
    expect(res1.path).toBe("/services/servicenow");

    const res2 = canonicalizeUrl("http://botconsulting.io:80/services/case-study#overview");
    expect(res2.canonicalUrl).toBe("https://botconsulting.io/services/case-study");

    // Semantic path distinction: /services vs /services/case-study
    expect(res1.canonicalUrl).not.toBe(res2.canonicalUrl);
  });

  it("2. Domain Canonicalization extracts registrable domain and subdomains cleanly", () => {
    const res1 = canonicalizeDomain("https://blog.botconsulting.io/article");
    expect(res1.canonicalDomain).toBe("blog.botconsulting.io");
    expect(res1.subdomain).toBe("blog");

    const res2 = canonicalizeDomain("www.botconsulting.io");
    expect(res2.canonicalDomain).toBe("botconsulting.io");
    expect(res2.subdomain).toBeNull();
  });

  it("3. Source Ownership Classification resolves Own-Domain, Confirmed Competitor, and Third-Party Authority", () => {
    const own = classifySourceOwnership("botconsulting.io", mockProfile);
    expect(own.ownershipType).toBe("OWN_DOMAIN");
    expect(own.associatedEntityName).toBe("BOT Consulting");

    const comp = classifySourceOwnership("accenture.com", mockProfile);
    expect(comp.ownershipType).toBe("CONFIRMED_COMPETITOR");
    expect(comp.associatedEntityName).toBe("Accenture");

    const candidate = classifySourceOwnership("deloitte.com", mockProfile);
    expect(candidate.ownershipType).toBe("OBSERVED_COMPETITOR_CANDIDATE");

    const dir = classifySourceOwnership("g2.com", mockProfile);
    expect(dir.ownershipType).toBe("DIRECTORY");

    const news = classifySourceOwnership("forbes.com", mockProfile);
    expect(news.ownershipType).toBe("NEWS");

    const doc = classifySourceOwnership("docs.servicenow.com", mockProfile);
    expect(doc.ownershipType).toBe("DOCUMENTATION");
  });

  it("4. Page-Type Classification recognizes service, case study, guide, and product URLs", () => {
    expect(classifySourcePageType("/solutions/servicenow-implementation")).toBe("SERVICE");
    expect(classifySourcePageType("/customer-stories/healthcare-workflow")).toBe("CASE_STUDY");
    expect(classifySourcePageType("/blog/how-to-optimize-it-service-management")).toBe("BLOG");
    expect(classifySourcePageType("/whitepapers/enterprise-guide")).toBe("GUIDE");
    expect(classifySourcePageType("/")).toBe("HOME");
  });

  it("5. Citation Frequency vs Response Penetration differentiates multiple citations in single response", () => {
    const engine = new AISourceIntelligenceEngine();
    // One observation with 2 citations from the same URL
    const obsList = [
      createMockObservation({
        citations: [
          { sourceUrl: "https://accenture.com/servicenow", domain: "accenture.com", citationIndex: 1, domainType: "COMPETITOR_DOMAIN", isOwnDomain: false },
          { sourceUrl: "https://accenture.com/servicenow", domain: "accenture.com", citationIndex: 2, domainType: "COMPETITOR_DOMAIN", isOwnDomain: false },
        ],
      }),
    ];

    const snapshot = engine.computeSourceIntelligence("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    const accentureUrl = snapshot.topWinningUrls.find((u) => u.canonicalUrl === "https://accenture.com/servicenow");
    expect(accentureUrl).toBeDefined();
    expect(accentureUrl?.citationCount).toBe(2); // Frequency = 2
    expect(accentureUrl?.responseCount).toBe(1); // Response Penetration = 1 response
    expect(accentureUrl?.responsePenetrationRate).toBe(100);
  });

  it("6. Cross-Provider Source Consensus identifies multi-provider and cross-provider sources", () => {
    const engine = new AISourceIntelligenceEngine();
    const obsList = [
      createMockObservation({
        providerId: "OPENAI",
        citations: [{ sourceUrl: "https://docs.servicenow.com/bundle", domain: "docs.servicenow.com", citationIndex: 1, domainType: "THIRD_PARTY_AUTHORITY", isOwnDomain: false }],
      }),
      createMockObservation({
        providerId: "GEMINI",
        citations: [{ sourceUrl: "https://docs.servicenow.com/bundle", domain: "docs.servicenow.com", citationIndex: 1, domainType: "THIRD_PARTY_AUTHORITY", isOwnDomain: false }],
      }),
      createMockObservation({
        providerId: "PERPLEXITY",
        citations: [{ sourceUrl: "https://docs.servicenow.com/bundle", domain: "docs.servicenow.com", citationIndex: 1, domainType: "THIRD_PARTY_AUTHORITY", isOwnDomain: false }],
      }),
    ];

    const snapshot = engine.computeSourceIntelligence("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    const docUrl = snapshot.topWinningUrls.find((u) => u.domain === "docs.servicenow.com");
    expect(docUrl?.consensusLevel).toBe("CROSS_PROVIDER_CONSENSUS_SOURCE");
    expect(docUrl?.providers.length).toBe(3);
  });

  it("7. Evidenced Citation Gaps calculate percentage-point gap with supporting evidence traces", () => {
    const engine = new AISourceIntelligenceEngine();
    const obsList = [
      createMockObservation({
        clusterId: "cls_1",
        ownDomainCited: false,
        citations: [{ sourceUrl: "https://accenture.com/servicenow", domain: "accenture.com", citationIndex: 1, domainType: "COMPETITOR_DOMAIN", isOwnDomain: false }],
      }),
      createMockObservation({
        clusterId: "cls_1",
        ownDomainCited: false,
        citations: [{ sourceUrl: "https://accenture.com/servicenow", domain: "accenture.com", citationIndex: 1, domainType: "COMPETITOR_DOMAIN", isOwnDomain: false }],
      }),
    ];

    const snapshot = engine.computeSourceIntelligence("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    expect(snapshot.gaps.length).toBeGreaterThanOrEqual(1);
    const gap = snapshot.gaps[0];
    expect(gap.leaderEntityOrDomain).toBe("Accenture");
    expect(gap.gapMagnitudePp).toBe(100); // 100% competitor - 0% own = 100 pp
    expect(gap.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("8. Uncited Relevant Pages discovers project landing pages with zero observed citations", () => {
    const engine = new AISourceIntelligenceEngine();
    const crawledPages = [
      { url: "https://botconsulting.io/services/servicenow", title: "ServiceNow Consulting Services", statusCode: 200 } as any,
    ];

    // No citations for botconsulting.io in observations
    const obsList = [createMockObservation({ ownDomainCited: false })];

    const snapshot = engine.computeSourceIntelligence("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse, crawledPages);

    expect(snapshot.ownSources.uncitedRelevantPages.length).toBe(1);
    expect(snapshot.ownSources.uncitedRelevantPages[0].url).toBe("https://botconsulting.io/services/servicenow");
    expect(snapshot.ownSources.uncitedRelevantPages[0].offeringName).toBe("ServiceNow");
  });

  it("9. Immutable Source Intelligence Snapshots persist and load cleanly in SQLite", () => {
    const engine = new AISourceIntelligenceEngine();
    const obsList = [
      createMockObservation({
        citations: [{ sourceUrl: "https://botconsulting.io/solution", domain: "botconsulting.io", citationIndex: 1, domainType: "OWN_DOMAIN", isOwnDomain: true }],
      }),
    ];

    const snapshot = engine.computeSourceIntelligence("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    const repo = new SqliteCitationRepository(initializeDatabase(":memory:"));
    repo.saveCitationSnapshot(snapshot);

    const loaded = repo.getCitationSnapshot(snapshot.snapshotId);
    expect(loaded).toBeDefined();
    expect(loaded?.snapshotId).toBe(snapshot.snapshotId);
    expect(loaded?.version).toBe(AI_SOURCE_INTELLIGENCE_VERSION);
    expect(loaded?.certificationStatus).toBe("PENDING");
  });

  it("10. ABSOLUTE SEO ISOLATION: Preserves 108 Production Rules & 118 Canonical Dimensions", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullyCovered = CANONICAL_118_DIMENSIONS.filter((d) => d.classification === "FULLY_COVERED");
    expect(fullyCovered.length).toBe(113);
  });
});
