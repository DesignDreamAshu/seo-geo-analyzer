/**
 * Test Suite for Observed Demand Trend Engine.
 */

import { evaluateDemandTrend } from "../trend-engine";
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

describe("Observed Demand Trend Engine", () => {
  const baseCluster: QueryCluster = {
    clusterId: "CLUST_servicenow_csm",
    semanticFingerprint: "servicenow+csm+integration",
    representativeLabel: "ServiceNow CSM Integration",
    rawQueries: ["servicenow csm integration"],
    totalObservedImpressions: 120,
    totalClicks: 8,
    averageCtr: 6.67,
    averagePosition: 5.1,
    landingPages: ["https://www.botconsulting.io/services/csm"],
    dominantLandingPage: "https://www.botconsulting.io/services/csm",
    primaryIntent: "COMMERCIAL_INVESTIGATION",
    allIntents: ["COMMERCIAL_INVESTIGATION"],
    intentConfidence: "HIGH_CONFIDENCE",
    clusteringConfidence: "HIGH_CONFIDENCE",
    clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
    lifecycleState: "CLUSTER_UNCHANGED",
    brandState: "NON_BRANDED",
    modifiers: ["integration"],
    isQuestionDemand: false,
    isComparisonDemand: false,
    isCommercialDemand: true,
  };

  it("1. Emerging Demand: cluster with minimal prior impressions and >=50 current impressions classified as EMERGING_DEMAND", () => {
    const res = evaluateDemandTrend(baseCluster, 2); // Previously 2 impressions, now 120
    expect(res.trendState).toBe("EMERGING_DEMAND");
    expect(res.rationale.includes("emerging observed GSC visibility")).toBe(true);
  });

  it("2. Growing Demand: statistically meaningful increase classified as GROWING_DEMAND", () => {
    const growingCluster: QueryCluster = { ...baseCluster, totalObservedImpressions: 300 };
    const res = evaluateDemandTrend(growingCluster, 150); // +100%
    expect(res.trendState).toBe("GROWING_DEMAND");
  });

  it("3. Low-Volume Noise: small impression fluctuations (<30 imps) classified as INSUFFICIENT_DATA", () => {
    const noiseCluster: QueryCluster = { ...baseCluster, totalObservedImpressions: 12 };
    const res = evaluateDemandTrend(noiseCluster, 4);
    expect(res.trendState).toBe("INSUFFICIENT_DATA");
    expect(res.isLowVolumeSample).toBe(true);
  });
});
