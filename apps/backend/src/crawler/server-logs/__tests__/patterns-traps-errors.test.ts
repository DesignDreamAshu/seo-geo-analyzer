/**
 * Crawl Patterns, Crawl Traps & Error Burst Tests.
 * Proves detection of parameter expansion, facet review, potential crawl traps,
 * 5xx error bursts, and staging search bot access.
 */

import { detectCrawlPatterns } from "../pattern-detector";
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

describe("5. Crawl Patterns, Traps & Error Bursts", () => {
  it("5.1. Detects parameter and facet expansion on catalog base path", () => {
    const events: SeoServerLogEvent[] = [];
    for (let i = 0; i < 60; i++) {
      events.push({
        eventId: `e_${i}`,
        timestamp: "2026-08-21T10:00:00Z",
        projectId: "p1",
        host: "example.com",
        method: "GET",
        rawPath: "/products",
        rawQuery: `color=blue&size=${i}`,
        rawUrl: `https://example.com/products?color=blue&size=${i}`,
        normalizedUrl: `https://example.com/products/?color=blue&size=${i}`,
        statusCode: 200,
        userAgent: "Googlebot/2.1",
        sourceProvider: "CLOUDFLARE",
        resourceType: "HTML_DOCUMENT",
        botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false },
      });
    }

    const res = detectCrawlPatterns({ events });
    expect(res.facetPatterns.length).toBe(1);
    expect(res.facetPatterns[0].basePath).toBe("/products");
    expect(res.facetPatterns[0].variantCount).toBe(60);
  });

  it("5.2. Detects 5xx server error bursts affecting search bots", () => {
    const events: SeoServerLogEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push({
        eventId: `e_${i}`,
        timestamp: `2026-08-21T10:0${i}:00Z`,
        projectId: "p1",
        host: "example.com",
        method: "GET",
        rawPath: `/api/page-${i}`,
        rawUrl: `https://example.com/api/page-${i}`,
        normalizedUrl: `https://example.com/api/page-${i}`,
        statusCode: 500,
        userAgent: "Googlebot/2.1",
        sourceProvider: "NGINX",
        resourceType: "HTML_DOCUMENT",
        botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false },
      });
    }

    const res = detectCrawlPatterns({ events });
    expect(res.errorBursts.length).toBe(1);
    expect(res.errorBursts[0].statusCode).toBe(500);
    expect(res.errorBursts[0].requestsCount).toBe(6);
  });

  it("5.3. Detects search bot activity on staging hosts", () => {
    const events: SeoServerLogEvent[] = [
      { eventId: "e1", timestamp: "2026-08-21T10:00:00Z", projectId: "p1", host: "staging.example.com", method: "GET", rawPath: "/p1", rawUrl: "https://staging.example.com/p1", normalizedUrl: "https://staging.example.com/p1/", statusCode: 200, userAgent: "Googlebot/2.1", sourceProvider: "CLOUDFLARE", resourceType: "HTML_DOCUMENT", botIdentity: { name: "Googlebot", family: "GOOGLEBOT", deviceType: "SMARTPHONE", verificationState: "VERIFIED_PROVIDER_RANGE", verificationEvidence: [], isVerifiedSearchBot: true, isAiCrawler: false } },
    ];

    const res = detectCrawlPatterns({ events });
    expect(res.stagingBotRequestsCount).toBe(1);
  });
});
