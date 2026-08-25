/**
 * Phase 21: Content Staleness & Freshness Tests.
 * Proves that:
 * OLD_CONTENT ≠ STALE_CONTENT
 * Evergreen content remains healthy, while concrete factual errors or fake date updates are flagged.
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

describe("2. Content Staleness & Freshness Safeguards", () => {
  const stablePerf = {
    periodRange: "Recent 90d",
    monthlyImpressions: 8000,
    monthlyClicks: 650,
    averageCtr: 8.1,
    rankingQueryClustersCount: 12,
    topRankingClusterIds: ["c1", "c2"],
  };

  it("2.1. Evergreen content published 3 years ago without factual errors remains HEALTHY", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/guides/what-is-dns",
      pageType: "evergreen_guide",
      publishedDate: "2023-01-15T00:00:00Z",
      recentPerformance: stablePerf,
      baselinePerformance: stablePerf,
    });

    expect(res.lifecycleState).toBe("STABLE");
    expect(res.primaryAction).toBe("KEEP_AS_IS");
  });



  it("2.3. Superficial date change without substantive update is flagged as fake freshness", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/blog/best-tools",
      pageType: "blog",
      recentPerformance: stablePerf,
      baselinePerformance: stablePerf,
      isFakeFreshnessAttemptDetected: true,
    });

    expect(res.uncertaintyReasons.some((u) => u.includes("SUPERFICIAL_DATE_CHANGE_DETECTED"))).toBe(true);
  });
});
