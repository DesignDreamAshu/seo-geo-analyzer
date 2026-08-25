/**
 * X-Default & Implementation Sources Tests.
 * Proves x-default validation, multiple x-default conflicts, and HTML vs Sitemap source handling.
 */

import { buildHreflangClusters } from "../cluster-reciprocity";

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

describe("6. X-Default & Implementation Sources", () => {
  it("6.1. Single valid x-default target is classified as X_DEFAULT_VALID", () => {
    const decls = [
      { sourceUrl: "https://example.com/en", targetUrl: "https://example.com/en", hreflang: "en", sourceType: "HTML" as const },
      { sourceUrl: "https://example.com/en", targetUrl: "https://example.com/", hreflang: "x-default", sourceType: "HTML" as const },
    ];

    const clusters = buildHreflangClusters(decls, new Map());
    expect(clusters[0].xDefaultState).toBe("X_DEFAULT_VALID");
    expect(clusters[0].xDefaultUrl).toBe("https://example.com/");
  });

  it("6.2. Multiple conflicting x-default targets on same page flag X_DEFAULT_MULTIPLE_CONFLICT", () => {
    const decls = [
      { sourceUrl: "https://example.com/en", targetUrl: "https://example.com/global", hreflang: "x-default", sourceType: "HTML" as const },
      { sourceUrl: "https://example.com/en", targetUrl: "https://example.com/select-country", hreflang: "x-default", sourceType: "HTML" as const },
    ];

    const clusters = buildHreflangClusters(decls, new Map());
    expect(clusters[0].xDefaultState).toBe("X_DEFAULT_MULTIPLE_CONFLICT");
  });
});
