/**
 * GSC Opportunity Detection Test Suite
 * Tests high-impression/low-CTR and near-page-one ranking opportunity discovery with volume guards.
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
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
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

describe("GSC Opportunity Detection Tests", () => {
  const crawlPages = [
    createMockPage("https://www.example.com/high-imp-low-ctr"),
    createMockPage("https://www.example.com/near-page-one"),
    createMockPage("https://www.example.com/page-two-striking"),
    createMockPage("https://www.example.com/low-volume"),
  ];

  it("1. High Impression + Low CTR: position 2.5 with 2000 impressions and only 0.8% CTR triggers HIGH_IMPRESSION_LOW_CTR", () => {
    const currentRows = [
      { page: "https://www.example.com/high-imp-low-ctr", query: "enterprise ai", clicks: 16, impressions: 2000, ctr: 0.008, position: 2.5 },
    ];

    const result = analyzeGscData({
      currentRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
    });

    const ctrOpp = result.opportunities.find((o) => o.type === "HIGH_IMPRESSION_LOW_CTR");
    expect(ctrOpp).toBeTruthy();
    expect(ctrOpp?.identifier).toBe("https://www.example.com/high-imp-low-ctr");
    expect(ctrOpp?.priority).toBe("high");
    expect(ctrOpp?.estimatedClickGain).toBeGreaterThan(100);
  });

  it("2. Near-Page-One Ranking Opportunity: position 6.5 with 800 impressions triggers NEAR_PAGE_ONE_RANKING", () => {
    const currentRows = [
      { page: "https://www.example.com/near-page-one", query: "servicenow consulting", clicks: 25, impressions: 800, ctr: 0.031, position: 6.5 },
    ];

    const result = analyzeGscData({
      currentRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
    });

    const rankOpp = result.opportunities.find((o) => o.type === "NEAR_PAGE_ONE_RANKING");
    expect(rankOpp).toBeTruthy();
    expect(rankOpp?.identifier).toBe("https://www.example.com/near-page-one");
  });

  it("3. Page Two Striking Distance: position 14.2 with 600 impressions triggers HIGH_POTENTIAL_STRIKING_DISTANCE", () => {
    const currentRows = [
      { page: "https://www.example.com/page-two-striking", query: "digital workflows", clicks: 6, impressions: 600, ctr: 0.01, position: 14.2 },
    ];

    const result = analyzeGscData({
      currentRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
    });

    const strikeOpp = result.opportunities.find((o) => o.type === "HIGH_POTENTIAL_STRIKING_DISTANCE");
    expect(strikeOpp).toBeTruthy();
  });

  it("4. Low-Volume Suppression: position 8.0 with only 12 impressions does NOT trigger false opportunity", () => {
    const currentRows = [
      { page: "https://www.example.com/low-volume", query: "obscure term", clicks: 0, impressions: 12, ctr: 0.0, position: 8.0 },
    ];

    const result = analyzeGscData({
      currentRows,
      crawledPages: crawlPages,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
    });

    expect(result.opportunities.length).toBe(0);
  });
});
