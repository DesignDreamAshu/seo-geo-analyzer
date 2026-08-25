/**
 * Test Suite for Query Search-Intent & Modifier Classification.
 */

import { classifyQueryIntent } from "../intent-classifier";

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
  };
}

describe("Query Search-Intent & Modifier Classification", () => {
  it("1. Commercial Intent: detects service and consultant commercial modifiers", () => {
    const res = classifyQueryIntent("servicenow cmdb consulting services");
    expect(res.primaryIntent).toBe("COMMERCIAL_INVESTIGATION");
    expect(res.isCommercialDemand).toBe(true);
    expect(res.modifiers.includes("services")).toBe(true);
  });

  it("2. Question-Form Demand: classifies question starters as informational question demand", () => {
    const res = classifyQueryIntent("what is servicenow cmdb architecture");
    expect(res.primaryIntent).toBe("INFORMATIONAL");
    expect(res.isQuestionDemand).toBe(true);
  });

  it("3. Comparison Intent: detects vs and alternatives comparison modifiers", () => {
    const res = classifyQueryIntent("servicenow vs jira service desk");
    expect(res.primaryIntent).toBe("COMPARISON");
    expect(res.isComparisonDemand).toBe(true);
  });

  it("4. Mixed Brand + Commercial Intent: classifies brand queries with commercial modifiers as MIXED", () => {
    const res = classifyQueryIntent("bot consulting servicenow pricing", "BRANDED");
    expect(res.primaryIntent).toBe("MIXED");
    expect(res.allIntents.includes("BRANDED")).toBe(true);
    expect(res.allIntents.includes("COMMERCIAL_INVESTIGATION")).toBe(true);
  });
});
