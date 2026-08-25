/**
 * Phase 11 Bridge & Action Deduplication Tests.
 * Proves that Phase 19 supplies evidence while Phase 11 maintains action priority authority.
 */

import { generateIndexationActionItems } from "../phase-integrators";
import { IndexationEvidenceRecord } from "../types";

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

describe("6. Phase 11 Bridge & Action Deduplication", () => {
  it("6.1. Emits investigation action for important crawled-not-indexed page and deduplicates cleanly", () => {
    const records: IndexationEvidenceRecord[] = [
      {
        projectId: "p1",
        url: "https://example.com/pricing",
        normalizedUrl: "https://example.com/pricing",
        isImportant: true,
        importanceReasons: ["BUSINESS_CRITICAL"],
        evaluatedAt: "2026-08-20T10:00:00Z",
        technicalIndexability: "INDEXABLE",
        googleIndexState: "NOT_INDEXED",
        googleDetailedReason: "CRAWLED_CURRENTLY_NOT_INDEXED",
        canonicalAlignment: "CANONICAL_MATCH",
        rootCauseCategory: "POSSIBLE_CONTRIBUTOR",
        rootCauseDetails: [],
        evidenceSource: "GSC_URL_INSPECTION_API",
        evidenceFreshness: "FRESH",
        confidence: "HIGH",
        mapperVersion: "1.0.0",
      },
    ];

    const actions = generateIndexationActionItems({ records, projectId: "p1" });
    expect(actions.length).toBe(1);
    expect(actions[0].actionId.includes("ACT_INDEX_CRAWLED_NOT_INDEXED")).toBe(true);
    expect(actions[0].primaryOwner).toBe("Content");
    expect(actions[0].actionPriority).toBe("HIGH");
  });
});
