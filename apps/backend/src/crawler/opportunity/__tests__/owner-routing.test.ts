/**
 * Test Suite for Owner Routing & Team Work Queues.
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

describe("Owner Routing & Team Work Queues", () => {
  it("1. Routes specialist tasks to Developer, SEO, and CMS Editor queues cleanly", () => {
    const mockMonitoringResult: any = {
      currentSnapshotId: "snap_02",
      baselineSnapshotId: "snap_01",
      systemicRegressions: [],
      findingChanges: [
        {
          ruleCode: "SECURITY_HTTPS_MISSING",
          url: "https://www.botconsulting.io/portal",
          lifecycle: "NEW",
          technicalSeverity: "critical",
          remediationSummary: "Enable HTTPS",
        },
        {
          ruleCode: "SOCIAL_INCOMPLETE_OG",
          url: "https://www.botconsulting.io/blog/post-1",
          lifecycle: "NEW",
          technicalSeverity: "high",
          remediationSummary: "Add OG Image",
        },
      ],
    };

    const plan = generateOpportunityPlan({
      projectId: "bot-consulting",
      monitoringResult: mockMonitoringResult,
      platform: "webflow",
    });

    expect(plan.teamQueues["Developer"].actionCount).toBeGreaterThanOrEqual(1);
    expect(plan.teamQueues["CMS Editor"].actionCount).toBeGreaterThanOrEqual(1);
    expect(plan.teamQueues["SEO"].actionCount).toBeGreaterThanOrEqual(1);
  });
});
