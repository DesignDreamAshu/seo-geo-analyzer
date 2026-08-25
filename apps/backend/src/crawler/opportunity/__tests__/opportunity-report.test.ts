/**
 * Test Suite for SEO Opportunity & Action Plan Serialization.
 */

import { generateOpportunityPlan } from "../engine";
import { serializeOpportunityPlanMarkdown } from "../report-serializer";

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

describe("SEO Opportunity & Action Plan Serialization", () => {
  it("1. Generates structured Markdown Opportunity Plan with DO NOW and 80/20 leverage summary", () => {
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

    const plan = generateOpportunityPlan({
      projectId: "bot-consulting",
      monitoringResult: mockMonitoringResult,
      platform: "webflow",
    });

    const md = serializeOpportunityPlanMarkdown(plan);

    expect(md.includes("# SEO OPPORTUNITY & ACTION PLAN")).toBe(true);
    expect(md.includes("DO NOW (Immediate Priority)")).toBe(true);
    expect(md.includes("High-Leverage Systemic Template Fixes")).toBe(true);
    expect(md.includes("80/20 View")).toBe(true);
    expect(md.includes("Team Work Queues")).toBe(true);
  });
});
