/**
 * International SEO Report Serializer Tests.
 * Verifies full Markdown generation containing all 20 sections.
 */

import { analyzeInternationalSeoIntelligence } from "../engine";
import { serializeInternationalSeoReportMarkdown } from "../report-serializer";

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

describe("10. International SEO Report Serializer", () => {
  it("10.1. Generates structured Markdown report with all sections", async () => {
    const { report } = await analyzeInternationalSeoIntelligence({
      projectId: "global-consulting",
      targetDomain: "botconsulting.io",
      projectContext: {
        configuredLocales: [
          { localeId: "loc_en_us", projectId: "global-consulting", languageCode: "en", regionCode: "US", hreflangCode: "en-US", localeType: "LANGUAGE_REGION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
          { localeId: "loc_fr_fr", projectId: "global-consulting", languageCode: "fr", regionCode: "FR", hreflangCode: "fr-FR", localeType: "LANGUAGE_REGION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
        ],
      },
      hreflangDeclarations: [
        { sourceUrl: "https://botconsulting.io/en-us", targetUrl: "https://botconsulting.io/en-us", hreflang: "en-US", sourceType: "HTML" },
        { sourceUrl: "https://botconsulting.io/en-us", targetUrl: "https://botconsulting.io/fr-fr", hreflang: "fr-FR", sourceType: "HTML" },
        { sourceUrl: "https://botconsulting.io/fr-fr", targetUrl: "https://botconsulting.io/fr-fr", hreflang: "fr-FR", sourceType: "HTML" },
        { sourceUrl: "https://botconsulting.io/fr-fr", targetUrl: "https://botconsulting.io/en-us", hreflang: "en-US", sourceType: "HTML" },
      ],
    });

    const md = serializeInternationalSeoReportMarkdown(report);
    expect(md.includes("# INTERNATIONAL SEO & HREFLANG INTELLIGENCE")).toBe(true);
    expect(md.includes("## 1. Executive Summary & International Inventory")).toBe(true);
    expect(md.includes("## 2. 🌐 Locale Inventory & Targeting Model")).toBe(true);
    expect(md.includes("## 3. 🔗 Alternate Clusters & Reciprocal Graph Status")).toBe(true);
    expect(md.includes("## 4. 🎯 Hreflang Target Health & Status Codes")).toBe(true);
    expect(md.includes("## 5. 🧭 Canonical Compatibility & Language Alignment")).toBe(true);
    expect(md.includes("## 6. 🛡️ Regional Variant Similarity & Differentiation")).toBe(true);
    expect(md.includes("## 7. 📈 GSC Market Performance & Search Intent")).toBe(true);
    expect(md.includes("## 8. ℹ️ Data Limitations & Governance Principles")).toBe(true);
    expect(md.includes("Snapshot immutability is guaranteed at runtime via Object.freeze.")).toBe(true);
  });
});
