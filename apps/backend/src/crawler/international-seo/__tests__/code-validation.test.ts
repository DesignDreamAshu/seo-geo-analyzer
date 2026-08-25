/**
 * BCP 47 & Hreflang Code Validation Tests.
 * Proves standards-compliant language-region validation and rejection of reversed/malformed codes.
 */

import { validateHreflangCode } from "../code-validator";

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

describe("2. BCP 47 & Hreflang Code Validation", () => {
  it("2.1. Validates standard language-only, language-region, and x-default codes", () => {
    expect(validateHreflangCode("en").isValid).toBe(true);
    expect(validateHreflangCode("en-US").isValid).toBe(true);
    expect(validateHreflangCode("fr-FR").isValid).toBe(true);
    expect(validateHreflangCode("de-DE").isValid).toBe(true);
    expect(validateHreflangCode("x-default").isValid).toBe(true);
    expect(validateHreflangCode("zh-Hans").isValid).toBe(true);
  });

  it("2.2. Rejects reversed format codes (e.g. US-en, GB-en) with descriptive guidance", () => {
    const res = validateHreflangCode("US-en");
    expect(res.isValid).toBe(false);
    expect(res.issueDescription?.includes("Reversed hreflang format")).toBe(true);
  });

  it("2.3. Rejects malformed and invalid language codes", () => {
    expect(validateHreflangCode("").isValid).toBe(false);
    expect(validateHreflangCode("invalidlang").isValid).toBe(false);
    expect(validateHreflangCode("en-invalidcountry").isValid).toBe(false);
  });
});
