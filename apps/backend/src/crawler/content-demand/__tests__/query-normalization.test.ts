/**
 * Test Suite for Query Normalization & Brand Classification.
 */

import { normalizeQuery, classifyBrandState, areQueriesNearIdentical } from "../normalization";

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

describe("Query Normalization & Brand Classification", () => {
  it("1. Normalization: collapses whitespace, trims punctuation, preserves case-insensitivity", () => {
    expect(normalizeQuery('  "ServiceNow   CMDB Assessment"  ')).toBe("servicenow cmdb assessment");
    expect(normalizeQuery("best cwv practices?")).toBe("best cwv practices");
  });

  it("2. Brand Classification: matches configured brand aliases accurately", () => {
    const aliases = ["bot consulting", "botconsulting"];
    expect(classifyBrandState("bot consulting servicenow", aliases)).toBe("BRANDED");
    expect(classifyBrandState("botconsulting pricing", aliases)).toBe("BRANDED");
    expect(classifyBrandState("servicenow implementation services", aliases)).toBe("NON_BRANDED");
    expect(classifyBrandState("servicenow cmdb", [])).toBe("AMBIGUOUS");
  });

  it("3. Conservative Equivalence: recognizes singular/plural without collapsing distinct semantic concepts", () => {
    expect(areQueriesNearIdentical("servicenow consultant", "servicenow consultants")).toBe(true);
    expect(areQueriesNearIdentical("servicenow consulting", "servicenow implementation")).toBe(false);
  });
});
