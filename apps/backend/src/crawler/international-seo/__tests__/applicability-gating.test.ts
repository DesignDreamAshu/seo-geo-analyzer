/**
 * International SEO Applicability Gating & Non-International Safety Tests.
 * Proves gating for single-market, multi-market, multilingual, and global properties,
 * verifying zero false hreflang/x-default defects on single-market sites.
 */

import { determineInternationalApplicability } from "../applicability";
import { analyzeInternationalSeoIntelligence } from "../engine";

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

describe("1. International SEO Applicability Gating & Safety", () => {
  it("1.1. Single language, single market site produces zero false hreflang defects", async () => {
    const res = await analyzeInternationalSeoIntelligence({
      projectId: "domestic-site",
      targetDomain: "domesticsite.com",
    });

    expect(res.report.applicability).toBe("SINGLE_LANGUAGE_SINGLE_MARKET");
    expect(res.report.totalObservedAlternatesCount).toBe(0);
    expect(res.actions.length).toBe(0); // Zero actions generated
  });

  it("1.2. Multilingual multi-market site classified accurately", () => {
    const res = determineInternationalApplicability({
      configuredLocales: [
        { localeId: "1", projectId: "p1", languageCode: "en", regionCode: "US", hreflangCode: "en-US", localeType: "LANGUAGE_REGION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
        { localeId: "2", projectId: "p1", languageCode: "fr", regionCode: "FR", hreflangCode: "fr-FR", localeType: "LANGUAGE_REGION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
      ],
    });

    expect(res.applicability).toBe("MULTILINGUAL_MULTI_MARKET");
    expect(res.isInternationalApplicable).toBe(true);
  });

  it("1.3. Single language multi-market site (e.g. en-US, en-GB, en-AU) classified accurately", () => {
    const res = determineInternationalApplicability({
      configuredLocales: [
        { localeId: "1", projectId: "p1", languageCode: "en", regionCode: "US", hreflangCode: "en-US", localeType: "LANGUAGE_REGION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
        { localeId: "2", projectId: "p1", languageCode: "en", regionCode: "GB", hreflangCode: "en-GB", localeType: "LANGUAGE_REGION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
      ],
    });

    expect(res.applicability).toBe("SINGLE_LANGUAGE_MULTI_MARKET");
    expect(res.isInternationalApplicable).toBe(true);
  });
});
