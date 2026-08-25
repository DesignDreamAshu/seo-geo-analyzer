/**
 * Test Suite for Cannibalization Intelligence & Safeguards.
 */

import { evaluateCannibalization } from "../cannibalization";
import { QueryCluster } from "../types";

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

describe("Cannibalization Intelligence & Safeguards", () => {
  const baseCluster: QueryCluster = {
    clusterId: "CLUST_servicenow_implementation",
    semanticFingerprint: "servicenow+implementation+partner",
    representativeLabel: "ServiceNow Implementation Partner",
    rawQueries: ["servicenow implementation partner"],
    totalObservedImpressions: 5400,
    totalClicks: 180,
    averageCtr: 3.33,
    averagePosition: 4.8,
    landingPages: [
      "https://www.botconsulting.io/services/servicenow",
      "https://www.botconsulting.io/services/servicenow-implementation",
    ],
    dominantLandingPage: "https://www.botconsulting.io/services/servicenow-implementation",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["implementation", "partner"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("1. True Cannibalization: similar URLs switching dominance classified as LIKELY_CANNIBALIZATION", () => {
    const res = evaluateCannibalization(baseCluster, "https://www.botconsulting.io/services/servicenow");

    expect(res?.state).toBe("LIKELY_CANNIBALIZATION");
    expect(res?.remediationRecommendation).toBe("REVIEW_INTENT_DIFFERENTIATION");
    expect(res?.protectAgainstMergingNote?.includes("Do NOT automatically redirect")).toBe(true);
  });

  it("2. Brand Safeguard: multiple brand URLs ranking for brand query classified as HEALTHY_MULTI_PAGE_VISIBILITY", () => {
    const brandCluster: QueryCluster = {
      ...baseCluster,
      brandState: "BRANDED",
      representativeLabel: "BOT Consulting",
      landingPages: [
        "https://www.botconsulting.io/",
        "https://www.botconsulting.io/about",
      ],
      dominantLandingPage: "https://www.botconsulting.io/",
    };

    const res = evaluateCannibalization(brandCluster);

    expect(res?.state).toBe("HEALTHY_MULTI_PAGE_VISIBILITY");
    expect(res?.protectAgainstMergingNote?.includes("Do not merge or redirect")).toBe(true);
  });

  it("3. Service + Case Study Synergy: classified as QUERY_INTENT_SPLIT (not harmful cannibalization)", () => {
    const serviceCaseCluster: QueryCluster = {
      ...baseCluster,
      landingPages: [
        "https://www.botconsulting.io/services/cmdb",
        "https://www.botconsulting.io/case-studies/fintech-cmdb",
      ],
      dominantLandingPage: "https://www.botconsulting.io/services/cmdb",
    };

    const res = evaluateCannibalization(serviceCaseCluster);

    expect(res?.state).toBe("QUERY_INTENT_SPLIT");
    expect(res?.rationale.includes("complementary commercial vs social-proof")).toBe(true);
  });

  it("4. Low-Volume Safeguard: low impressions sample classified as INSUFFICIENT_DATA", () => {
    const lowVolCluster: QueryCluster = {
      ...baseCluster,
      totalObservedImpressions: 18,
    };

    const res = evaluateCannibalization(lowVolCluster);

    expect(res?.state).toBe("INSUFFICIENT_DATA");
  });
});
