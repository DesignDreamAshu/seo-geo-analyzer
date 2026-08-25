/**
 * Phase 21: Consolidation & Multi-Factor Primary URL Selection Tests.
 * Proves intent differentiation vs consolidation and multi-factor equity-based primary URL selection.
 */

import { evaluateConsolidationAndPrimaryUrl } from "../consolidation-engine";

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

describe("3. Consolidation & Primary URL Selection", () => {
  it("3.1. Differentiates distinct intents rather than forcing an inappropriate merge", () => {
    const res = evaluateConsolidationAndPrimaryUrl({
      competingUrls: [
        {
          url: "https://example.com/learn/cmdb-tutorial",
          historicalPerformance: { periodRange: "90d", monthlyImpressions: 5000, monthlyClicks: 200, averageCtr: 4.0, rankingQueryClustersCount: 5, topRankingClusterIds: ["c1"] },
          referringDomainsCount: 4,
          internalInlinksCount: 12,
          isIndexIndexed: true,
          isCanonicalSelfReferencing: true,
        },
        {
          url: "https://example.com/software/enterprise-cmdb",
          historicalPerformance: { periodRange: "90d", monthlyImpressions: 4000, monthlyClicks: 150, averageCtr: 3.75, rankingQueryClustersCount: 4, topRankingClusterIds: ["c1"] },
          referringDomainsCount: 15,
          internalInlinksCount: 30,
          isIndexIndexed: true,
          isCanonicalSelfReferencing: true,
        },
      ],
      overlappingClusterLabels: ["cmdb software guide"],
      isIntentGenuinelyDifferent: true,
    });

    expect(res.strategy).toBe("DIFFERENTIATE_INTENT");
  });

  it("3.2. Selects primary URL using multi-factor equity (backlinks, inlinks, clicks) over shorter URL length", () => {
    const res = evaluateConsolidationAndPrimaryUrl({
      competingUrls: [
        {
          url: "https://example.com/cmdb", // Shorter URL, but weak equity
          historicalPerformance: { periodRange: "90d", monthlyImpressions: 500, monthlyClicks: 10, averageCtr: 2.0, rankingQueryClustersCount: 1, topRankingClusterIds: ["c1"] },
          referringDomainsCount: 1,
          internalInlinksCount: 2,
          isIndexIndexed: true,
          isCanonicalSelfReferencing: true,
        },
        {
          url: "https://example.com/solutions/it-asset-management/cmdb-discovery", // Longer URL, but massive equity
          historicalPerformance: { periodRange: "90d", monthlyImpressions: 25000, monthlyClicks: 1800, averageCtr: 7.2, rankingQueryClustersCount: 28, topRankingClusterIds: ["c1", "c2"] },
          referringDomainsCount: 45,
          internalInlinksCount: 88,
          isIndexIndexed: true,
          isCanonicalSelfReferencing: true,
        },
      ],
      overlappingClusterLabels: ["cmdb discovery", "automated cmdb solution"],
      isIntentGenuinelyDifferent: false,
    });

    expect(res.strategy).toBe("CONSOLIDATE_AND_MERGE");
    expect(res.recommendedPrimaryUrl).toBe("https://example.com/solutions/it-asset-management/cmdb-discovery");
  });
});
