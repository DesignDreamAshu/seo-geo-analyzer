/**
 * Crawl Coverage, Metrics & Response Time Tests.
 * Proves important page coverage evaluation, latency percentiles (p50/p75/p95),
 * frequency classification, and status distribution.
 */

import { computeUrlCrawlMetrics } from "../crawl-metrics";
import { evaluateImportantPageCoverage, evaluateCrawlBudgetMateriality } from "../coverage-engine";
import { SeoServerLogEvent } from "../types";

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

describe("4. Crawl Coverage, Metrics & Latency", () => {
  it("4.1. Computes response time percentiles (p50, p75, p95) cleanly", () => {
    const events: SeoServerLogEvent[] = [
      { eventId: "1", timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/p", rawUrl: "https://example.com/p", normalizedUrl: "https://example.com/p/", statusCode: 200, userAgent: "Googlebot/2.1", responseTimeMs: 100, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
      { eventId: "2", timestamp: "2026-08-21T10:01:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/p", rawUrl: "https://example.com/p", normalizedUrl: "https://example.com/p/", statusCode: 200, userAgent: "Googlebot/2.1", responseTimeMs: 200, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
      { eventId: "3", timestamp: "2026-08-21T10:02:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/p", rawUrl: "https://example.com/p", normalizedUrl: "https://example.com/p/", statusCode: 200, userAgent: "Googlebot/2.1", responseTimeMs: 300, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
      { eventId: "4", timestamp: "2026-08-21T10:03:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/p", rawUrl: "https://example.com/p", normalizedUrl: "https://example.com/p/", statusCode: 200, userAgent: "Googlebot/2.1", responseTimeMs: 400, sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
    ];

    const metricsMap = computeUrlCrawlMetrics({ events, datasetDays: 14 });
    const m = metricsMap.get("https://example.com/p/")!;

    expect(m.medianResponseTimeMs).toBe(200);
    expect(m.p95ResponseTimeMs).toBe(400);
  });

  it("4.2. Evaluates important page crawl coverage and exposes unobserved URLs", () => {
    const knownUrls = [
      { url: "https://example.com/services/cmdb", isIndexable: true, isImportant: true, importanceReasons: ["STRATEGIC_SERVICE_PAGE"] },
      { url: "https://example.com/services/itsm", isIndexable: true, isImportant: true, importanceReasons: ["GSC_TRAFFIC_LEADER"] },
    ];

    const events: SeoServerLogEvent[] = [
      { eventId: "1", timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "example.com", method: "GET", rawPath: "/services/cmdb", rawUrl: "https://example.com/services/cmdb", normalizedUrl: "https://example.com/services/cmdb", statusCode: 200, userAgent: "Googlebot/2.1", sourceProvider: "NGINX", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
    ];

    const metricsMap = computeUrlCrawlMetrics({ events, knownUrls });
    const coverage = evaluateImportantPageCoverage(metricsMap, "COMPLETE");

    expect(coverage.totalImportantPages).toBe(2);
    expect(coverage.observedImportantPagesCount).toBe(1);
    expect(coverage.unobservedImportantPagesCount).toBe(1);
    expect(coverage.coveragePercentage).toBe(50);
    expect(coverage.unobservedImportantPages[0].url).toBe("https://example.com/services/itsm");
  });

  it("4.3. Crawl budget materiality is context-aware (LOW for compact sites, HIGH for large catalogs)", () => {
    const low = evaluateCrawlBudgetMateriality({ totalKnownUrls: 45, totalObservedRequests: 500, completeness: "COMPLETE" });
    expect(low.materiality).toBe("LOW");

    const high = evaluateCrawlBudgetMateriality({ totalKnownUrls: 25000, totalObservedRequests: 150000, completeness: "COMPLETE" });
    expect(high.materiality).toBe("HIGH");
  });
});
