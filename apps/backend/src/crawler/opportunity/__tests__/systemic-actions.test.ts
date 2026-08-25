/**
 * Test Suite for Systemic Action Consolidation & 80/20 Leverage.
 */

import { generateOpportunityPlan } from "../engine";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("Systemic Action Consolidation & 80/20 Leverage", () => {
  it("1. 57 Blog Regressions Consolidated: produces 1 systemic template action item with ~1 real edit", () => {
    const mockMonitoringResult: any = {
      currentSnapshotId: "snap_02",
      baselineSnapshotId: "snap_01",
      systemicRegressions: [
        {
          groupId: "SYS_SOCIAL_INCOMPLETE_OG_blog",
          ruleCode: "SOCIAL_INCOMPLETE_OG",
          monitoringSignalCode: "OG_IMAGE_BECAME_MISSING",
          title: "Systemic Open Graph Regression: OG Image Missing across 57 pages",
          rootCauseHypothesis: "Likely shared Blog CMS Collection Template regression",
          rootCauseConfidence: "HIGH_CONFIDENCE",
          groupingEvidence: { affectedUrlsCount: 57, routePattern: "/blog/*", sharedStructuralSignal: "Shared CMS collection" },
          templateOrRoutePattern: "/blog/*",
          affectedUrls: Array.from({ length: 57 }, (_, i) => `https://www.botconsulting.io/blog/post-${i}`),
          affectedUrlsCount: 57,
          estimatedRealEdits: 1,
          regressionPriority: "HIGH_REGRESSION",
          firstObservedSnapshotId: "snap_02",
          remediationGuidance: "Bind OG image field in Webflow Blog CMS Collection Template",
          whereToFix: "Webflow Designer → Blog CMS Template",
          verificationInstructions: "Recrawl representative URLs",
        },
      ],
      findingChanges: [],
    };

    const mockGscResult: any = {
      opportunities: [
        {
          url: "https://www.botconsulting.io/blog/post-1",
          query: "it consulting trends",
          opportunityType: "HIGH_IMPRESSION_LOW_CTR",
          metrics: { impressions: 38000, clicks: 900, ctr: 2.37, position: 5.1 },
          recommendedAction: "Optimize meta description",
        },
      ],
    };

    const plan = generateOpportunityPlan({
      projectId: "bot-consulting",
      monitoringResult: mockMonitoringResult,
      gscResult: mockGscResult,
      platform: "webflow",
    });

    expect(plan.summary.systemicFixesCount).toBe(1);
    expect(plan.systemicFixes[0].estimatedRealEdits).toBe(1);
    expect(plan.systemicFixes[0].affectedUrlsCount).toBe(57);
    expect(plan.eightyTwentySummary.topActionCount).toBeGreaterThanOrEqual(1);
    expect(plan.eightyTwentySummary.gscImpressionsCovered).toBeGreaterThanOrEqual(38000);
  });
});
