/**
 * Test Suite for URL Lifecycle & Content Regressions.
 */

import { auditSnapshotRegression } from "../engine";

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

describe("URL Lifecycle & Content Regressions", () => {
  const baseSnap: any = {
    snapshotId: "snap_01",
    projectId: "bot-consulting",
    rootDomain: "botconsulting.io",
    originUrl: "https://www.botconsulting.io",
    isComplete: true,
    pages: {
      "https://www.botconsulting.io/about": { url: "https://www.botconsulting.io/about", statusCode: 200, isIndexable: true, canonicalUrl: "https://www.botconsulting.io/about", contentWordCount: 800 },
      "https://www.botconsulting.io/pricing": { url: "https://www.botconsulting.io/pricing", statusCode: 200, isIndexable: true, canonicalUrl: "https://www.botconsulting.io/pricing", contentWordCount: 600 },
    },
    findings: [],
  };

  it("1. Status Change (200 -> 404) & Indexability Change (indexable -> noindex): flags critical page changes", () => {
    const currSnap: any = {
      ...baseSnap,
      snapshotId: "snap_02",
      pages: {
        "https://www.botconsulting.io/about": { url: "https://www.botconsulting.io/about", statusCode: 404, isIndexable: false, canonicalUrl: null, contentWordCount: 20 },
        "https://www.botconsulting.io/pricing": { url: "https://www.botconsulting.io/pricing", statusCode: 200, isIndexable: false, canonicalUrl: "https://www.botconsulting.io/pricing", contentWordCount: 600 },
      },
    };

    const res = auditSnapshotRegression(currSnap, baseSnap);

    const aboutChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/about");
    expect(aboutChange?.lifecycle).toBe("STATUS_CHANGED");
    expect(aboutChange?.statusCodeChange?.previous).toBe(200);
    expect(aboutChange?.statusCodeChange?.current).toBe(404);
    expect(aboutChange?.contentLossDetected).toBe(true); // 800 words down to 20

    const pricingChange = res.pageChanges.find((p) => p.url === "https://www.botconsulting.io/pricing");
    expect(pricingChange?.lifecycle).toBe("INDEXABILITY_CHANGED");
    expect(pricingChange?.indexabilityChange?.previous).toBe(true);
    expect(pricingChange?.indexabilityChange?.current).toBe(false);
  });
});
