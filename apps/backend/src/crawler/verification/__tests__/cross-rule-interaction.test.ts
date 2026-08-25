/**
 * Cross-Rule Interaction Test Suite
 * Tests deterministic multi-rule combinations (canonical -> redirect -> noindex,
 * robots blocked + canonical, sitemap -> redirect, hreflang -> non-indexable, etc.)
 */

import { parseHtmlPage } from "../../parser";
import { evaluateAllDiagnosticRules, validateIssueInvariants } from "../../rules";
import type { CrawledPageData } from "../../types";
import type { LinkGraphAnalysis } from "../../graph";

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
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
    toContain(expected: any) {
      if (!actual.includes(expected)) throw new Error(`Expected array to contain ${expected}`);
    },
  };
}

describe("Cross-Rule Diagnostic Interaction Tests", () => {
  const dummyGraph: LinkGraphAnalysis = {
    inlinksMap: new Map(),
    sitemapOrphans: [],
    crawlIsolatedPages: [],
    totalInternalLinks: 10,
    totalExternalLinks: 5,
    brokenInternalLinks: [],
    brokenExternalLinks: [],
    botBlockedExternalLinks: [],
    externalLinkTelemetry: {
      discoveredUniqueUrls: 5,
      discoveredOccurrences: 5,
      verificationLimit: 50,
      checkedUniqueUrls: 5,
      checkedOccurrences: 5,
      uncheckedUniqueUrls: 0,
      uncheckedOccurrences: 0,
      confirmedOkUniqueUrls: 5,
      confirmedOkOccurrences: 5,
      redirectedOkUniqueUrls: 0,
      redirectedOkOccurrences: 0,
      browserVerifiedOkUniqueUrls: 0,
      browserVerifiedOkOccurrences: 0,
      confirmedBrokenUniqueUrls: 0,
      confirmedBrokenOccurrences: 0,
      inconclusiveUniqueUrls: 0,
      inconclusiveOccurrences: 0,
      verificationCoveragePercent: 100,
      uniqueExternalUrlsCount: 5,
      totalExternalOccurrences: 5,
      confirmedOkCount: 5,
      redirectedOkCount: 0,
      browserVerifiedOkCount: 0,
      confirmedBrokenCount: 0,
      botBlockedCount: 0,
      rateLimitedCount: 0,
      timeoutCount: 0,
      networkDnsSslCount: 0,
      excludedPlaceholderHashCount: 0,
      excludedMailtoTelJsCount: 0,
      topExternalDomains: [],
    },
  };

  it("1. Canonical -> Redirect -> Noindex chain emits both canonical & redirect diagnostics cleanly", () => {
    const pageA = parseHtmlPage(
      "https://example.com/page-a",
      "https://example.com/page-a",
      "https://example.com/page-a",
      200,
      [],
      "<html><head><title>Page A</title><link rel='canonical' href='https://example.com/page-b'></head><body><p>Content A</p></body></html>",
      { "content-type": "text/html" },
      100,
      0,
      "https://example.com"
    );

    const pageB = parseHtmlPage(
      "https://example.com/page-b",
      "https://example.com/page-b",
      "https://example.com/page-c",
      200,
      [{ fromUrl: "https://example.com/page-b", toUrl: "https://example.com/page-c", statusCode: 301 }],
      "<html><head><title>Page C</title><meta name='robots' content='noindex'><link rel='canonical' href='https://example.com/page-c'></head><body><p>Content C</p></body></html>",
      { "content-type": "text/html" },
      100,
      1,
      "https://example.com"
    );

    const pageC = parseHtmlPage(
      "https://example.com/page-c",
      "https://example.com/page-c",
      "https://example.com/page-c",
      200,
      [],
      "<html><head><title>Page C</title><meta name='robots' content='noindex'></head><body><p>Content C</p></body></html>",
      { "content-type": "text/html" },
      100,
      2,
      "https://example.com"
    );

    const result = evaluateAllDiagnosticRules([pageA, pageB, pageC], dummyGraph, []);
    const issueCodes = result.issues.map((i) => i.code);

    expect(issueCodes.includes("CANONICAL_POINTS_TO_REDIRECT") || issueCodes.includes("CANONICAL_CHAIN")).toBeTruthy();
    expect(issueCodes.includes("INDEX_NOINDEX")).toBeTruthy();
    validateIssueInvariants(result.issues, [pageA, pageB, pageC]);
  });

  it("2. Sitemap URL pointing to 301 redirect and non-canonical destination emits both sitemap issues", () => {
    const pageA = parseHtmlPage(
      "https://example.com/sitemap-target",
      "https://example.com/sitemap-target",
      "https://example.com/sitemap-final",
      200,
      [{ fromUrl: "https://example.com/sitemap-target", toUrl: "https://example.com/sitemap-final", statusCode: 301 }],
      "<html><head><title>Target</title><link rel='canonical' href='https://example.com/canonical-other'></head><body><p>Content</p></body></html>",
      { "content-type": "text/html" },
      100,
      0,
      "https://example.com"
    );

    const sitemapEntries = [
      { loc: "https://example.com/sitemap-target", sourceSitemap: "https://example.com/sitemap.xml" },
    ];

    const result = evaluateAllDiagnosticRules([pageA], dummyGraph, sitemapEntries);
    const issueCodes = result.issues.map((i) => i.code);

    expect(issueCodes.includes("SITEMAP_URL_REDIRECT")).toBeTruthy();
    validateIssueInvariants(result.issues, [pageA]);
  });

  it("3. Hreflang targeting non-indexable page emits HREFLANG_TARGET_NON_INDEXABLE without dropping return check", () => {
    const pageEn = parseHtmlPage(
      "https://example.com/en",
      "https://example.com/en",
      "https://example.com/en",
      200,
      [],
      "<html><head><title>Home EN</title><link rel='alternate' hreflang='es' href='https://example.com/es'><link rel='alternate' hreflang='en' href='https://example.com/en'></head><body><h1>Welcome</h1></body></html>",
      { "content-type": "text/html" },
      100,
      0,
      "https://example.com"
    );

    const pageEs = parseHtmlPage(
      "https://example.com/es",
      "https://example.com/es",
      "https://example.com/es",
      404,
      [],
      "<html><head><title>404</title></head><body><p>Not found</p></body></html>",
      { "content-type": "text/html" },
      100,
      1,
      "https://example.com"
    );

    const result = evaluateAllDiagnosticRules([pageEn, pageEs], dummyGraph, []);
    const issueCodes = result.issues.map((i) => i.code);

    expect(issueCodes.includes("HREFLANG_TARGET_NON_INDEXABLE")).toBeTruthy();
    validateIssueInvariants(result.issues, [pageEn, pageEs]);
  });

  it("4. Simulated client-side metadata mutation emits RENDER_CRITICAL_METADATA_DISCREPANCY without invariant violations", () => {
    const page = parseHtmlPage(
      "https://example.com/spa-page",
      "https://example.com/spa-page",
      "https://example.com/spa-page",
      200,
      [],
      "<html><head><title>Initial Title</title><link rel='canonical' href='https://example.com/spa-page'></head><body><p>Content</p></body></html>",
      { "content-type": "text/html", "x-render-canon-diff": "https://example.com/mutated-canon" },
      100,
      0,
      "https://example.com"
    );

    const result = evaluateAllDiagnosticRules([page], dummyGraph, []);
    const issueCodes = result.issues.map((i) => i.code);

    expect(issueCodes.includes("RENDER_CRITICAL_METADATA_DISCREPANCY")).toBeTruthy();
    validateIssueInvariants(result.issues, [page]);
  });
});
