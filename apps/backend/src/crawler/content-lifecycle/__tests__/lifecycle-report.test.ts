/**
 * Phase 21: Content Lifecycle Report Serializer Tests.
 * Proves rendering of all report sections.
 */

import { analyzeContentLifecycleIntelligence } from "../engine";
import { serializeContentLifecycleReportMarkdown } from "../report-serializer";

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

describe("7. Content Lifecycle Report Serializer", () => {
  it("7.1. Serializes complete Markdown report with all essential sections", async () => {
    const { report } = await analyzeContentLifecycleIntelligence({
      projectId: "dream-seo-corp",
      urlInputs: [
        {
          projectId: "dream-seo-corp",
          url: "https://example.com/services/cmdb",
          pageType: "service_page",
          recentPerformance: { periodRange: "90d", monthlyImpressions: 5000, monthlyClicks: 150, averageCtr: 3.0, rankingQueryClustersCount: 5, topRankingClusterIds: ["c1"] },
          baselinePerformance: { periodRange: "Prev 90d", monthlyImpressions: 15000, monthlyClicks: 650, averageCtr: 4.33, rankingQueryClustersCount: 14, topRankingClusterIds: ["c1", "c2"] },
          outdatedYearReferences: [2022],
        },
      ],
    });

    const md = serializeContentLifecycleReportMarkdown(report);

    expect(md.includes("# 🔄 CONTENT LIFECYCLE, DECAY & CONSOLIDATION INTELLIGENCE REPORT")).toBe(true);
    expect(md.includes("## 1. 📊 Executive Summary & Lifecycle Inventory Distribution")).toBe(true);
    expect(md.includes("## 2. 🗂️ Content Lifecycle Inventory Overview")).toBe(true);
    expect(md.includes("## 3. 🎯 High-Value Refresh & Expansion Candidates")).toBe(true);
    expect(md.includes("## 6. ℹ️ Data Limitations & Governance Principles")).toBe(true);
  });
});
