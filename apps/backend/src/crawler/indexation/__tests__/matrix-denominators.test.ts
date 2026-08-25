/**
 * Matrix Distribution & Explicit Denominator Tests.
 * Proves exact mathematical accounting of indexation ratios.
 */

import { computeIndexCoverageMatrix } from "../matrix-engine";
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

describe("3. Matrix Distribution & Explicit Denominators", () => {
  it("3.1. Computes explicit denominators for indexed vs eligible URLs with evidence", () => {
    const records: IndexationEvidenceRecord[] = [
      {
        projectId: "p1",
        url: "https://example.com/p1",
        normalizedUrl: "https://example.com/p1",
        isImportant: true,
        importanceReasons: ["WATCHLIST"],
        evaluatedAt: "2026-08-20T10:00:00Z",
        technicalIndexability: "INDEXABLE",
        googleIndexState: "INDEXED",
        googleDetailedReason: "INDEXED",
        canonicalAlignment: "CANONICAL_MATCH",
        rootCauseCategory: "CAUSE_UNKNOWN",
        rootCauseDetails: [],
        evidenceSource: "GSC_URL_INSPECTION_API",
        evidenceFreshness: "FRESH",
        confidence: "HIGH",
        mapperVersion: "1.0.0",
      },
      {
        projectId: "p1",
        url: "https://example.com/p2",
        normalizedUrl: "https://example.com/p2",
        isImportant: false,
        importanceReasons: [],
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
      {
        projectId: "p1",
        url: "https://example.com/p3",
        normalizedUrl: "https://example.com/p3",
        isImportant: false,
        importanceReasons: [],
        evaluatedAt: "2026-08-20T10:00:00Z",
        technicalIndexability: "INDEXABLE",
        googleIndexState: "UNKNOWN",
        googleDetailedReason: "UNKNOWN",
        canonicalAlignment: "GOOGLE_CANONICAL_UNKNOWN",
        rootCauseCategory: "CAUSE_UNKNOWN",
        rootCauseDetails: [],
        evidenceSource: "UNKNOWN",
        evidenceFreshness: "UNKNOWN",
        confidence: "UNKNOWN",
        mapperVersion: "1.0.0",
      },
    ];

    const matrix = computeIndexCoverageMatrix(records, 10);
    expect(matrix.totalKnownUrls).toBe(10);
    expect(matrix.urlsWithGoogleEvidenceCount).toBe(2);
    expect(matrix.indexedCount).toBe(1);
    expect(matrix.notIndexedCount).toBe(1);
    expect(matrix.unknownIndexStateCount).toBe(8);

    expect(matrix.indexedAmongEligibleWithEvidenceRatio.numerator).toBe(1);
    expect(matrix.indexedAmongEligibleWithEvidenceRatio.denominator).toBe(2);
    expect(matrix.indexedAmongEligibleWithEvidenceRatio.percentage).toBe(50);

    expect(matrix.importantIndexableIndexedRatio.numerator).toBe(1);
    expect(matrix.importantIndexableIndexedRatio.denominator).toBe(1);
    expect(matrix.importantIndexableIndexedRatio.percentage).toBe(100);
  });
});
