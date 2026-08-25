/**
 * Test Suite for Opportunity Priority Ordering & Explainability.
 */

import { evaluateActionPriority } from "../priority-engine";

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

describe("Opportunity Priority Ordering & Explainability", () => {
  it("1. High Search Exposure Boost: same technical severity receives higher action priority with high demand", () => {
    // Page A: Low search demand (10 impressions)
    const lowDemand = evaluateActionPriority({
      technicalSeverity: "low",
      isNewRegression: false,
      isReopened: false,
      isSystemic: false,
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      gscExposure: { totalImpressions: 10, totalClicks: 0, averageCtr: 0, averagePosition: 40, topQueries: [], dataQuality: "LOW_VOLUME_SAMPLE" },
      opportunityType: "TECHNICAL_FIX",
    });

    // Page B: High search demand (50,000 impressions)
    const highDemand = evaluateActionPriority({
      technicalSeverity: "medium",
      isNewRegression: false,
      isReopened: false,
      isSystemic: false,
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      gscExposure: { totalImpressions: 50000, totalClicks: 1200, averageCtr: 2.4, averagePosition: 6.2, topQueries: [], dataQuality: "FRESH_COMPLETE" },
      opportunityType: "TECHNICAL_FIX",
    });

    expect(lowDemand.actionPriority).toBe("LOW");
    expect(highDemand.actionPriority).toBe("HIGH");
    expect(highDemand.whyThisPriority.some((w) => w.includes("50,000"))).toBe(true);
  });

  it("2. Critical Indexability Barrier: always assigned CRITICAL priority with DO_NOW bucket", () => {
    const res = evaluateActionPriority({
      technicalSeverity: "critical",
      isNewRegression: true,
      isReopened: false,
      isSystemic: false,
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      opportunityType: "INDEXABILITY_FIX",
    });

    expect(res.actionPriority).toBe("CRITICAL");
    expect(res.timelineBucket).toBe("DO_NOW");
  });

  it("3. Manual Review Action: assigned REVIEW priority with explicit caution rationale", () => {
    const res = evaluateActionPriority({
      technicalSeverity: "medium",
      isNewRegression: false,
      isReopened: false,
      isSystemic: false,
      affectedUrlsCount: 1,
      estimatedRealEdits: 1,
      isManualReview: true,
      opportunityType: "MANUAL_REVIEW",
    });

    expect(res.actionPriority).toBe("REVIEW");
    expect(res.whyThisPriority[0].includes("manual human evaluation")).toBe(true);
  });
});
