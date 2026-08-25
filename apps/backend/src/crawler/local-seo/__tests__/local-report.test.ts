/**
 * Local SEO Report Serializer Tests.
 * Verifies full Markdown generation containing all executive and location dimensions.
 */

import { analyzeLocalSeoIntelligence } from "../engine";
import { serializeLocalSeoReportMarkdown } from "../report-serializer";

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

describe("9. Local SEO Report Serializer", () => {
  it("9.1. Generates structured Markdown report with all sections", async () => {
    const { report } = await analyzeLocalSeoIntelligence({
      projectId: "bot-consulting",
      targetDomain: "botconsulting.io",
      projectContext: {
        configuredLocations: [
          {
            locationId: "loc_jpr",
            projectId: "bot-consulting",
            businessName: "BOT Consulting",
            locationName: "Jaipur HQ",
            address: { streetAddress: "MI Road", addressLocality: "Jaipur", postalCode: "302001" },
            phone: "+91 98765 43210",
            locationType: "PHYSICAL_LOCATION",
            canonicalLocationUrl: "https://www.botconsulting.io/locations/jaipur",
            provenance: { source: "CONFIGURED", retrievedAt: "" },
          },
        ],
      },
    });

    const md = serializeLocalSeoReportMarkdown(report);
    expect(md.includes("# LOCAL SEO & LOCATION INTELLIGENCE")).toBe(true);
    expect(md.includes("## 1. Executive Summary & Location Inventory")).toBe(true);
    expect(md.includes("## 2. 📍 Business Locations & Branch Details")).toBe(true);
    expect(md.includes("## 3. 📞 NAP Consistency & Verification")).toBe(true);
    expect(md.includes("## 4. 📄 Location Pages & Quality Review")).toBe(true);
    expect(md.includes("## 5. 🏷️ Local Structured Data & Entity Alignment")).toBe(true);
    expect(md.includes("## 6. 🏢 Google Business Profile Alignment & Reviews")).toBe(true);
    expect(md.includes("## 7. 🗺️ Local Pack Observations")).toBe(true);
    expect(md.includes("## 8. 📚 Citation Evidence & Local Directories")).toBe(true);
    expect(md.includes("## 9. ℹ️ Data Limitations & Governance Principles")).toBe(true);
    expect(md.includes("Snapshot immutability is guaranteed at runtime via Object.freeze.")).toBe(true);
  });
});
