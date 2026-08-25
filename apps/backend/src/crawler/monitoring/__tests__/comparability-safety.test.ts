/**
 * Test Suite for Crawl Comparability Gate & Safety Safeguards.
 */

import { CrawlSnapshot } from "../types";
import { evaluateCrawlComparability } from "../comparability";
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

describe("Crawl Comparability Gate & Safety Safeguards", () => {
  const createMockSnapshot = (id: string, domain = "botconsulting.io", isComplete = true, evaluatedCount = 50): CrawlSnapshot => ({
    snapshotId: id,
    projectId: "bot-consulting",
    rootDomain: domain,
    originUrl: `https://www.${domain}`,
    startedAt: "2026-08-20T10:00:00Z",
    completedAt: "2026-08-20T10:05:00Z",
    crawlerVersion: "1.0.0",
    ruleSetVersion: "1.0.0",
    productionRuleCount: 95,
    configurationFingerprint: "cfg_prod",
    crawlScope: "full_site",
    isComplete,
    totalUrlsDiscovered: evaluatedCount,
    totalUrlsEvaluated: evaluatedCount,
    totalUrlsExcluded: 0,
    pages: Object.fromEntries(Array.from({ length: evaluatedCount }, (_, i) => [`https://www.${domain}/page-${i}`, { statusCode: 200, isIndexable: true }])),
    findings: [],
    robotsTxtContent: "User-agent: *\nAllow: /",
    sitemapUrls: [`https://www.${domain}/sitemap.xml`],
  });

  it("1. Root Domain Mismatch: cross-domain comparison is NOT_COMPARABLE", () => {
    const base = createMockSnapshot("snap_01", "botconsulting.io");
    const curr = createMockSnapshot("snap_02", "apexconsulting.io");

    const comp = evaluateCrawlComparability(base, curr);
    expect(comp.status).toBe("NOT_COMPARABLE");
    expect(comp.isComparable).toBe(false);
  });

  it("2. Incomplete Crawl Gate: interrupted crawl is flagged with warnings and prevents false deletion claims", () => {
    const base = createMockSnapshot("snap_01", "botconsulting.io", true, 50);
    const curr = createMockSnapshot("snap_02", "botconsulting.io", false, 5); // Incomplete 5 URLs

    const comp = evaluateCrawlComparability(base, curr);
    expect(comp.status === "PARTIALLY_COMPARABLE" || comp.status === "NOT_COMPARABLE").toBe(true);

    const auditRes = auditSnapshotRegression(curr, base);
    // Verifies that missing 45 URLs are classified as POSSIBLY_REMOVED, not confirmed REMOVED
    const removedPage = auditRes.pageChanges.find((p) => p.url === "https://www.botconsulting.io/page-40");
    expect(removedPage?.lifecycle).toBe("POSSIBLY_REMOVED");
  });

  it("3. Identical Crawls: complete snapshots with equal scope evaluate as COMPARABLE", () => {
    const base = createMockSnapshot("snap_01", "botconsulting.io", true, 50);
    const curr = createMockSnapshot("snap_02", "botconsulting.io", true, 50);

    const comp = evaluateCrawlComparability(base, curr);
    expect(comp.status).toBe("COMPARABLE");
    expect(comp.isComparable).toBe(true);
    expect(comp.checks.every((c) => c.satisfied)).toBe(true);
  });
});
