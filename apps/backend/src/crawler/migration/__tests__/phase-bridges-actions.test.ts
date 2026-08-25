/**
 * Phase 11 Canonical Actions Bridge & Deduplication Tests.
 * Proves deduplication of migration actions, developer/SEO routing, and technical severity preservation.
 */

import { bridgeMigrationOpportunitiesToPhase11 } from "../phase-integrators";
import { RedirectIssue } from "../redirect-validator";
import { ParityIssue } from "../parity-validator";

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
  it("7.1. Migration launch blocker emits TECHNICAL_FIX action and deduplicates cleanly", () => {
    const redirectIssues: RedirectIssue[] = [
      {
        sourceUrl: "https://old.com/service",
        destinationUrl: "https://new.com/broken",
        issueType: "MIGRATION_REDIRECT_TARGET_BROKEN",
        statusCode: 404,
        blockerState: "LAUNCH_BLOCKER",
        details: "Target returns 404.",
        suggestedFix: "Fix destination page.",
      },
    ];

    const actions = bridgeMigrationOpportunitiesToPhase11("proj-1", "mig-1", redirectIssues, [], [], []);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe("TECHNICAL_FIX");
    expect(actions[0].actionPriority).toBe("CRITICAL");
    expect(actions[0].primaryOwner).toBe("Developer");

    // Deduplication check
    const dedup = bridgeMigrationOpportunitiesToPhase11("proj-1", "mig-1", redirectIssues, [], [], actions);
    expect(dedup.length).toBe(0);
  });
});
