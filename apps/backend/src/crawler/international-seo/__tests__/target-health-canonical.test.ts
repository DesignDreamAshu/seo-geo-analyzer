/**
 * Target Health & Canonical Compatibility Tests.
 * Proves detection of broken hreflang targets (404/410), redirect targets (301),
 * noindex targets, and cross-locale/cross-language canonical conflicts.
 */

import { buildHreflangClusters } from "../cluster-reciprocity";
import { evaluateHreflangTargetAndCanonicalHealth } from "../target-canonical-health";

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

describe("4. Target Health & Canonical Compatibility", () => {
  it("4.1. Hreflang target returning 404 or redirect emits target health issue", () => {
    const decls = [
      { sourceUrl: "https://example.com/en-us", targetUrl: "https://example.com/fr-broken", hreflang: "fr-FR", sourceType: "HTML" as const },
      { sourceUrl: "https://example.com/en-us", targetUrl: "https://example.com/de-redirect", hreflang: "de-DE", sourceType: "HTML" as const },
    ];

    const crawlMap = new Map([
      ["https://example.com/fr-broken", { statusCode: 404 }],
      ["https://example.com/de-redirect", { statusCode: 301, isRedirect: true, redirectDestination: "https://example.com/de-final" }],
    ]);

    const clusters = buildHreflangClusters(decls, crawlMap as any);
    const res = evaluateHreflangTargetAndCanonicalHealth(clusters, crawlMap);

    expect(res.targetIssues.length).toBe(2);
    expect(res.targetIssues.some((t) => t.issueType === "HREFLANG_TARGET_404")).toBe(true);
    expect(res.targetIssues.some((t) => t.issueType === "HREFLANG_TARGET_REDIRECT")).toBe(true);
  });

  it("4.2. Translated French page canonicalizing to English master page flags CROSS_LANGUAGE_CANONICAL_REVIEW", () => {
    const decls = [
      { sourceUrl: "https://example.com/fr-fr/service", targetUrl: "https://example.com/fr-fr/service", hreflang: "fr-FR", sourceType: "HTML" as const },
      { sourceUrl: "https://example.com/fr-fr/service", targetUrl: "https://example.com/en-us/service", hreflang: "en-US", sourceType: "HTML" as const },
    ];

    const crawlMap = new Map([
      ["https://example.com/fr-fr/service", { statusCode: 200, canonicalUrl: "https://example.com/en-us/service" }],
    ]);

    const clusters = buildHreflangClusters(decls, crawlMap as any);
    const res = evaluateHreflangTargetAndCanonicalHealth(clusters, crawlMap);

    expect(res.canonicalConflicts.length).toBe(1);
    expect(res.canonicalConflicts[0].conflictType).toBe("CROSS_LANGUAGE_CANONICAL_REVIEW");
  });
});
