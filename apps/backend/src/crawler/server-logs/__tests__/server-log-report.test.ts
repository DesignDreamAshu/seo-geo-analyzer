/**
 * Search Bot Crawl Intelligence Report Serializer Tests.
 * Proves generation of complete, structured Markdown reports with dataset quality,
 * bot overview, important page coverage, status distribution, and limitations.
 */

import { analyzeServerLogIntelligence } from "../engine";
import { serializeServerLogReportMarkdown } from "../report-serializer";

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

describe("8. Search Bot Crawl Intelligence Report Serializer", () => {
  it("8.1. Serializes complete Markdown report with all essential sections", async () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /services/cmdb HTTP/1.1" 200 5200 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
      '66.249.66.1 - - [21/Aug/2026:10:01:00 +0000] "GET /old-pricing HTTP/1.1" 301 0 "-" "Googlebot/2.1"',
    ];

    const { report } = await analyzeServerLogIntelligence({
      projectId: "bot-consulting",
      defaultHost: "botconsulting.io",
      logLines: lines,
      provider: "NGINX_APACHE",
      knownUrls: [{ url: "https://botconsulting.io/services/cmdb/", isIndexable: true, isImportant: true, importanceReasons: ["CORE_SERVICE_PAGE"] }],
    });

    const md = serializeServerLogReportMarkdown(report);

    expect(md.includes("# SEARCH BOT CRAWL INTELLIGENCE REPORT")).toBe(true);
    expect(md.includes("## 1. 📊 Dataset Quality, Adapter State & Bot Verification")).toBe(true);
    expect(md.includes("## 2. 🤖 Search Engine & AI Crawler Observations")).toBe(true);
    expect(md.includes("## 3. 🎯 Important Page Crawl Coverage")).toBe(true);
    expect(md.includes("## 4. 📈 Crawl Efficiency & Status Distribution")).toBe(true);
    expect(md.includes("## 9. ℹ️ Data Limitations & Governance Principles")).toBe(true);
  });
});
