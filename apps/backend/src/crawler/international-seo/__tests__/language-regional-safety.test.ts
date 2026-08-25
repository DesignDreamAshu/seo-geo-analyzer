/**
 * Language Alignment & Regional Variant Safety Tests.
 * Proves content-language mismatch detection, bilingual safety, and protection of high-similarity regional variants.
 */

import { evaluateLanguageAlignment, evaluateRegionalVariants } from "../language-regional-safety";

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

describe("5. Language Alignment & Regional Variant Safety", () => {
  it("5.1. French hreflang with English body text flags HREFLANG_CONTENT_LANGUAGE_MISMATCH", () => {
    const res = evaluateLanguageAlignment({
      url: "https://example.com/fr/services",
      locale: "fr-FR",
      detectedLanguage: "en",
      htmlLang: "fr",
      bodyText: "Enterprise IT consulting and ServiceNow services.",
    });

    expect(res.alignmentState).toBe("HREFLANG_CONTENT_LANGUAGE_MISMATCH");
  });

  it("5.2. en-US vs en-GB with 92% similarity and currency/shipping differences is protected as VALID_REGIONAL_VARIANT", () => {
    const pageUS = {
      url: "https://example.com/en-us/product",
      locale: "en-US",
      currencySymbolsObserved: ["$"],
      regionalKeywordsObserved: ["free US delivery"],
    };

    const pageUK = {
      url: "https://example.com/en-gb/product",
      locale: "en-GB",
      currencySymbolsObserved: ["£"],
      regionalKeywordsObserved: ["next day UK delivery"],
    };

    const reviews = evaluateRegionalVariants([{ page1: pageUS, page2: pageUK, similarity: 0.92 }]);
    expect(reviews.length).toBe(1);
    expect(reviews[0].classification).toBe("VALID_REGIONAL_VARIANT");
    expect(reviews[0].rationale.includes("Protected from duplicate content penalties")).toBe(true);
  });
});
