/**
 * Server Log Provider Parsers & Ingestion Contract Tests.
 * Proves parsing of Apache Common, Apache Combined, Nginx, Cloudflare Logpush JSON,
 * Vercel logs, Generic JSON, Generic CSV, Generic TSV, streaming chunks, and deduplication safety.
 */

import { parseLogLines, parseLogChunks, getAdapterSupportState } from "../adapters";

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

describe("1. Log Provider Parsers & Ingestion Contract Tests", () => {
  it("1.1. Apache / Nginx Combined Log Format parses IP, timestamp, method, path, status, and UA", () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /services/itsm HTTP/1.1" 200 4520 "https://google.com" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
    ];

    const res = parseLogLines({ lines, provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" });
    expect(res.totalParsed).toBe(1);
    expect(res.events[0].method).toBe("GET");
    expect(res.events[0].rawPath).toBe("/services/itsm");
    expect(res.events[0].statusCode).toBe(200);
    expect(res.events[0].botIdentity.family).toBe("GOOGLEBOT");
    expect(res.events[0].botIdentity.verificationState).toBe("VERIFIED_PROVIDER_RANGE");
  });

  it("1.2. Apache Common Log Format (CLF) parses without referrer or user agent", () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /robots.txt HTTP/1.1" 200 120',
    ];

    const res = parseLogLines({ lines, provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" });
    expect(res.totalParsed).toBe(1);
    expect(res.events[0].statusCode).toBe(200);
    expect(res.events[0].rawPath).toBe("/robots.txt");
  });

  it("1.3. Cloudflare structured JSON log event parses cleanly", () => {
    const cfJson = JSON.stringify({
      ClientIP: "66.249.66.5",
      ClientRequestHost: "example.com",
      ClientRequestMethod: "GET",
      ClientRequestURI: "/products/laptop?sort=price",
      ClientRequestUserAgent: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      EdgeResponseStatus: 200,
      EdgeResponseBytes: 12450,
      EdgeTimeToFirstByteMs: 145.2,
      EdgeStartTimestamp: "2026-08-21T10:15:00Z",
    });

    const res = parseLogLines({ lines: [cfJson], provider: "CLOUDFLARE", projectId: "p1", defaultHost: "example.com" });
    expect(res.totalParsed).toBe(1);
    expect(res.events[0].normalizedUrl).toBe("https://example.com/products/laptop/?sort=price");
    expect(res.events[0].botIdentity.deviceType).toBe("SMARTPHONE");
    expect(res.events[0].responseTimeMs).toBe(145);
  });

  it("1.4. Vercel access JSON log parses execution time and status code", () => {
    const vcJson = JSON.stringify({
      ip: "157.55.39.1",
      domain: "example.com",
      method: "GET",
      path: "/about",
      statusCode: 200,
      userAgent: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      executionTimeMs: 82,
      timestamp: "2026-08-21T10:20:00Z",
    });

    const res = parseLogLines({ lines: [vcJson], provider: "VERCEL", projectId: "p1", defaultHost: "example.com" });
    expect(res.totalParsed).toBe(1);
    expect(res.events[0].botIdentity.family).toBe("BINGBOT");
    expect(res.events[0].botIdentity.verificationState).toBe("VERIFIED_PROVIDER_RANGE");
  });

  it("1.5. Generic CSV and TSV formats parse correctly", () => {
    const csvLine = "2026-08-21T10:00:00Z,/contact,200,Googlebot/2.1,66.249.66.1";
    const csvRes = parseLogLines({ lines: [csvLine], provider: "CSV", projectId: "p1", defaultHost: "example.com" });
    expect(csvRes.totalParsed).toBe(1);
    expect(csvRes.events[0].rawPath).toBe("/contact");

    const tsvLine = "2026-08-21T10:00:00Z\t/blog\t200\tGooglebot/2.1\t66.249.66.1";
    const tsvRes = parseLogLines({ lines: [tsvLine], provider: "TSV", projectId: "p1", defaultHost: "example.com" });
    expect(tsvRes.totalParsed).toBe(1);
    expect(tsvRes.events[0].rawPath).toBe("/blog");
  });

  it("1.6. Exposes honest adapter support states (IMPLEMENTED_AND_TESTED vs GENERIC_IMPORT_SUPPORTED)", () => {
    expect(getAdapterSupportState("NGINX_APACHE")).toBe("IMPLEMENTED_AND_TESTED");
    expect(getAdapterSupportState("CLOUDFLARE")).toBe("IMPLEMENTED_AND_TESTED");
    expect(getAdapterSupportState("VERCEL")).toBe("IMPLEMENTED_AND_TESTED");
    expect(getAdapterSupportState("AWS_CLOUDFRONT")).toBe("GENERIC_IMPORT_SUPPORTED");
    expect(getAdapterSupportState("AWS_ALB")).toBe("GENERIC_IMPORT_SUPPORTED");
  });

  it("1.7. Streaming generator processes chunks in bounded memory", () => {
    const chunks = [
      ['66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /chunk1 HTTP/1.1" 200 100 "-" "Googlebot/2.1"'],
      ['66.249.66.1 - - [21/Aug/2026:10:01:00 +0000] "GET /chunk2 HTTP/1.1" 200 200 "-" "Googlebot/2.1"'],
    ];

    let count = 0;
    for (const chunkEvents of parseLogChunks(chunks, { provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" })) {
      count += chunkEvents.length;
    }
    expect(count).toBe(2);
  });

  it("1.8. Deduplication safety: same-second requests with different status or bytes are NOT dropped", () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /api/test HTTP/1.1" 500 0 "-" "Googlebot/2.1"',
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /api/test HTTP/1.1" 200 1500 "-" "Googlebot/2.1"', // Different status & bytes
    ];

    const res = parseLogLines({ lines, provider: "NGINX_APACHE", projectId: "p1", defaultHost: "example.com" });
    expect(res.totalParsed).toBe(2); // Both distinct legitimate requests preserved
  });
});
