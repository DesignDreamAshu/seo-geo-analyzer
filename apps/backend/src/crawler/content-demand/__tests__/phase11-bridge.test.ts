/**
 * Test Suite for Phase 11 Action Plan Integration Bridge.
 */

import { bridgeContentDemandToActions } from "../action-bridge";
import { ContentCoverageAssessment, CannibalizationAssessment } from "../types";

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
  };
}

describe("Phase 11 Action Plan Integration Bridge", () => {
  it("1. Emits canonical Phase 11 action items from coverage and cannibalization findings", () => {
    const mockCoverage: ContentCoverageAssessment[] = [
      {
        clusterId: "CLUST_servicenow_cmdb",
        representativeLabel: "ServiceNow CMDB Assessment",
        observedImpressions: 8400,
        primaryIntent: "COMMERCIAL_INVESTIGATION",
        dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
        landingPageFit: "PARTIAL_FIT",
        landingPageFitConfidence: "HIGH_CONFIDENCE",
        queryPageStability: "STABLE",
        coverageState: "PARTIALLY_SERVED",
        decision: "IMPROVE_EXISTING_PAGE",
        decisionRationale: "Expand topic depth on existing page",
        isBusinessRelevanceValidated: true,
        missingTopicAreas: ["assessment", "audit"],
        existingCandidateUrls: ["https://www.botconsulting.io/services/cmdb"],
        confidence: "HIGH_CONFIDENCE",
      },
    ];

    const mockCannibalization: CannibalizationAssessment[] = [
      {
        clusterId: "CLUST_servicenow_implementation",
        representativeLabel: "ServiceNow Implementation",
        competingUrls: [
          "https://www.botconsulting.io/services/servicenow",
          "https://www.botconsulting.io/services/servicenow-implementation",
        ],
        state: "LIKELY_CANNIBALIZATION",
        intentSimilarity: "HIGH",
        contentOverlap: "HIGH",
        hasStableDominantUrl: false,
        confidence: "HIGH_CONFIDENCE",
        remediationRecommendation: "REVIEW_INTENT_DIFFERENTIATION",
        remediationDetails: "Review page differentiation",
        rationale: "Landing page switching observed",
      },
    ];

    const actions = bridgeContentDemandToActions("bot-consulting", mockCoverage, mockCannibalization);

    expect(actions.length).toBe(2);
    expect(actions[0].type).toBe("CONTENT_REFRESH_OPPORTUNITY");
    expect(actions[0].primaryOwner).toBe("Content");
    expect(actions[1].type).toBe("CONTENT_STRUCTURE_OPPORTUNITY");
    expect(actions[1].primaryOwner).toBe("SEO");
  });
});
