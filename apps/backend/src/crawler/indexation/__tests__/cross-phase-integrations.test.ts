/**
 * Cross-Phase Integrations Tests.
 * Proves integration with Phase 17 Migration, Phase 18 Server Logs, and Phase 8 GSC.
 */

import { analyzeIndexationIntelligence } from "../engine";

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

describe("5. Cross-Phase Integrations", () => {
  it("5.1. Tracks migration index transition (old URL still indexed vs new URL not indexed)", async () => {
    const { report } = await analyzeIndexationIntelligence({
      projectId: "p1",
      universeInputs: {
        crawlerUrls: ["https://example.com/new-dest"],
        migrationUrls: ["https://example.com/old-src"],
      },
      inspectionPayloads: [
        {
          inspectionUrl: "https://example.com/old-src",
          inspectionTimestamp: "2026-08-20T10:00:00Z",
          verdict: "PASS",
          coverageState: "Submitted and indexed",
        },
        {
          inspectionUrl: "https://example.com/new-dest",
          inspectionTimestamp: "2026-08-20T10:00:00Z",
          verdict: "NEUTRAL",
          coverageState: "Discovered - currently not indexed",
        },
      ],
      migrationData: {
        migrationId: "mig_1",
        oldUrls: ["https://example.com/old-src"],
        newUrls: ["https://example.com/new-dest"],
      },
    });

    expect(report.migrationIndexTransition !== undefined).toBe(true);
    expect(report.migrationIndexTransition?.oldUrlsStillIndexedCount).toBe(1);
    expect(report.migrationIndexTransition?.newDestinationsIndexedCount).toBe(0);
    expect(report.migrationIndexTransition?.transitionState).toBe("NEW_TARGET_NOT_INDEXED_REVIEW");
  });
});
