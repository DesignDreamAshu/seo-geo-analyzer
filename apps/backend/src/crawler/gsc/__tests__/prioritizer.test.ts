/**
 * Technical Issue x GSC Prioritizer Test Suite
 * Tests search priority calculation, technical severity preservation, and systemic traffic deduplication.
 */

import { prioritizeTechnicalIssuesWithGsc } from "../prioritizer";
import { analyzeGscData } from "../engine";
import { DiagnosticIssue, CrawledPageData } from "../../types";
import { PageGscMetrics } from "../types";

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
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
  };
}

function createMockIssue(
  code: string,
  url: string,
  severity: "critical" | "warning" | "opportunity",
  isSystemic = false,
  additionalUrls: string[] = []
): DiagnosticIssue {
  const urls = [url, ...additionalUrls];
  return {
    id: `issue_${code}`,
    code,
    category: "content_relevance",
    severity,
    title: `Issue ${code}`,
    description: `Description for ${code}`,
    recommendation: `Fix ${code}`,
    confidence: "confirmed",
    confidenceScore: 1.0,
    impactScore: 5,
    affectedCount: urls.length,
    affectedOccurrences: urls.length,
    affectedUniquePages: urls.length,
    eligiblePageCount: 100,
    affectedRatio: urls.length / 100,
    isSystemicTemplateIssue: isSystemic,
    affectedPages: urls.map((u) => ({
      url: u,
      evidence: {
        observed: "Sample observed",
        sourceMode: "raw_http",
        sourceUrl: u,
        crawlTimestamp: new Date().toISOString(),
      },
    })),
  };
}

function createMockPageGsc(url: string, clicks: number, impressions: number, pos = 5.0): PageGscMetrics {
  return {
    gscUrl: url,
    normalizedGscUrl: url,
    matchedCrawlUrl: url,
    matchMethod: "EXACT",
    matchConfidence: 1.0,
    currentPeriod: {
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      averagePosition: pos,
      isComplete: true,
      daysCount: 28,
    },
    topQueries: [],
    isDeclining: false,
    hasCtrOpportunity: false,
    hasRankingOpportunity: false,
  };
}

