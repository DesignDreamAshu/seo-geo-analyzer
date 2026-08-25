/**
 * Test Suite for Phase 9 Master Report Serialization & Contract Completeness.
 */

import { parsePageHtml } from "../../parser";
import { auditPageForAiSearch, serializeGeoAeoReportSection } from "../engine";

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

describe("Phase 9 Master Report Serialization & Remediation Completeness", () => {
  it("1. Master Report Markdown Generation: outputs complete structured section with qualitative grades", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>ServiceNow CMDB Guide | BOT Consulting</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "ServiceNow CMDB Guide",
              "author": { "@type": "Person", "name": "Sarah Chen" }
            }
          </script>
        </head>
        <body>
          <main>
            <h1>ServiceNow CMDB Guide</h1>
            <h2>What is ServiceNow CMDB?</h2>
            <p>A Configuration Management Database is a centralized architectural database that stores full information about hardware and systems across an enterprise.</p>
          </main>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/blog/cmdb-guide");
    const robotsTxt = `
      User-agent: GPTBot
      Disallow: /

      User-agent: OAI-SearchBot
      Disallow: /
    `;

    const auditResult = auditPageForAiSearch(parsed, robotsTxt);
    const md = serializeGeoAeoReportSection(auditResult);

    expect(md.includes("## GEO / AEO / AI SEARCH INTELLIGENCE")).toBe(true);
    expect(md.includes("Crawl & Retrieval Readiness")).toBe(true);
    expect(md.includes("Structural Extractability")).toBe(true);
    expect(md.includes("Entity Clarity")).toBe(true);
    expect(md.includes("External AI Visibility")).toBe(true);
    expect(md.includes("AI_VISIBILITY_NOT_MEASURED")).toBe(true);
    expect(md.includes("OAI-SearchBot")).toBe(true);
    expect(md.includes("GPTBot")).toBe(true);

    // Verify Remediation Contract completeness on findings
    for (const f of auditResult.findings) {
      expect(f.signalCode).toBeTruthy();
      expect(f.evidenceClass).toBeTruthy();
      expect(f.whereToFix.length).toBeGreaterThanOrEqual(5);
      expect(f.remediation.length).toBeGreaterThanOrEqual(10);
      expect(f.verification.length).toBeGreaterThanOrEqual(10);
    }
  });
});
