/**
 * Test Suite for Performance Regression & GSC Temporal Trend Correlation.
 */

import { auditSnapshotRegression } from "../engine";

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

describe("Performance Regression & GSC Temporal Correlation", () => {
  it("1. LCP Material Field Degradation: flags LCP regression from 1800ms to 3500ms", () => {
    const baseSnap: any = {
      snapshotId: "snap_01",
      projectId: "bot-consulting",
      rootDomain: "botconsulting.io",
      originUrl: "https://www.botconsulting.io",
      isComplete: true,
      pages: {
        "https://www.botconsulting.io/insights": { url: "https://www.botconsulting.io/insights", statusCode: 200, lcpMs: 1800 },
      },
      findings: [],
    };

    const currSnap: any = {
      ...baseSnap,
      snapshotId: "snap_02",
      pages: {
        "https://www.botconsulting.io/insights": { url: "https://www.botconsulting.io/insights", statusCode: 200, lcpMs: 3500 },
      },
    };

    const res = auditSnapshotRegression(currSnap, baseSnap);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/insights");

    expect(pChange?.performanceRegression).toBeTruthy();
    expect(pChange?.performanceRegression?.metric).toBe("LCP");
    expect(pChange?.performanceRegression?.type).toBe("FIELD_REGRESSION");
  });

  it("2. GSC Clicks Decline Correlation: reports temporal correlation without making unevidenced causation claims", () => {
    const baseSnap: any = {
      snapshotId: "snap_01",
      projectId: "bot-consulting",
      rootDomain: "botconsulting.io",
      originUrl: "https://www.botconsulting.io",
      isComplete: true,
      pages: {
        "https://www.botconsulting.io/cmdb": {
          url: "https://www.botconsulting.io/cmdb",
          statusCode: 200,
          gscData: { currentPeriod: { clicks: 120, impressions: 2400 } },
        },
      },
      findings: [],
    };

    const currSnap: any = {
      ...baseSnap,
      snapshotId: "snap_02",
      pages: {
        "https://www.botconsulting.io/cmdb": {
          url: "https://www.botconsulting.io/cmdb",
          statusCode: 200,
          gscData: { currentPeriod: { clicks: 45, impressions: 1100 } }, // -75 clicks
        },
      },
    };

    const res = auditSnapshotRegression(currSnap, baseSnap);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/cmdb");

    expect(pChange?.gscTrendCorrelation).toBeTruthy();
    expect(pChange?.gscTrendCorrelation?.clicksDelta).toBe(-75);
    expect(pChange?.gscTrendCorrelation?.correlationNote.includes("Temporally correlated")).toBe(true);
  });
});
