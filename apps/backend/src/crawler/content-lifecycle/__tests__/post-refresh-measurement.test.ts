/**
 * Phase 21: Post-Refresh Measurement & Attribution Tests.
 * Proves verification of post-refresh realization states and observational attribution safety.
 */

import { evaluateContentLifecycle } from "../lifecycle-evaluator";

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

describe("5. Post-Refresh Measurement & Attribution Safety", () => {
  it("5.1. Refresh brief includes concrete post-implementation verification steps", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/blog/security-audit",
      pageType: "blog",
      recentPerformance: { periodRange: "90d", monthlyImpressions: 2000, monthlyClicks: 50, averageCtr: 2.5, rankingQueryClustersCount: 3, topRankingClusterIds: ["c1"] },
      baselinePerformance: { periodRange: "Prev 90d", monthlyImpressions: 10000, monthlyClicks: 500, averageCtr: 5.0, rankingQueryClustersCount: 10, topRankingClusterIds: ["c1", "c2"] },
      outdatedPricingDetected: true,
    });

    expect(res.primaryAction).toBe("REFRESH");
    expect(res.refreshBrief?.verificationPlan.length).toBe(3);
    expect(res.refreshBrief?.verificationPlan[0].includes("Verify updated text rendered")).toBe(true);
  });
});
