/**
 * Master Backlink Intelligence Report Serializer Tests.
 * Proves complete Markdown rendering of backlink inventories, referring domains,
 * broken targets, competitor gaps, and governance limitations.
 */

import { analyzeBacklinkIntelligence } from "../engine";
import { serializeOffPageBacklinkReportMarkdown } from "../report-serializer";

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

describe("9. Master Backlink Report Serializer", () => {
  it("9.1. Generates structured Markdown report with all sections", async () => {
    const { report } = await analyzeBacklinkIntelligence({
      projectId: "bot-consulting",
      targetDomain: "botconsulting.io",
      competitorDomains: [{ domain: "accenture.com" }, { domain: "deloitte.com" }],
      crawlMetadataMap: new Map([
        [
          "https://www.botconsulting.io/old-broken-cmdb",
          { statusCode: 404, equivalentResourceCandidate: "https://www.botconsulting.io/resources/cmdb-guide" },
        ],
      ]),
    });

    const md = serializeOffPageBacklinkReportMarkdown(report);

    expect(md.includes("# OFF-PAGE & BACKLINK INTELLIGENCE")).toBe(true);
    expect(md.includes("Observed Backlink Records")).toBe(true);
    expect(md.includes("Broken Backlink Targets")).toBe(true);
    expect(md.includes("Competitor Referring Domain Gaps & Link Intersect")).toBe(true);
    expect(md.includes("Data Limitations & Governance Principles")).toBe(true);
  });
});
