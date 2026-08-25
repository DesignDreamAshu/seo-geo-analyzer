/**
 * Phase 21: Alternative Non-Content Explanation Gating Tests.
 * Proves that:
 * TRAFFIC_DECLINE ≠ CONTENT_DECAY
 * Technical defects, indexation loss, migration transitions, demand decline, and seasonality are gated first.
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

describe("1. Non-Content Alternative Decline Gating", () => {
  const basePerf = {
    periodRange: "Previous 90d",
    monthlyImpressions: 10000,
    monthlyClicks: 800,
    averageCtr: 8.0,
    rankingQueryClustersCount: 15,
    topRankingClusterIds: ["c1", "c2"],
  };

  const regressedPerf = {
    periodRange: "Recent 90d",
    monthlyImpressions: 2000,
    monthlyClicks: 100,
    averageCtr: 5.0,
    rankingQueryClustersCount: 4,
    topRankingClusterIds: ["c1"],
  };

  it("1.1. Deterministic technical defect gates decline as TECHNICAL_DECLINE, not content decay", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/services/cmdb",
      pageType: "service_page",
      recentPerformance: regressedPerf,
      baselinePerformance: basePerf,
      isTechnicalDefectPresent: true,
      technicalDefectReason: "accidental meta robots noindex tag present in HTML head",
    });

    expect(res.lifecycleState).toBe("TECHNICAL_DECLINE");
    expect(res.primaryAction).toBe("RESTORE_TECHNICAL_VISIBILITY");
  });

  it("1.2. Google indexation exclusion gates decline as INDEXATION_DRIVEN_DECLINE", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/services/pricing",
      pageType: "service_page",
      recentPerformance: regressedPerf,
      baselinePerformance: basePerf,
      isGoogleIndexBlocked: true,
      googleIndexState: "Crawled - currently not indexed",
    });

    expect(res.lifecycleState).toBe("INDEXATION_DRIVEN_DECLINE");
    expect(res.primaryAction).toBe("REPAIR_INDEXATION");
  });

  it("1.3. Year-over-Year cyclical interest drop is gated as SEASONAL_DECLINE", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/guides/tax-prep",
      pageType: "blog",
      recentPerformance: regressedPerf,
      baselinePerformance: basePerf,
      isSeasonallyCyclical: true,
    });

    expect(res.lifecycleState).toBe("SEASONAL_DECLINE");
    expect(res.primaryAction).toBe("MONITOR");
  });

  it("1.4. Site-wide search demand collapse is gated as DEMAND_DECLINE", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/blog/crypto-trend",
      pageType: "blog",
      recentPerformance: regressedPerf,
      baselinePerformance: basePerf,
      isClusterDemandDeclining: true,
      clusterDemandDropPercent: 60,
    });

    expect(res.lifecycleState).toBe("DEMAND_DECLINE");
    expect(res.primaryAction).toBe("MONITOR");
  });
});
