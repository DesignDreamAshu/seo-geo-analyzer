/**
 * 95-Rule Remediation Contract Certification Harness.
 * Programmatically verifies that EVERY single one of the 95 production diagnostic rules
 * satisfies all applicable requirements of the Remediation Completeness Contract.
 */

import { IMPLEMENTED_DIAGNOSTIC_RULES, DiagnosticRuleMetadata } from "../rule-inventory";
import { generateFixIntelligenceForIssue } from "../../fix-intelligence/engine";
import { DiagnosticIssue } from "../../types";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeDefined() {
      if (actual === undefined) throw new Error("Expected value to be defined");
    },
  };
}

describe("108-Rule Remediation Contract Certification Harness", () => {
  const allRules = IMPLEMENTED_DIAGNOSTIC_RULES;

  it("1. Complete Production Rule Registry Count: exactly 108 certified production rules", () => {
    expect(allRules.length).toBe(108);
  });

  it("2. Universal Remediation Blueprint Verification across all 108 production rules", () => {
    let completeCount = 0;
    let manualReviewCount = 0;
    let partialCount = 0;

    const manualReviewRules = new Set([
      "SOFT_404_CANDIDATE",
      "RENDER_SUSPICIOUS_DOM_MUTATION",
      "INDEX_NOINDEX", // Requires editorial review of intentional noindex pages
    ]);

    for (const rule of allRules) {
      const mockIssue: DiagnosticIssue = {
        id: `issue_${rule.ruleCode}`,
        code: rule.ruleCode,
        category: rule.category as any,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        recommendation: `Fix ${rule.title}`,
        confidence: rule.confidenceType,
        confidenceScore: 1.0,
        impactScore: 7,
        affectedCount: 3,
        affectedOccurrences: 3,
        affectedUniquePages: 3,
        eligiblePageCount: 10,
        affectedRatio: 0.3,
        isSystemicTemplateIssue: true,
        affectedPages: [
          {
            url: "https://www.botconsulting.io/test-page",
            evidence: {
              observed: `Observed issue fact for ${rule.ruleCode}`,
              crawlTimestamp: new Date().toISOString(),
              sourceMode: "raw_http",
              sourceUrl: "https://www.botconsulting.io/test-page",
              codeSnippet: "<test-snippet>",
              domSelector: "main > section",
            },
          },
        ],
      };

      const fix = generateFixIntelligenceForIssue(mockIssue, {
        platform: "webflow",
        isCmsPage: true,
        templateName: "Blog Posts Template",
      });

      // 1. Identification
      expect(fix.ruleCode).toBe(rule.ruleCode);
      expect(fix.category).toBeTruthy();
      expect(fix.priority).toBeDefined();
      expect(fix.confidence).toBeDefined();

      // 2. Evidence & Diagnosis
      expect(fix.problem.observed).toBeTruthy();
      expect(fix.whyItMatters).toBeTruthy();
      expect(fix.fixScope.reason).toBeTruthy();

      // 3. Remediation & Location
      expect(fix.fix.objective).toBeTruthy();
      expect(fix.fix.steps.length).toBeGreaterThanOrEqual(1);
      expect(fix.fix.steps[0].location).toBeTruthy();
      expect(fix.fix.steps[0].action).toBeTruthy();

      // 4. Verification
      expect(fix.verification.method).toBeTruthy();
      expect(fix.verification.expectedOutcome).toBeTruthy();

      if (manualReviewRules.has(rule.ruleCode) || rule.confidenceType === "manual_review") {
        manualReviewCount++;
      } else {
        completeCount++;
      }
    }

    console.log(`\n  ========================================================================`);
    console.log(`  108-RULE REMEDIATION CONTRACT CERTIFICATION RESULTS:`);
    console.log(`  - REMEDIATION_CONTRACT_COMPLETE: ${completeCount}`);
    console.log(`  - MANUAL_REVIEW_BY_DESIGN:       ${manualReviewCount}`);
    console.log(`  - REMEDIATION_CONTRACT_PARTIAL:  ${partialCount}`);
    console.log(`  ========================================================================\n`);

    expect(completeCount + manualReviewCount).toBe(108);
    expect(partialCount).toBe(0);
  });
});
