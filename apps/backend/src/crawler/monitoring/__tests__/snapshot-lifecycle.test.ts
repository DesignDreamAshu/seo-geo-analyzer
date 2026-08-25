/**
 * Deterministic Test Suite for Finding Lifecycle State Transitions.
 */

import { CrawlSnapshot } from "../types";
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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("Finding Lifecycle State Transitions", () => {
  const createMockSnapshot = (id: string, findings: any[] = [], pages: Record<string, any> = {}, ruleSetVer = "1.0.0"): CrawlSnapshot => ({
    snapshotId: id,
    projectId: "bot-consulting",
    rootDomain: "botconsulting.io",
    originUrl: "https://www.botconsulting.io",
    startedAt: "2026-08-20T10:00:00Z",
    completedAt: "2026-08-20T10:05:00Z",
    crawlerVersion: "1.0.0",
    ruleSetVersion: ruleSetVer,
    productionRuleCount: 95,
    configurationFingerprint: "cfg_prod_default",
    crawlScope: "full_site",
    isComplete: true,
    totalUrlsDiscovered: Object.keys(pages).length || 5,
    totalUrlsEvaluated: Object.keys(pages).length || 5,
    totalUrlsExcluded: 0,
    pages: pages,
    findings,
    robotsTxtContent: "User-agent: *\nAllow: /",
    sitemapUrls: ["https://www.botconsulting.io/sitemap.xml"],
  });

  it("1. PASS -> FAIL = NEW regression: finding absent in baseline and present in current is classified as NEW", () => {
    const base = createMockSnapshot("snap_01", [], {
      "https://www.botconsulting.io/about": { url: "https://www.botconsulting.io/about", statusCode: 200, isIndexable: true, title: "About Us", h1: "About Us", contentWordCount: 400 },
    });

    const curr = createMockSnapshot("snap_02", [
      { ruleCode: "CONTENT_MISSING_H1", url: "https://www.botconsulting.io/about", severity: "high", evidence: "No <h1> element found.", message: "Page lacks H1." },
    ], {
      "https://www.botconsulting.io/about": { url: "https://www.botconsulting.io/about", statusCode: 200, isIndexable: true, title: "About Us", h1: null, contentWordCount: 400 },
    });

    const res = auditSnapshotRegression(curr, base);
    expect(res.summary.totalNewRegressions).toBe(1);
    expect(res.findingChanges[0].lifecycle).toBe("NEW");
    expect(res.findingChanges[0].ruleCode).toBe("CONTENT_MISSING_H1");
  });

  it("2. FAIL -> FAIL = PERSISTING: finding present in both snapshots is marked as PERSISTING", () => {
    const finding = { ruleCode: "SEO_TITLE_TOO_SHORT", url: "https://www.botconsulting.io/pricing", severity: "medium", evidence: "Title is 12 chars.", message: "Title too short." };
    const base = createMockSnapshot("snap_01", [finding], { "https://www.botconsulting.io/pricing": { statusCode: 200 } });
    const curr = createMockSnapshot("snap_02", [finding], { "https://www.botconsulting.io/pricing": { statusCode: 200 } });

    const res = auditSnapshotRegression(curr, base);
    expect(res.summary.totalPersistingFindings).toBe(1);
    expect(res.findingChanges[0].lifecycle).toBe("PERSISTING");
  });

  it("3. FAIL -> PASS = RESOLVED: finding in baseline missing in current with evaluated page is RESOLVED", () => {
    const finding = { ruleCode: "LINK_BROKEN_INTERNAL", url: "https://www.botconsulting.io/services", severity: "high", evidence: "Broken href /old-link", message: "Broken link." };
    const base = createMockSnapshot("snap_01", [finding], { "https://www.botconsulting.io/services": { statusCode: 200 } });
    const curr = createMockSnapshot("snap_02", [], { "https://www.botconsulting.io/services": { statusCode: 200 } });

    const res = auditSnapshotRegression(curr, base);
    expect(res.summary.totalResolvedFindings).toBe(1);
    expect(res.findingChanges[0].lifecycle).toBe("RESOLVED");
  });

  it("4. FAIL -> PASS -> FAIL = REOPENED: recurring failure after historical resolution is REOPENED", () => {
    const finding = { ruleCode: "CANONICAL_POINTS_TO_4XX", url: "https://www.botconsulting.io/case-study", severity: "critical", evidence: "Canonical points to 404.", message: "Broken canonical." };
    const snap1 = createMockSnapshot("snap_01", [finding], { "https://www.botconsulting.io/case-study": { statusCode: 200 } });
    const snap2 = createMockSnapshot("snap_02", [], { "https://www.botconsulting.io/case-study": { statusCode: 200 } }); // resolved here
    const snap3 = createMockSnapshot("snap_03", [finding], { "https://www.botconsulting.io/case-study": { statusCode: 200 } }); // reopened here

    const res = auditSnapshotRegression(snap3, snap2, "PREVIOUS_SUCCESSFUL", [snap1]);
    expect(res.summary.totalReopenedRegressions).toBe(1);
    expect(res.findingChanges[0].lifecycle).toBe("REOPENED");
  });

  it("5. Newly Added Rule = NEWLY_DETECTABLE: rule introduced in new rule-set version is not classified as site regression", () => {
    const base = createMockSnapshot("snap_01", [], {}, "1.0.0");
    const curr = createMockSnapshot("snap_02", [
      { ruleCode: "NEW_SPECIALIZED_RULE_96", url: "https://www.botconsulting.io/test", severity: "medium", evidence: "Specialized check.", message: "New rule." },
    ], {}, "1.1.0");

    const res = auditSnapshotRegression(curr, base);
    expect(res.summary.totalNewlyDetectable).toBe(1);
    expect(res.summary.totalNewRegressions).toBe(0); // NOT a site regression
    expect(res.findingChanges[0].lifecycle).toBe("NEWLY_DETECTABLE");
  });

  it("6. Missing URL Safeguard: finding on unevaluated URL is NOT_EVALUATED, not RESOLVED", () => {
    const finding = { ruleCode: "SCHEMA_JSON_LD_MALFORMED", url: "https://www.botconsulting.io/unvisited-page", severity: "high", evidence: "JSON error.", message: "Malformed schema." };
    const base = createMockSnapshot("snap_01", [finding], { "https://www.botconsulting.io/unvisited-page": { statusCode: 200 } });
    const curr = createMockSnapshot("snap_02", [], {}); // Page absent from current crawl

    const res = auditSnapshotRegression(curr, base);
    expect(res.summary.totalResolvedFindings).toBe(0); // NOT falsely marked as resolved
    expect(res.findingChanges[0].lifecycle).toBe("NOT_EVALUATED");
  });
});