describe("Technical Issue x GSC Search Prioritization Tests", () => {
  const gscPages: PageGscMetrics[] = [
    createMockPageGsc("https://www.example.com/urgent-traffic", 1500, 25000, 2.5),
    createMockPageGsc("https://www.example.com/high-traffic", 250, 4500, 3.2),
    createMockPageGsc("https://www.example.com/zero-traffic", 0, 0, 0),
    createMockPageGsc("https://www.example.com/blog/1", 100, 1200, 7.5),
    createMockPageGsc("https://www.example.com/blog/2", 150, 1800, 6.8),
    createMockPageGsc("https://www.example.com/blog/3", 200, 2500, 5.4),
  ];

  it("1. Technical Severity Preservation: Same rule on High-Traffic vs Zero-Traffic preserves identical technical severity", () => {
    const issueVeryHigh = createMockIssue("CONTENT_MISSING_H1", "https://www.example.com/urgent-traffic", "warning");
    const issueHigh = createMockIssue("CONTENT_MISSING_H1", "https://www.example.com/high-traffic", "warning");
    const issueZero = createMockIssue("CONTENT_MISSING_H1", "https://www.example.com/zero-traffic", "warning");

    const result = prioritizeTechnicalIssuesWithGsc([issueVeryHigh, issueHigh, issueZero], gscPages);

    const prioVeryHigh = result.prioritizedIssues.find((p) => p.issue.affectedPages[0].url.includes("urgent-traffic"));
    const prioHigh = result.prioritizedIssues.find((p) => p.issue.affectedPages[0].url.includes("high-traffic"));
    const prioZero = result.prioritizedIssues.find((p) => p.issue.affectedPages[0].url.includes("zero-traffic"));

    // All retain identical technical severity
    expect(prioVeryHigh?.issue.severity).toBe("warning");
    expect(prioHigh?.issue.severity).toBe("warning");
    expect(prioZero?.issue.severity).toBe("warning");

    // Search priorities reflect actual demand
    expect(prioVeryHigh?.searchPriority).toBe("VERY_HIGH_SEARCH_PRIORITY");
    expect(prioHigh?.searchPriority).toBe("HIGH_SEARCH_PRIORITY");
    expect(prioZero?.searchPriority).toBe("INFORMATIONAL");
  });

  it("2. Urgent Business Priority: High traffic (25k imps) + Critical indexability blocker elevates to URGENT_BUSINESS_PRIORITY", () => {
    const criticalIssue = createMockIssue("INDEX_NOINDEX_DIRECTIVE", "https://www.example.com/urgent-traffic", "critical");
    const result = prioritizeTechnicalIssuesWithGsc([criticalIssue], gscPages);
    const prioUrgent = result.prioritizedIssues[0];

    expect(prioUrgent.issue.severity).toBe("critical");
    expect(prioUrgent.searchPriority).toBe("URGENT_BUSINESS_PRIORITY");
    expect(prioUrgent.priorityRationale.includes("URGENT")).toBe(true);
  });

  it("3. Systemic Traffic Aggregation with Zero Double-Counting: 3 blog pages with 1200, 1800, 2500 imps aggregate to exact 5500 imps", () => {
    const systemicIssue = createMockIssue(
      "CONTENT_MISSING_H1",
      "https://www.example.com/blog/1",
      "warning",
      true,
      ["https://www.example.com/blog/2", "https://www.example.com/blog/3"]
    );

    const result = prioritizeTechnicalIssuesWithGsc([systemicIssue], gscPages);
    const groupPrio = result.systemicGroupPriorities[0];

    expect(groupPrio.affectedCount).toBe(3);
    expect(groupPrio.deduplicatedImpressions).toBe(5500); // 1200 + 1800 + 2500
    expect(groupPrio.deduplicatedClicks).toBe(450); // 100 + 150 + 200
    expect(groupPrio.searchPriority).toBe("HIGH_SEARCH_PRIORITY");
  });

  it("4. Anti-Dimension Inflation Invariant: 1 URL queried across 3 queries and 2 devices does not inflate page visibility", () => {
    const multiDimRows = [
      { page: "https://www.example.com/landing", query: "q1", device: "DESKTOP" as const, clicks: 10, impressions: 100, ctr: 0.1, position: 2.0 },
      { page: "https://www.example.com/landing", query: "q1", device: "MOBILE" as const, clicks: 15, impressions: 150, ctr: 0.1, position: 2.5 },
      { page: "https://www.example.com/landing", query: "q2", device: "DESKTOP" as const, clicks: 5, impressions: 50, ctr: 0.1, position: 4.0 },
      { page: "https://www.example.com/landing", query: "q2", device: "MOBILE" as const, clicks: 8, impressions: 80, ctr: 0.1, position: 4.2 },
      { page: "https://www.example.com/landing", query: "q3", device: "DESKTOP" as const, clicks: 2, impressions: 20, ctr: 0.1, position: 6.0 },
      { page: "https://www.example.com/landing", query: "q3", device: "MOBILE" as const, clicks: 4, impressions: 40, ctr: 0.1, position: 6.1 },
    ];

    const mockCrawl = [{ url: "https://www.example.com/landing", normalizedUrl: "https://www.example.com/landing", isIndexable: true }] as any as CrawledPageData[];

    const result = analyzeGscData({
      currentRows: multiDimRows,
      crawledPages: mockCrawl,
      currentPeriodStart: "2026-07-20",
      currentPeriodEnd: "2026-08-16",
    });

    // Total page impressions must equal exactly the sum of sub-dimension rows without duplicate multiplier
    const pageMetrics = result.pages[0];
    expect(pageMetrics.currentPeriod.impressions).toBe(440); // 100+150+50+80+20+40
    expect(pageMetrics.currentPeriod.clicks).toBe(44); // 10+15+5+8+2+4
    expect(result.pages.length).toBe(1); // Exactly 1 unique page record
  });
});
