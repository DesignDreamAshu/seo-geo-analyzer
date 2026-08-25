/**
 * Performance Fixture Execution Suite
 * Evaluates all 15 performance rules across 90 deterministic fixtures (0 FP / 0 FN).
 */

import { buildPerformanceRuleFixtures } from "../performance-fixtures";
import { evaluatePerformanceDiagnosticRules } from "../performance-rules";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../verification/rule-inventory";

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
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
  };
}

describe("Phase 7 Performance Ground-Truth Fixture Suite", () => {
  const fixtures = buildPerformanceRuleFixtures();
  const perfRuleCodes = Array.from(new Set(fixtures.map((f) => f.ruleCode)));

  let globalTP = 0;
  let globalTN = 0;
  let globalFP = 0;
  let globalFN = 0;

  for (const ruleCode of perfRuleCodes) {
    it(`Rule: ${ruleCode.padEnd(32)} (6 fixtures)`, () => {
      const ruleFixtures = fixtures.filter((f) => f.ruleCode === ruleCode);
      expect(ruleFixtures.length).toBe(6);

      let tp = 0;
      let tn = 0;
      let fp = 0;
      let fn = 0;

      for (const tc of ruleFixtures) {
        const issues = evaluatePerformanceDiagnosticRules([tc.facts]);
        const emitted = issues.find((i) => i.code === ruleCode);
        const actualFinding = Boolean(emitted && emitted.affectedPages.some((p) => p.url === tc.url));
        const expected = tc.expectedFinding;

        if (expected && actualFinding) {
          tp++;
          globalTP++;
        } else if (!expected && !actualFinding) {
          tn++;
          globalTN++;
        } else if (!expected && actualFinding) {
          fp++;
          globalFP++;
        } else if (expected && !actualFinding) {
          fn++;
          globalFN++;
        }
      }

      expect(fp).toBe(0);
      expect(fn).toBe(0);
      expect(tp).toBe(2);
      expect(tn).toBe(4);
    });
  }

  it("Global Fixture Invariants (90 fixtures: 30 TP, 60 TN, 0 FP, 0 FN)", () => {
    expect(fixtures.length).toBe(90);
    expect(perfRuleCodes.length).toBe(15);
    expect(globalTP).toBe(30);
    expect(globalTN).toBe(60);
    expect(globalFP).toBe(0);
    expect(globalFN).toBe(0);
    expect(globalTP + globalTN + globalFP + globalFN).toBe(90);
  });
});
