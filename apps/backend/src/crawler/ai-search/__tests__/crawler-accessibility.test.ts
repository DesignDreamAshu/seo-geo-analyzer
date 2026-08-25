/**
 * Certified Test Suite for AI Crawler Accessibility, Provenance & Precedence.
 * Proves strict role separation and RFC 9309 directive precedence.
 */

import { inspectAiCrawlerAccess } from "../robots-inspector";
import { OFFICIAL_AI_CRAWLERS } from "../crawler-registry";

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
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
  };
}

describe("Certified AI Crawler Accessibility & Precedence", () => {
  it("1. Missing robots.txt: all registered crawlers receive full default access", () => {
    const findings = inspectAiCrawlerAccess(null);
    expect(findings.length).toBeGreaterThanOrEqual(10);
    for (const f of findings) {
      expect(f.accessStatus).toBe("NO_ROBOTS_TXT");
      expect(f.searchAccessRisk).toBe("NONE");
    }
  });

  it("2. OpenAI Distinct Roles: blocking GPTBot opts out of training with ZERO search risk, while blocking OAI-SearchBot triggers SEARCH_DISCOVERABILITY_HIGH_RISK", () => {
    const robotsTxt = `
      User-agent: GPTBot
      Disallow: /

      User-agent: OAI-SearchBot
      Disallow: /
    `;

    const findings = inspectAiCrawlerAccess(robotsTxt, "/");
    const gptBot = findings.find((f) => f.crawler.userAgent === "GPTBot");
    const searchBot = findings.find((f) => f.crawler.userAgent === "OAI-SearchBot");

    expect(gptBot?.crawler.role).toBe("TRAINING_CRAWLER");
    expect(gptBot?.accessStatus).toBe("DISALLOWED");
    expect(gptBot?.searchAccessRisk).toBe("NONE"); // NO search risk
    expect(gptBot?.trainingOptOutConfirmed).toBe(true); // Confirmed training opt out

    expect(searchBot?.crawler.role).toBe("SEARCH_INDEXER");
    expect(searchBot?.accessStatus).toBe("DISALLOWED");
    expect(searchBot?.searchAccessRisk).toBe("SEARCH_DISCOVERABILITY_HIGH_RISK"); // High search discoverability risk
  });

  it("3. Google Distinct Roles: blocking Google-Extended manages Gemini training without search penalty, while Googlebot is SEARCH_ACCESS_BLOCKED", () => {
    const robotsTxt = `
      User-agent: Google-Extended
      Disallow: /

      User-agent: Googlebot
      Disallow: /
    `;

    const findings = inspectAiCrawlerAccess(robotsTxt, "/");
    const gExtended = findings.find((f) => f.crawler.userAgent === "Google-Extended");
    const gBot = findings.find((f) => f.crawler.userAgent === "Googlebot");

    expect(gExtended?.crawler.role).toBe("TRAINING_CRAWLER");
    expect(gExtended?.searchAccessRisk).toBe("NONE");
    expect(gExtended?.trainingOptOutConfirmed).toBe(true);

    expect(gBot?.crawler.role).toBe("SEARCH_INDEXER");
    expect(gBot?.searchAccessRisk).toBe("SEARCH_ACCESS_BLOCKED");
  });

  it("4. Longest-Match Specificity Precedence: Allow /blog/wins over Disallow / for OAI-SearchBot", () => {
    const robotsTxt = `
      User-agent: OAI-SearchBot
      Disallow: /
      Allow: /blog/
    `;

    const findingsBlog = inspectAiCrawlerAccess(robotsTxt, "/blog/ai-search-guide");
    const searchBotBlog = findingsBlog.find((f) => f.crawler.userAgent === "OAI-SearchBot");
    expect(searchBotBlog?.accessStatus).toBe("ALLOWED");
    expect(searchBotBlog?.matchedPattern).toBe("/blog/");

    const findingsRoot = inspectAiCrawlerAccess(robotsTxt, "/private");
    const searchBotRoot = findingsRoot.find((f) => f.crawler.userAgent === "OAI-SearchBot");
    expect(searchBotRoot?.accessStatus).toBe("DISALLOWED");
    expect(searchBotRoot?.matchedPattern).toBe("/");
  });

  it("5. Empty Disallow Handling: empty Disallow: correctly treats crawler as fully ALLOWED", () => {
    const robotsTxt = `
      User-agent: *
      Disallow: /

      User-agent: PerplexityBot
      Disallow:
    `;

    const findings = inspectAiCrawlerAccess(robotsTxt, "/");
    const perplexityBot = findings.find((f) => f.crawler.userAgent === "PerplexityBot");
    expect(perplexityBot?.accessStatus).toBe("ALLOWED");
  });

  it("6. Crawler Registry Provenance Invariants: every crawler has officialSourceUrl, verified date and valid confidence", () => {
    expect(OFFICIAL_AI_CRAWLERS.length).toBe(12);
    for (const c of OFFICIAL_AI_CRAWLERS) {
      expect(c.officialSourceUrl.startsWith("http")).toBe(true);
      expect(c.lastVerifiedDate.length).toBeGreaterThanOrEqual(10);
      expect(["CONFIRMED_BY_PROVIDER", "DOCUMENTED_BY_PROVIDER", "DOCUMENTED_ECOSYSTEM", "ROLE_UNCERTAIN"].includes(c.confidence)).toBe(true);
    }
  });
});
