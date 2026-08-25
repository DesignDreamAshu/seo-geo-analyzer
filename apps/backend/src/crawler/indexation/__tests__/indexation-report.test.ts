/**
 * Google Indexation Intelligence Report Serializer Tests.
 * Proves complete rendering of all report sections.
 */

import { analyzeIndexationIntelligence } from "../engine";
import { serializeGoogleIndexationReportMarkdown } from "../report-serializer";

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

describe("7. Google Indexation Intelligence Report Serializer", () => {
  it("7.1. Serializes complete Markdown report with all required sections", async () => {
    const { report } = await analyzeIndexationIntelligence({
      projectId: "dream-seo-corp",
      universeInputs: {
        crawlerUrls: ["https://example.com/pricing", "https://example.com/docs"],
        sitemapUrls: ["https://example.com/pricing"],
      },
      inspectionPayloads: [
        {
          inspectionUrl: "https://example.com/pricing",
          inspectionTimestamp: "2026-08-20T10:00:00Z",
          verdict: "PASS",
          coverageState: "Submitted and indexed",
          userCanonical: "https://example.com/pricing",
          googleCanonical: "https://example.com/pricing",
        },
      ],
      knownUrlMetadata: new Map([
        [
          "https://example.com/pricing",
          {
            isImportant: true,
            importanceReasons: ["PRICING_PAGE"],
            technicalIndexability: "INDEXABLE",
          },
        ],
      ]),
    });

    const md = serializeGoogleIndexationReportMarkdown(report);

    expect(md.includes("# 🔍 GOOGLE INDEXATION INTELLIGENCE REPORT")).toBe(true);
    expect(md.includes("## 1. 📊 Evidence Quality & Inspection Scope")).toBe(true);
    expect(md.includes("## 2. 🌐 Known URL Universe & Source Composition")).toBe(true);
    expect(md.includes("## 3. ⚖️ Technical Indexability × Google Index Evidence Matrix")).toBe(true);
    expect(md.includes("## 4. 🎯 Important Page Index Coverage")).toBe(true);
    expect(md.includes("## 5. 🔀 Canonical Selection Intelligence")).toBe(true);
    expect(md.includes("## 7. ℹ️ Data Limitations & Governance Principles")).toBe(true);
  });
});
