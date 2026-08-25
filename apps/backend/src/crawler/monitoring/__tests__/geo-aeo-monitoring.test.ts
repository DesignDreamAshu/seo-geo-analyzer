/**
 * Test Suite for GEO / AEO & AI Crawler Access Monitoring.
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

describe("GEO / AEO & AI Crawler Access Monitoring", () => {
  it("1. Search Indexer Access Change: flags when OAI-SearchBot access changes from ALLOWED to DISALLOWED", () => {
    const baseSnap: any = {
      snapshotId: "snap_01",
      projectId: "bot-consulting",
      rootDomain: "botconsulting.io",
      originUrl: "https://www.botconsulting.io",
      isComplete: true,
      pages: {
        "https://www.botconsulting.io/guide": {
          url: "https://www.botconsulting.io/guide",
          statusCode: 200,
          geoAeoResult: {
            crawlerAccess: [
              { crawler: { userAgent: "OAI-SearchBot", role: "SEARCH_INDEXER" }, accessStatus: "ALLOWED" },
            ],
          },
        },
      },
      findings: [],
    };

    const currSnap: any = {
      ...baseSnap,
      snapshotId: "snap_02",
      pages: {
        "https://www.botconsulting.io/guide": {
          url: "https://www.botconsulting.io/guide",
          statusCode: 200,
          geoAeoResult: {
            crawlerAccess: [
              { crawler: { userAgent: "OAI-SearchBot", role: "SEARCH_INDEXER" }, accessStatus: "DISALLOWED" },
            ],
          },
        },
      },
    };

    const res = auditSnapshotRegression(currSnap, baseSnap);
    const pChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/guide");

    expect(pChange?.geoAeoChanges).toBeTruthy();
    expect(pChange?.geoAeoChanges?.crawlerAccessChanges?.length).toBeGreaterThanOrEqual(1);
    expect(pChange?.geoAeoChanges?.isTrainingPolicyChangeOnly).toBe(false);
  });
});
