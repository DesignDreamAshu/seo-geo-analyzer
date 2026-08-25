/**
 * Alternate Cluster & Reciprocal Graph Tests.
 * Proves complete cluster verification, missing return link detection, and duplicate locale checks.
 */

import { buildHreflangClusters, RawHreflangDeclaration } from "../cluster-reciprocity";

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

describe("3. Alternate Clusters & Reciprocal Graph", () => {
  it("3.1. Complete reciprocal cluster is classified as COMPLETE_CLUSTER and HREFLANG_RECIPROCAL", () => {
    const decls: RawHreflangDeclaration[] = [
      // Page US
      { sourceUrl: "https://example.com/en-us", targetUrl: "https://example.com/en-us", hreflang: "en-US", sourceType: "HTML" },
      { sourceUrl: "https://example.com/en-us", targetUrl: "https://example.com/fr-fr", hreflang: "fr-FR", sourceType: "HTML" },
      // Page FR
      { sourceUrl: "https://example.com/fr-fr", targetUrl: "https://example.com/fr-fr", hreflang: "fr-FR", sourceType: "HTML" },
      { sourceUrl: "https://example.com/fr-fr", targetUrl: "https://example.com/en-us", hreflang: "en-US", sourceType: "HTML" },
    ];

    const clusters = buildHreflangClusters(decls, new Map());
    expect(clusters.length).toBe(1);
    expect(clusters[0].reciprocityState).toBe("HREFLANG_RECIPROCAL");
    expect(clusters[0].completenessState).toBe("COMPLETE_CLUSTER");
  });

  it("3.2. Missing reciprocal return link on target page is flagged accurately", () => {
    const decls: RawHreflangDeclaration[] = [
      // Page US declares FR
      { sourceUrl: "https://example.com/en-us", targetUrl: "https://example.com/en-us", hreflang: "en-US", sourceType: "HTML" },
      { sourceUrl: "https://example.com/en-us", targetUrl: "https://example.com/fr-fr", hreflang: "fr-FR", sourceType: "HTML" },
      // Page FR only declares self (missing US return link)
      { sourceUrl: "https://example.com/fr-fr", targetUrl: "https://example.com/fr-fr", hreflang: "fr-FR", sourceType: "HTML" },
    ];

    const clusters = buildHreflangClusters(decls, new Map());
    expect(clusters.length).toBe(1);
    expect(clusters[0].reciprocityState).toBe("HREFLANG_RETURN_LINK_MISSING");
  });

  it("3.3. Duplicate locale declarations on same page (e.g. two en-US targets) flag conflict", () => {
    const decls: RawHreflangDeclaration[] = [
      { sourceUrl: "https://example.com/en", targetUrl: "https://example.com/us-1", hreflang: "en-US", sourceType: "HTML" },
      { sourceUrl: "https://example.com/en", targetUrl: "https://example.com/us-2", hreflang: "en-US", sourceType: "HTML" },
    ];

    const clusters = buildHreflangClusters(decls, new Map());
    expect(clusters[0].hasDuplicateLocaleTargets).toBe(true);
    expect(clusters[0].duplicateLocaleDetails?.[0].includes("multiple targets for locale 'en-US'")).toBe(true);
  });
});
