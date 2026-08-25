/**
 * Test Suite for Stable Query Clustering & Identity Invariants.
 */

import { clusterQueries, buildDurableClusterId } from "../clustering";
import { NormalizedQueryRecord } from "../types";
import { extractSemanticTokens } from "../normalization";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("Stable Query Clustering & Identity Invariants", () => {
  it("1. Deterministic Cluster ID: seed query produces identical stable cluster ID across executions", () => {
    const tokens = extractSemanticTokens("servicenow cmdb assessment");
    const id1 = buildDurableClusterId(tokens);
    const id2 = buildDurableClusterId(tokens);
    expect(id1).toBe(id2);
  });

  it("2. Clustering Stability: related queries cluster together and preserve raw queries", () => {
    const q1: NormalizedQueryRecord = {
      queryId: "q1",
      rawQuery: "servicenow cmdb assessment",
      normalizedQuery: "servicenow cmdb assessment",
      semanticTokens: extractSemanticTokens("servicenow cmdb assessment"),
      intents: ["COMMERCIAL_INVESTIGATION"],
      brandState: "NON_BRANDED",
      impressions: 4200,
      clicks: 110,
      ctr: 2.62,
      position: 5.2,
      landingPages: [{ url: "https://www.botconsulting.io/services/cmdb", impressions: 4200, clicks: 110, position: 5.2 }],
      dataQuality: "FRESH_COMPLETE",
    };

    const q2: NormalizedQueryRecord = {
      queryId: "q2",
      rawQuery: "servicenow cmdb assessments",
      normalizedQuery: "servicenow cmdb assessments",
      semanticTokens: extractSemanticTokens("servicenow cmdb assessments"),
      intents: ["COMMERCIAL_INVESTIGATION"],
      brandState: "NON_BRANDED",
      impressions: 1200,
      clicks: 30,
      ctr: 2.5,
      position: 5.4,
      landingPages: [{ url: "https://www.botconsulting.io/services/cmdb", impressions: 1200, clicks: 30, position: 5.4 }],
      dataQuality: "FRESH_COMPLETE",
    };

    const clusters = clusterQueries([q1, q2]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].rawQueries.length).toBe(2);
    expect(clusters[0].totalObservedImpressions).toBe(5400);
    expect(clusters[0].totalClicks).toBe(140);
  });

  it("3. Distinct Semantic Clusters: semantically separate topics do NOT collapse", () => {
    const q1: NormalizedQueryRecord = {
      queryId: "q1",
      rawQuery: "servicenow cmdb",
      normalizedQuery: "servicenow cmdb",
      semanticTokens: extractSemanticTokens("servicenow cmdb"),
      intents: ["INFORMATIONAL"],
      brandState: "NON_BRANDED",
      impressions: 3000,
      clicks: 80,
      ctr: 2.6,
      position: 6.1,
      landingPages: [{ url: "https://www.botconsulting.io/services/cmdb", impressions: 3000, clicks: 80, position: 6.1 }],
      dataQuality: "FRESH_COMPLETE",
    };

    const q2: NormalizedQueryRecord = {
      queryId: "q2",
      rawQuery: "salesforce crm migration",
      normalizedQuery: "salesforce crm migration",
      semanticTokens: extractSemanticTokens("salesforce crm migration"),
      intents: ["COMMERCIAL_INVESTIGATION"],
      brandState: "NON_BRANDED",
      impressions: 1500,
      clicks: 40,
      ctr: 2.6,
      position: 7.2,
      landingPages: [{ url: "https://www.botconsulting.io/services/salesforce", impressions: 1500, clicks: 40, position: 7.2 }],
      dataQuality: "FRESH_COMPLETE",
    };

    const clusters = clusterQueries([q1, q2]);
    expect(clusters.length).toBe(2);
  });
});
