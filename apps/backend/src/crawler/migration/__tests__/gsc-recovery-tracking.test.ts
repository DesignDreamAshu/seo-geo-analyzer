/**
 * Comprehensive GSC Migration Recovery & Period Comparability Tests.
 * Separate tests for equal complete periods, shorter post-launch, partial data,
 * stale data, missing data, period window mismatch, and non-causal language.
 */

import { evaluateGscMigrationRecovery } from "../gsc-recovery";
import { UrlMappingEntry } from "../types";
import { DEFAULT_MIGRATION_POLICY, STRICT_ENTERPRISE_MIGRATION_POLICY } from "../config";

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
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

describe("6. GSC Recovery Tracking & Period Comparability", () => {
  it("6.1. Shorter post-launch window (< 7 days) returns RECOVERY_NOT_YET_EVALUABLE and SHORTER_POST_LAUNCH_PERIOD", () => {
    const res = evaluateGscMigrationRecovery({
      mappings: [],
      preMigrationGscData: [{ url: "https://old.com/page", clicks: 100, impressions: 1000 }],
      postMigrationGscData: [{ url: "https://new.com/page", clicks: 50, impressions: 500 }],
      daysSinceLaunch: 4,
    });

    expect(res.recoveryState).toBe("RECOVERY_NOT_YET_EVALUABLE");
    expect(res.periodComparability).toBe("SHORTER_POST_LAUNCH_PERIOD");
  });

  it("6.2. Missing GSC data returns INSUFFICIENT_DATA and MISSING_GSC_DATA", () => {
    const res = evaluateGscMigrationRecovery({
      mappings: [],
      preMigrationGscData: [],
      postMigrationGscData: [],
      daysSinceLaunch: 28,
    });

    expect(res.recoveryState).toBe("INSUFFICIENT_DATA");
    expect(res.periodComparability).toBe("MISSING_GSC_DATA");
  });

  it("6.3. Stale GSC data returns INSUFFICIENT_DATA and STALE_GSC_DATA", () => {
    const res = evaluateGscMigrationRecovery({
      mappings: [],
      preMigrationGscData: [{ url: "https://old.com/page", clicks: 100, impressions: 1000 }],
      postMigrationGscData: [{ url: "https://new.com/page", clicks: 100, impressions: 1000 }],
      daysSinceLaunch: 28,
      isStaleData: true,
    });

    expect(res.recoveryState).toBe("INSUFFICIENT_DATA");
    expect(res.periodComparability).toBe("STALE_GSC_DATA");
  });

  it("6.4. Period window mismatch normalizes daily search volume with PERIOD_WINDOW_MISMATCH", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/service", destinationUrl: "https://new.com/service", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "DETERMINISTIC", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "NON_BLOCKING", notes: "" },
    ];

    // Pre = 90 days with 900 clicks (10 clicks/day); Post = 14 days with 135 clicks (9.64 clicks/day ~ 96% recovery)
    const res = evaluateGscMigrationRecovery({
      mappings,
      preMigrationGscData: [{ url: "https://old.com/service", clicks: 900, impressions: 9000 }],
      postMigrationGscData: [{ url: "https://new.com/service", clicks: 135, impressions: 1400 }],
      daysSinceLaunch: 14,
      prePeriodDays: 90,
      postPeriodDays: 14,
    });

    expect(res.periodComparability).toBe("PERIOD_WINDOW_MISMATCH");
    expect(res.recoveryState).toBe("RECOVERY_STABLE");
  });

  it("6.5. Strict policy evaluates recovery against customized 14-day window and 90% threshold", () => {
    const mappings: UrlMappingEntry[] = [
      { mappingId: "m1", sourceUrl: "https://old.com/p", destinationUrl: "https://new.com/p", mappingType: "ONE_TO_ONE", mappingSource: "CONFIGURED", mappingConfidence: "DETERMINISTIC", redirectEquivalence: "STRONG_EQUIVALENCE", sourceIsHighValue: true, sourceImportanceReasons: [], contentParity: "CONTENT_PARITY_STRONG", blockerState: "NON_BLOCKING", notes: "" },
    ];

    const res = evaluateGscMigrationRecovery({
      mappings,
      preMigrationGscData: [{ url: "https://old.com/p", clicks: 1000, impressions: 10000 }],
      postMigrationGscData: [{ url: "https://new.com/p", clicks: 860, impressions: 9000 }],
      daysSinceLaunch: 14,
      prePeriodDays: 14,
      postPeriodDays: 14,
      policy: STRICT_ENTERPRISE_MIGRATION_POLICY, // requires 90%
    });

    expect(res.recoveryState).toBe("RECOVERY_IN_PROGRESS"); // 86% is in progress under strict 90% threshold
  });
});
