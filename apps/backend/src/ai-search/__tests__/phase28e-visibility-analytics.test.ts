import { describe, it, expect, beforeEach } from "vitest";
import { AIVisibilityAnalyticsEngine } from "../analytics/engine";
import { AIVisibilityTrendEngine } from "../analytics/trend-engine";
import { SqliteAnalyticsRepository } from "../analytics/persistence/sqlite-analytics-repo";
import { AIObservation, ObservationRunSummary } from "../observation/types";
import { ProjectKnowledgeProfile, BrandIdentity } from "../knowledge-profile/types";
import { PromptUniverseReport } from "../prompts/types";
import { AI_VISIBILITY_METRIC_VERSION } from "../analytics/types";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { initializeDatabase } from "../../crawler/persistence/db";

describe("Phase 28E: AI Visibility Analytics, Competitive SoV & Trend Intelligence", () => {
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
      {
        id: "comp_2",
        name: "Deloitte",
        domain: "deloitte.com",
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

  it("1. Mention Rate Denominator Integrity exposes exact numerator, denominator, and exclusions", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList: AIObservation[] = [
      createMockObservation({ brandMentioned: true }),
      createMockObservation({ brandMentioned: false }),
      createMockObservation({ status: "FAILED", failureReason: "Network timeout" }),
      createMockObservation({ status: "RATE_LIMITED" }),
    ];

    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    expect(snapshot.coverage.totalPlannedObservations).toBe(4);
    expect(snapshot.coverage.eligibleSuccessObservations).toBe(2);
    expect(snapshot.coverage.failedObservations).toBe(1);
    expect(snapshot.coverage.rateLimitedObservations).toBe(1);

    const overall = snapshot.metrics.mentionRates.overall;
    expect(overall.numerator).toBe(1);
    expect(overall.denominator).toBe(2);
    expect(overall.rate).toBe(0.5);
    expect(overall.excludedCount).toBe(2);
  });

  it("2. Unbranded Discovery strictly excludes branded and semi-branded queries from denominator", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList: AIObservation[] = [
      createMockObservation({ brandedness: "UNBRANDED", brandMentioned: true }),
      createMockObservation({ brandedness: "UNBRANDED", brandMentioned: false }),
      createMockObservation({ brandedness: "BRANDED", brandMentioned: true }),
      createMockObservation({ brandedness: "SEMI_BRANDED", brandMentioned: true }),
    ];

    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    const unbranded = snapshot.metrics.mentionRates.unbrandedDiscovery;
    expect(unbranded.numerator).toBe(1);
    expect(unbranded.denominator).toBe(2);
    expect(unbranded.rate).toBe(0.5);

    const branded = snapshot.metrics.mentionRates.branded;
    expect(branded.numerator).toBe(1);
    expect(branded.denominator).toBe(1);
    expect(branded.rate).toBe(1.0);
  });

  it("3. Recommendation Appearance differentiates RECOMMENDED from NEUTRAL, COMPARISON, and NEGATIVE", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList: AIObservation[] = [
      createMockObservation({
        brandMentioned: true,
        brandMentions: [{ canonicalEntity: "BOT Consulting", matchedText: "BOT Consulting", occurrenceIndex: 1, characterOffset: 0, paragraphIndex: 0, contextSnippet: "Highly recommended for ServiceNow", mentionType: "RECOMMENDED", confidence: 1.0 }],
      }),
      createMockObservation({
        brandMentioned: true,
        brandMentions: [{ canonicalEntity: "BOT Consulting", matchedText: "BOT Consulting", occurrenceIndex: 1, characterOffset: 0, paragraphIndex: 0, contextSnippet: "Compared to Deloitte", mentionType: "COMPARISON", confidence: 1.0 }],
      }),
      createMockObservation({
        brandMentioned: true,
        brandMentions: [{ canonicalEntity: "BOT Consulting", matchedText: "BOT Consulting", occurrenceIndex: 1, characterOffset: 0, paragraphIndex: 0, contextSnippet: "Some drawbacks noted", mentionType: "NEGATIVE", confidence: 1.0 }],
      }),
    ];

    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    expect(snapshot.metrics.recommendations.recommendedCount).toBe(1);
    expect(snapshot.metrics.recommendations.comparisonCount).toBe(1);
    expect(snapshot.metrics.recommendations.negativeCount).toBe(1);
    expect(snapshot.metrics.recommendations.recommendationRate.numerator).toBe(1);
    expect(snapshot.metrics.recommendations.recommendationRate.denominator).toBe(3);
  });

  it("4. Capability-Aware Citation Rates and MENTIONED_NOT_CITED tracking", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList: AIObservation[] = [
      createMockObservation({ brandMentioned: true, ownDomainCited: true, groundingState: "GROUNDING_ACTIVE" }),
      createMockObservation({ brandMentioned: true, ownDomainCited: false, groundingState: "GROUNDING_ACTIVE" }), // Mentioned not cited
      createMockObservation({ brandMentioned: false, ownDomainCited: true, groundingState: "GROUNDING_ACTIVE" }), // Cited not mentioned
      createMockObservation({ brandMentioned: false, ownDomainCited: false, groundingState: "GROUNDING_ACTIVE" }),
    ];

    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    expect(snapshot.metrics.citations.bothMentionedAndCitedCount).toBe(1);
    expect(snapshot.metrics.citations.mentionedNotCitedCount).toBe(1);
    expect(snapshot.metrics.citations.citedNotMentionedCount).toBe(1);
    expect(snapshot.metrics.citations.ownDomainCitationRate.numerator).toBe(2);
    expect(snapshot.metrics.citations.ownDomainCitationRate.denominator).toBe(4);
  });

  it("5. Competitor Response Penetration and Observed AI Share of Voice", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList: AIObservation[] = [
      createMockObservation({
        brandMentioned: true,
        competitorsMentioned: [
          { competitorName: "Accenture", canonicalEntity: "Accenture", matchedText: "Accenture", occurrenceIndex: 1, characterOffset: 0, contextSnippet: "Accenture", recommendationOrder: 1, isKnownCompetitor: true, confidence: 1.0 },
          { competitorName: "Deloitte", canonicalEntity: "Deloitte", matchedText: "Deloitte", occurrenceIndex: 2, characterOffset: 10, contextSnippet: "Deloitte", recommendationOrder: 2, isKnownCompetitor: true, confidence: 1.0 },
        ],
      }),
      createMockObservation({
        brandMentioned: false,
        competitorsMentioned: [
          { competitorName: "Accenture", canonicalEntity: "Accenture", matchedText: "Accenture", occurrenceIndex: 1, characterOffset: 0, contextSnippet: "Accenture", recommendationOrder: 1, isKnownCompetitor: true, confidence: 1.0 },
        ],
      }),
    ];

    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    const accenture = snapshot.competitors.leaderboard.find((c) => c.competitorName === "Accenture");
    expect(accenture).toBeDefined();
    expect(accenture?.appearancesCount).toBe(2);
    expect(accenture?.responsePenetration.rate).toBe(1.0); // Appeared in 2/2 responses (100%)
    expect(accenture?.mentionShareOfVoice.numerator).toBe(2);
    expect(accenture?.mentionShareOfVoice.denominator).toBe(4); // Accenture (2) + Deloitte (1) + BOT (1) = 4
    expect(accenture?.mentionShareOfVoice.rate).toBe(0.5);
  });

  it("6. Canonical Entity Normalization merges aliases (e.g. 'IBM Consulting' -> 'IBM')", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList: AIObservation[] = [
      createMockObservation({
        competitorsMentioned: [
          { competitorName: "IBM Consulting", canonicalEntity: "IBM Consulting", matchedText: "IBM Consulting", occurrenceIndex: 1, characterOffset: 0, contextSnippet: "IBM", isKnownCompetitor: false, confidence: 1.0 },
        ],
      }),
      createMockObservation({
        competitorsMentioned: [
          { competitorName: "IBM", canonicalEntity: "IBM", matchedText: "IBM", occurrenceIndex: 1, characterOffset: 0, contextSnippet: "IBM", isKnownCompetitor: false, confidence: 1.0 },
        ],
      }),
    ];

    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);
    const ibm = snapshot.competitors.leaderboard.find((c) => c.competitorName === "IBM");
    expect(ibm?.appearancesCount).toBe(2);
  });

  it("7. Trend Comparison calculates percentage-point deltas over Like-for-Like Core", () => {
    const trendEngine = new AIVisibilityTrendEngine();

    const baseRun: ObservationRunSummary = {
      runId: "run_base",
      projectId: "proj_1",
      status: "COMPLETED",
      startedAt: "2026-08-20T00:00:00Z",
      completedAt: "2026-08-20T00:05:00Z",
      config: { projectId: "proj_1", promptTier: "TIER_1", providers: ["OPENAI"], samplingMode: "QUICK", country: "US", language: "en" },
      knowledgeProfileVersion: "v28c-1.0",
      promptUniverseVersion: "v28c-1.0",
      totalPlannedObservations: 2,
      completedObservations: 2,
      successfulObservations: 2,
      failedObservations: 0,
      overallBrandMentionRate: 0.5,
      unbrandedBrandMentionRate: 0.5,
      brandedBrandMentionRate: 1.0,
      ownDomainCitationRate: 0.0,
      activeProviders: ["OPENAI"],
      promptSummaries: [],
    };

    const currRun: ObservationRunSummary = {
      ...baseRun,
      runId: "run_curr",
      startedAt: "2026-08-24T00:00:00Z",
    };

    const baseObs = [
      createMockObservation({ promptId: "prm_1", brandedness: "UNBRANDED", brandMentioned: false }),
      createMockObservation({ promptId: "prm_2", brandedness: "UNBRANDED", brandMentioned: true }),
    ]; // 1/2 = 50%

    const currObs = [
      createMockObservation({ promptId: "prm_1", brandedness: "UNBRANDED", brandMentioned: true }),
      createMockObservation({ promptId: "prm_2", brandedness: "UNBRANDED", brandMentioned: true }),
    ]; // 2/2 = 100%

    const comparison = trendEngine.compareRuns(baseRun, baseObs, currRun, currObs);

    expect(comparison.comparabilityStatus).toBe("COMPARABLE");
    expect(comparison.matchingPromptsCount).toBe(2);
    expect(comparison.unbrandedDiscoveryDeltaPp).toBe(50.0); // +50 percentage points
  });

  it("8. Comparability Guard flags NOT_COMPARABLE when prompt universe version or providers change", () => {
    const trendEngine = new AIVisibilityTrendEngine();

    const baseRun: ObservationRunSummary = {
      runId: "run_base",
      projectId: "proj_1",
      status: "COMPLETED",
      startedAt: "2026-08-20T00:00:00Z",
      config: { projectId: "proj_1", promptTier: "TIER_1", providers: ["OPENAI"], samplingMode: "QUICK", country: "US", language: "en" },
      knowledgeProfileVersion: "v28c-1.0",
      promptUniverseVersion: "v28c-1.0",
      totalPlannedObservations: 2,
      completedObservations: 2,
      successfulObservations: 2,
      failedObservations: 0,
      overallBrandMentionRate: 0.5,
      unbrandedBrandMentionRate: 0.5,
      brandedBrandMentionRate: 1.0,
      ownDomainCitationRate: 0.0,
      activeProviders: ["OPENAI"],
      promptSummaries: [],
    };

    const changedRun: ObservationRunSummary = {
      ...baseRun,
      runId: "run_changed",
      promptUniverseVersion: "v28c-2.0",
      config: { ...baseRun.config, country: "UK", language: "en-GB" },
    };

    const res = trendEngine.evaluateComparability(baseRun, changedRun);
    expect(res.status).toBe("NOT_COMPARABLE");
    expect(res.notes.length).toBeGreaterThanOrEqual(2);
  });

  it("9. Immutable Analytics Snapshots persist and reload cleanly in SQLite", () => {
    const engine = new AIVisibilityAnalyticsEngine();
    const obsList = [createMockObservation({ brandMentioned: true })];
    const snapshot = engine.computeAnalytics("proj_1", "run_1", obsList, mockProfile, mockPromptUniverse);

    const repo = new SqliteAnalyticsRepository(initializeDatabase(":memory:"));
    repo.saveAnalyticsSnapshot(snapshot);

    const loaded = repo.getAnalyticsSnapshot(snapshot.snapshotId);
    expect(loaded).toBeDefined();
    expect(loaded?.snapshotId).toBe(snapshot.snapshotId);
    expect(loaded?.metricVersion).toBe(AI_VISIBILITY_METRIC_VERSION);
    expect(loaded?.certificationStatus).toBe("PENDING");
  });

  it("10. ABSOLUTE SEO ISOLATION: Preserves 108 Production Rules & 118 Canonical Dimensions", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullyCovered = CANONICAL_118_DIMENSIONS.filter((d) => d.classification === "FULLY_COVERED");
    expect(fullyCovered.length).toBe(113);
  });
});
