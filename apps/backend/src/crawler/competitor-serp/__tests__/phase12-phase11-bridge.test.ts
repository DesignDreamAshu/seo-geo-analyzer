/**
 * Phase 12 & Phase 11 Integration Bridge Tests.
 * Proves Phase 12 decision enrichment, deduplication with existing Phase 11 actions,
 * and technical blocker dependencies.
 */

import { enrichPhase12WithSerpIntelligence } from "../phase12-integrator";
import { bridgeSerpIntelligenceToActions } from "../action-bridge";
import { createSerpSnapshot } from "../serp-snapshot";
import { ContentCoverageAssessment } from "../../content-demand/types";
import { ResultTypeDistribution, SerpIntentDistribution } from "../types";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      return (res as any)
        .then(() => {
          console.log(`  ✓ ${testName}`);
        })
        .catch((err: any) => {
          console.error(`  ❌ FAIL: ${testName}`);
          console.error(`     ${err.message}`);
          throw err;
        });
    }
    console.log(`  ✓ ${testName}`);
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
  };
}

describe("7. Phase 12 & Phase 11 Integration Bridge", () => {
  const baseCoverage: ContentCoverageAssessment = {
    clusterId: "CLUST_cmdb",
    representativeLabel: "ServiceNow CMDB Assessment",
    observedImpressions: 4000,
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
    landingPageFit: "STRONG_FIT",
    landingPageFitConfidence: "HIGH_CONFIDENCE",
    queryPageStability: "STABLE",
    coverageState: "PARTIALLY_SERVED",
    decision: "IMPROVE_EXISTING_PAGE",
    decisionRationale: "Existing page requires topic expansion",
    isBusinessRelevanceValidated: true,
    confidence: "HIGH_CONFIDENCE",
    existingCandidateUrls: ["https://www.botconsulting.io/services/cmdb"],
  };

  const snap = createSerpSnapshot({
    snapshotId: "snap-bridge",
    projectId: "bot-consulting",
    provider: "MOCK_PROVIDER",
    providerVersion: "v1",
    request: { query: "servicenow cmdb assessment" },
    normalizedQuery: "servicenow cmdb assessment",
    organicResults: [],
  });

  it("7.1. Enriches Phase 12 coverage with verified SERP topic gaps", () => {
    const resultDist: ResultTypeDistribution = {
      typeCounts: { HOMEPAGE: 0, SERVICE_PAGE: 8, PRODUCT_PAGE: 0, CATEGORY_PAGE: 0, ARTICLE_GUIDE: 2, COMPARISON_PAGE: 0, CASE_STUDY: 0, DOCUMENTATION: 0, FORUM_COMMUNITY: 0, VIDEO: 0, LOCAL_LISTING: 0, UNKNOWN: 0 },
      dominantType: "SERVICE_PAGE",
      sampleSize: 10,
    };
    const intentDist: SerpIntentDistribution = {
      dominantIntentState: "COMMERCIAL_DOMINANT",
      dominantIntent: "COMMERCIAL_INVESTIGATION",
      intentBreakdown: { COMMERCIAL_INVESTIGATION: 8, INFORMATIONAL: 2 },
      sampleSize: 10,
      dominanceRatio: 0.8,
      confidence: "HIGH_CONFIDENCE",
    };

    const enriched = enrichPhase12WithSerpIntelligence(
      baseCoverage,
      snap,
      resultDist,
      intentDist,
      ["csdm-alignment", "audit-checklist"]
    );

    expect(enriched.assessment.missingTopicAreas?.includes("csdm-alignment")).toBe(true);
    expect(enriched.assessment.missingTopicAreas?.includes("audit-checklist")).toBe(true);
    expect(enriched.serpAlignmentConfidence).toBe("HIGH_CONFIDENCE");
  });

  it("7.2. Bridges SERP opportunities to canonical Phase 11 actions and respects technical blockers", () => {
    const topicOpps = [
      {
        clusterId: "CLUST_cmdb",
        representativeLabel: "ServiceNow CMDB Assessment",
        targetUrl: "https://www.botconsulting.io/services/cmdb",
        gaps: ["csdm-alignment"],
        technicalBlockers: ["INDEXABILITY_NOINDEX"],
      },
    ];

    const actions = bridgeSerpIntelligenceToActions("bot-consulting", [], topicOpps, []);
    expect(actions.length).toBe(1);
    expect(actions[0].actionId.startsWith("ACT_")).toBe(true);
    expect(actions[0].blockedByActionIds.includes("INDEXABILITY_NOINDEX")).toBe(true);
  });
});
