/**
 * GSC Decline Detection Test Suite
 * Tests material decline detection with strict volume safeguards and incomplete period guards.
 */

import { analyzeGscData } from "../engine";
import { CrawledPageData } from "../../types";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void) {
  try {
    fn();
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
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
  };
}

function createMockPage(url: string): CrawledPageData {
  return {
    url,
    requestedUrl: url,
    normalizedUrl: url,
    finalUrl: url,
    statusCode: 200,
    redirectHops: [],
    contentType: "text/html",
    resourceType: "html",
    responseTimeMs: 200,
    depth: 1,
    html: "<html></html>",
    headers: {},
    crawledAt: new Date().toISOString(),
    sourceMode: "raw_http",
    renderMode: "static_http",
    renderConfidence: "definitive",
    rawWordCount: 500,
    rawDocumentWordCount: 500,
    canonicalUrl: url,
    isIndexable: true,
    indexabilityStatus: "INDEXABLE",
    classification: { primaryClass: "static_marketing", confidence: 1.0, secondaryClasses: [] },
    outlinks: [],
    inlinks: [],
    images: [],
    scripts: [],
    stylesheets: [],
    headingsOutline: [],
    forms: [],
    landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
    hasHtmlDoctype: true,
    hasTitle: true,
    hasMetaDescription: true,
    hasCanonical: true,
    robotsDirectives: { hasNoindex: false, hasNofollow: false, hasNone: false, hasNoarchive: false, hasNosnippet: false },
  } as any as CrawledPageData;
}

describe("GSC Decline Detection & Volume Safeguards Tests", () => {
  const crawlPages = [
    createMockPage("https://www.example.com/high-traffic"),
    createMockPage("https://www.example.com/tiny-traffic"),
    createMockPage("https://www.example.com/stable-page"),
    createMockPage("https://www.example.com/incomplete-period"),
  ];

  it("1. Material Page Decline: 500 clicks -> 250 clicks (50% drop, > 50 prev imps) triggers decline finding", () => {
    const currentRows = [
      { page: "https://www.example.com/high-traffic", query: "services", clicks: 250, impressions: 5000, ctr: 0.05, position: 4.5 },
    ];
    const comparisonRows = [
      { page: "https://www.example.com/high-traffic", query: "services", clicks: 500, impressions: 6000, ctr: 0.083, position: 3.2 },
    ];

    const result = analyzeGscData({
      currentRows,
      comparisonRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
      comparisonPeriodStart: "2026-06-22",
      comparisonPeriodEnd: "2026-07-19",
    });

    expect(result.declines.length).toBe(2); // 1 page decline + 1 query decline
    const pageDecline = result.declines.find((d) => d.entityType === "page");
    expect(pageDecline?.identifier).toBe("https://www.example.com/high-traffic");
    expect(pageDecline?.clickDropPercent).toBe(50);
    expect(pageDecline?.severity).toBe("high");
  });

  it("2. Volume Safeguard: 2 clicks -> 1 click (50% drop, but only 10 prev imps) is SUPPRESSED", () => {
    const currentRows = [
      { page: "https://www.example.com/tiny-traffic", query: "niche", clicks: 1, impressions: 5, ctr: 0.2, position: 15.0 },
    ];
    const comparisonRows = [
      { page: "https://www.example.com/tiny-traffic", query: "niche", clicks: 2, impressions: 10, ctr: 0.2, position: 14.5 },
    ];

    const result = analyzeGscData({
      currentRows,
      comparisonRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
      comparisonPeriodStart: "2026-06-22",
      comparisonPeriodEnd: "2026-07-19",
    });

    expect(result.declines.length).toBe(0);
  });

  it("3. Volume Safeguard: 1 impression -> 0 impressions is SUPPRESSED", () => {
    const currentRows: any[] = [];
    const comparisonRows = [
      { page: "https://www.example.com/tiny-traffic", query: "rare", clicks: 0, impressions: 1, ctr: 0.0, position: 45.0 },
    ];

    const result = analyzeGscData({
      currentRows,
      comparisonRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
      comparisonPeriodStart: "2026-06-22",
      comparisonPeriodEnd: "2026-07-19",
    });

    expect(result.declines.length).toBe(0);
  });

  it("4. Incomplete Period Safeguard: partial 5-day period marks trend INCONCLUSIVE without false decline", () => {
    const currentRows = [
      { page: "https://www.example.com/incomplete-period", query: "testing", clicks: 50, impressions: 1000, ctr: 0.05, position: 4.0 },
    ];
    const comparisonRows = [
      { page: "https://www.example.com/incomplete-period", query: "testing", clicks: 500, impressions: 10000, ctr: 0.05, position: 4.0 },
    ];

    const result = analyzeGscData({
      currentRows,
      comparisonRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-08-12",
      currentPeriodEnd: "2026-08-16", // Only 5 days!
      isCurrentPeriodComplete: false,
      comparisonPeriodStart: "2026-07-15",
      comparisonPeriodEnd: "2026-08-11", // 28 days
      isComparisonPeriodComplete: true,
    });

    // Must be suppressed from confident decline alerts
    expect(result.declines.length).toBe(0);
    const p = result.pages.find((pg) => pg.gscUrl.includes("incomplete-period"));
    expect(p?.isTrendInconclusive).toBe(true);
  });
});
