/**
 * Phase 21: Retirement Safety & Preservation Tests.
 * Proves that:
 * ZERO_TRAFFIC ≠ USELESS_PAGE
 * Compliance pages suppress retirement (RETIREMENT_NOT_APPLICABLE), and zero-traffic candidates mandate manual approval.
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

describe("4. Retirement Safety & Preservation", () => {
  it("4.1. Compliance/Legal page with zero traffic is protected as RETIREMENT_NOT_APPLICABLE", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/legal/privacy-policy",
      pageType: "service_page",
      recentPerformance: {
        periodRange: "Recent 90d",
        monthlyImpressions: 10,
        monthlyClicks: 0,
        averageCtr: 0,
        rankingQueryClustersCount: 0,
        topRankingClusterIds: [],
        referringDomainsCount: 12,
      },
      hasLegalOrComplianceRole: true,
      businessOrUserPurpose: "Mandatory GDPR Privacy & Data Processing Policy",
    });

    expect(res.lifecycleState).toBe("RETIREMENT_NOT_APPLICABLE");
    expect(res.primaryAction).toBe("KEEP_AS_IS");
    expect(res.isComplianceProtected).toBe(true);
  });

  it("4.2. Discontinued product page enters RETIREMENT_REVIEW with mandatory manual approval", () => {
    const res = evaluateContentLifecycle({
      projectId: "p1",
      url: "https://example.com/products/legacy-v1-device",
      pageType: "product",
      recentPerformance: {
        periodRange: "Recent 90d",
        monthlyImpressions: 5,
        monthlyClicks: 0,
        averageCtr: 0,
        rankingQueryClustersCount: 0,
        topRankingClusterIds: [],
        referringDomainsCount: 8,
      },
      businessOrUserPurpose: "Archived hardware product line superseded by v2",
      recommendedReplacementUrl: "https://example.com/products/v2-device",
      isDestinationTopicMatched: true,
    });

    expect(res.lifecycleState).toBe("RETIREMENT_REVIEW");
    expect(res.primaryAction).toBe("MANUAL_REVIEW");
    expect(res.retirementBrief?.manualApprovalRequired).toBe(true);
    expect(res.retirementBrief?.redirectRelevanceAssessment).toBe("RELEVANT_DESTINATION_CONFIRMED");
  });
});
