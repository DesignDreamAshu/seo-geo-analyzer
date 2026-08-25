/**
 * Deterministic CWV Threshold Boundary Test Suite
 * Tests exact millisecond & decimal boundaries against official Google thresholds.
 */

import {
  CWV_THRESHOLDS,
  evaluateLcp,
  evaluateInp,
  evaluateCls,
  evaluateFcp,
  evaluateTtfb,
  evaluateTbt,
  evaluateOverallFieldStatus,
} from "../thresholds";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void) {
  try {
    fn();
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
  };
}

describe("Core Web Vitals Threshold Boundary Tests", () => {
  it("LCP boundaries: 2500ms (Good), 2501ms (Needs Improvement), 4000ms (Needs Improvement), 4001ms (Poor)", () => {
    expect(evaluateLcp(0)).toBe("GOOD");
    expect(evaluateLcp(2500)).toBe("GOOD");
    expect(evaluateLcp(2501)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateLcp(4000)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateLcp(4001)).toBe("POOR");
    expect(evaluateLcp(8500)).toBe("POOR");
    expect(evaluateLcp(undefined)).toBe(undefined);
  });

  it("INP boundaries: 200ms (Good), 201ms (Needs Improvement), 500ms (Needs Improvement), 501ms (Poor)", () => {
    expect(evaluateInp(50)).toBe("GOOD");
    expect(evaluateInp(200)).toBe("GOOD");
    expect(evaluateInp(201)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateInp(500)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateInp(501)).toBe("POOR");
    expect(evaluateInp(1200)).toBe("POOR");
    expect(evaluateInp(undefined)).toBe(undefined);
  });

  it("CLS boundaries: 0.100 (Good), 0.1001 (Needs Improvement), 0.250 (Needs Improvement), 0.2501 (Poor)", () => {
    expect(evaluateCls(0.0)).toBe("GOOD");
    expect(evaluateCls(0.0999)).toBe("GOOD");
    expect(evaluateCls(0.10)).toBe("GOOD");
    expect(evaluateCls(0.1001)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateCls(0.101)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateCls(0.2499)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateCls(0.25)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateCls(0.2501)).toBe("POOR");
    expect(evaluateCls(0.251)).toBe("POOR");
    expect(evaluateCls(0.65)).toBe("POOR");
    expect(evaluateCls(undefined)).toBe(undefined);
  });

  it("FCP boundaries: 1800ms (Good), 1801ms (Needs Improvement), 3000ms (Needs Improvement), 3001ms (Poor)", () => {
    expect(evaluateFcp(1800)).toBe("GOOD");
    expect(evaluateFcp(1801)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateFcp(3000)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateFcp(3001)).toBe("POOR");
  });

  it("TTFB boundaries: 800ms (Good), 801ms (Needs Improvement), 1800ms (Needs Improvement), 1801ms (Poor)", () => {
    expect(evaluateTtfb(800)).toBe("GOOD");
    expect(evaluateTtfb(801)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateTtfb(1800)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateTtfb(1801)).toBe("POOR");
  });

  it("Lab TBT boundaries: 200ms (Good), 201ms (Needs Improvement), 600ms (Needs Improvement), 601ms (Poor)", () => {
    expect(evaluateTbt(200)).toBe("GOOD");
    expect(evaluateTbt(201)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateTbt(600)).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateTbt(601)).toBe("POOR");
  });

  it("Overall Field Status evaluates most severe metric rating", () => {
    expect(evaluateOverallFieldStatus("GOOD", "GOOD", "GOOD")).toBe("GOOD");
    expect(evaluateOverallFieldStatus("GOOD", "NEEDS_IMPROVEMENT", "GOOD")).toBe("NEEDS_IMPROVEMENT");
    expect(evaluateOverallFieldStatus("GOOD", "NEEDS_IMPROVEMENT", "POOR")).toBe("POOR");
    expect(evaluateOverallFieldStatus(undefined, undefined, undefined)).toBe(undefined);
  });
});
