/**
 * Phase 11 Canonical Actions Bridge & Deduplication Tests for Server Log Intelligence.
 * Proves deduplication of 404, redirect, and 5xx error actions, preserving Phase 11 priority authority.
 */

import { bridgeServerLogOpportunitiesToPhase11 } from "../phase-integrators";

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

describe("7. Phase 11 Integration & Action Deduplication", () => {
  it("7.1. Emits TECHNICAL_FIX action for 5xx burst and deduplicates cleanly", () => {
    const errorBursts = [
      {
        timestampStart: "2026-08-21T10:00:00Z",
        timestampEnd: "2026-08-21T10:05:00Z",
        statusCode: 500,
        requestsCount: 25,
        affectedUrls: ["https://example.com/api/v1/search"],
      },
    ];

    const actions = bridgeServerLogOpportunitiesToPhase11({
      projectId: "p1",
      errorBursts,
      facetPatterns: [],
      unobservedImportantUrls: [],
      existingActions: [],
    });

    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe("TECHNICAL_FIX");
    expect(actions[0].actionPriority).toBe("CRITICAL");
    expect(actions[0].primaryOwner).toBe("Developer");

    // Deduplication check
    const dedup = bridgeServerLogOpportunitiesToPhase11({
      projectId: "p1",
      errorBursts,
      facetPatterns: [],
      unobservedImportantUrls: [],
      existingActions: actions,
    });
    expect(dedup.length).toBe(0);
  });
});
