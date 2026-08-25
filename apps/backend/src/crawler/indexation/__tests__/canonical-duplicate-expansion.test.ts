/**
 * Canonical Selection & Index Expansion Intelligence Tests.
 * Proves handling of canonical differences and unexpected index expansion patterns.
 */

import { evaluateCanonicalSelectionIntelligence } from "../canonical-intelligence";
import { detectUnexpectedIndexExpansion } from "../expansion-detector";
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

describe("4. Canonical Selection & Index Expansion Intelligence", () => {
  it("4.1. Evaluates Google canonical selection mismatch without declaring automatic failure", () => {
    const records: IndexationEvidenceRecord[] = [
      {
        projectId: "p1",
        url: "https://example.com/product?color=blue",
        normalizedUrl: "https://example.com/product?color=blue",
        isImportant: true,
        importanceReasons: [],
        evaluatedAt: "2026-08-20T10:00:00Z",
        technicalIndexability: "INDEXABLE",
        declaredCanonical: "https://example.com/product?color=blue",
        googleCanonical: "https://example.com/product",
        canonicalAlignment: "GOOGLE_SELECTED_DIFFERENT_CANONICAL",
        googleIndexState: "NOT_INDEXED",
        googleDetailedReason: "DUPLICATE_GOOGLE_CHOSE_DIFFERENT_CANONICAL",
        rootCauseCategory: "STRONG_CORRELATION",
        rootCauseDetails: [],
        evidenceSource: "GSC_URL_INSPECTION_API",
        evidenceFreshness: "FRESH",
        confidence: "HIGH",
        mapperVersion: "1.0.0",
      },
    ];

    const res = evaluateCanonicalSelectionIntelligence(records);
    expect(res.googleSelectedDifferentCanonicalCount).toBe(1);
    expect(res.mismatchExamples.length).toBe(1);
    expect(res.mismatchExamples[0].isContentEquivalenceLikely).toBe(true);
  });

  it("4.2. Detects unexpected index expansion of tracking parameters and internal search", () => {
    const records: IndexationEvidenceRecord[] = [
      {
        projectId: "p1",
        url: "https://example.com/page?utm_source=fb",
        normalizedUrl: "https://example.com/page?utm_source=fb",
        isImportant: false,
        importanceReasons: [],
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
        url: "https://example.com/search?q=shoes",
        normalizedUrl: "https://example.com/search?q=shoes",
        isImportant: false,
        importanceReasons: [],
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
    ];

    const exp = detectUnexpectedIndexExpansion(records);
    expect(exp.trackingParametersIndexedCount).toBe(1);
    expect(exp.internalSearchIndexedCount).toBe(1);
    expect(exp.detectedPatterns.length).toBe(2);
  });
});
