/**
 * Cross-Signal Performance Interaction Test Suite
 * Tests multi-signal interactions (Field CLS + Missing Dimensions, Field LCP + Lazy Image, Origin vs URL scope, etc.)
 */

import { evaluatePerformanceDiagnosticRules } from "../performance-rules";
import { PagePerformanceFacts } from "../types";

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
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
  };
}

describe("Performance Cross-Signal Interaction Tests", () => {
  it("1. Field CLS Poor + Lab CLS Poor co-exist with proper evidence provenance without double-counting crashes", () => {
    const fact: PagePerformanceFacts = {
      url: "https://example.com/page-1",
      normalizedUrl: "https://example.com/page-1",
      crawlerSignals: { ttfbMs: 200, htmlPayloadBytes: 15000 },
      evaluationStatus: "EVALUATED",
      mobile: {
        strategy: "mobile",
        lab: { cls: 0.35 },
        field: { clsP75: 0.40, sampleAvailable: true, fieldDataScope: "URL" },
        opportunities: [],
        diagnostics: [],
        resources: [],
        thirdParties: [],
        fetchedAt: new Date().toISOString(),
      },
    };

    const issues = evaluatePerformanceDiagnosticRules([fact]);
    const codes = issues.map((i) => i.code);

    expect(codes.includes("FIELD_CLS_POOR")).toBeTruthy();
    expect(codes.includes("LAB_CLS_POOR")).toBeTruthy();

    const fieldIssue = issues.find((i) => i.code === "FIELD_CLS_POOR");
    expect(fieldIssue?.affectedPages[0].evidence.observed.includes("Real-user")).toBeTruthy();
  });

  it("2. Origin-level CrUX fallback explicitly declares (Origin-level CrUX) in evidence string", () => {
    const fact: PagePerformanceFacts = {
      url: "https://example.com/blog/new-post",
      normalizedUrl: "https://example.com/blog/new-post",
      crawlerSignals: { ttfbMs: 150, htmlPayloadBytes: 18000 },
      evaluationStatus: "EVALUATED",
      mobile: {
        strategy: "mobile",
        lab: { lcpMs: 2200 },
        field: { lcpP75Ms: 4600, sampleAvailable: true, fieldDataScope: "ORIGIN" },
        opportunities: [],
        diagnostics: [],
        resources: [],
        thirdParties: [],
        fetchedAt: new Date().toISOString(),
      },
    };

    const issues = evaluatePerformanceDiagnosticRules([fact]);
    const fieldLcp = issues.find((i) => i.code === "FIELD_LCP_POOR");

    expect(fieldLcp).toBeTruthy();
    expect(fieldLcp?.affectedPages[0].evidence.observed.includes("(Origin-level CrUX)")).toBeTruthy();
  });

  it("3. TBT in lab simulation does NOT trigger FIELD_INP_POOR when real-user field data is absent", () => {
    const fact: PagePerformanceFacts = {
      url: "https://example.com/app",
      normalizedUrl: "https://example.com/app",
      crawlerSignals: { ttfbMs: 120, htmlPayloadBytes: 50000 },
      evaluationStatus: "EVALUATED",
      mobile: {
        strategy: "mobile",
        lab: { tbtMs: 850 }, // High TBT
        field: { sampleAvailable: false, fieldDataScope: "NONE" }, // No field INP
        opportunities: [],
        diagnostics: [],
        resources: [],
        thirdParties: [],
        fetchedAt: new Date().toISOString(),
      },
    };

    const issues = evaluatePerformanceDiagnosticRules([fact]);
    const codes = issues.map((i) => i.code);

    expect(codes.includes("LAB_TBT_HIGH")).toBeTruthy();
    expect(codes.includes("FIELD_INP_POOR")).toBeFalsy(); // Must NOT infer INP from TBT!
  });

  it("4. API unavailable or rate-limited status produces zero false positive performance issues", () => {
    const fact: PagePerformanceFacts = {
      url: "https://example.com/slow",
      normalizedUrl: "https://example.com/slow",
      crawlerSignals: { ttfbMs: 3500, htmlPayloadBytes: 25000 },
      evaluationStatus: "RATE_LIMITED",
      errorMessage: "HTTP 429 quota exhausted",
    };

    const issues = evaluatePerformanceDiagnosticRules([fact]);
    expect(issues.length).toBe(0); // Zero issues fabricated on API unavailability
  });
});
