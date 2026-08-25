/**
 * Test Suite for Content Demand Report Serialization.
 */

import { analyzeContentAndSearchDemand } from "../engine";
import { serializeContentDemandReportMarkdown } from "../report-serializer";

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

describe("Content Demand Report Serialization", () => {
  it("1. Generates structured Markdown report with demand summaries, coverage decisions, and cannibalization insights", () => {
    const mockRows = [
      {
        query: "servicenow cmdb consulting",
        page: "https://www.botconsulting.io/services/cmdb",
        impressions: 4500,
        clicks: 120,
        ctr: 2.67,
        position: 5.1,
      },
      {
        query: "what is servicenow itsm architecture",
        page: "https://www.botconsulting.io/blog/itsm-architecture",
        impressions: 2100,
        clicks: 95,
        ctr: 4.52,
        position: 3.8,
      },
    ];

    const { report } = analyzeContentAndSearchDemand({
      projectId: "bot-consulting",
      rawGscQueryRows: mockRows,
      brandAliases: ["bot consulting"],
      pagesMetadata: {
        "https://www.botconsulting.io/services/cmdb": {
          url: "https://www.botconsulting.io/services/cmdb",
          title: "ServiceNow CMDB Consulting",
          h1: "Enterprise CMDB Architecture",
        },
      },
    });

    const md = serializeContentDemandReportMarkdown(report);

    expect(md.includes("# CONTENT & SEARCH DEMAND INTELLIGENCE")).toBe(true);
    expect(md.includes("Demand & Content Decision Summary")).toBe(true);
    expect(md.includes("Existing Pages to Improve")).toBe(true);
    expect(md.includes("Data Limitations & Governance")).toBe(true);
  });
});
