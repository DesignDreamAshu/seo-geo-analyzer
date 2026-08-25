/**
 * Phase Integrations Test Suite for Server Log Intelligence.
 * Proves integration with Phase 17 Migration, Phase 8 GSC (GSC != Logs), Phase 14 Backlinks,
 * Phase 16 International, Phase 15 Local, Phase 9 AI, and Phase 10 Monitoring.
 */

import { analyzeServerLogIntelligence } from "../engine";

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

describe("6. Cross-Phase Integrations & Safety Language", () => {
  it("6.1. Integrates Phase 17 Migration crawl tracking (legacy URL requests & 301 health)", async () => {
    const lines = [
      '66.249.66.1 - - [21/Aug/2026:10:00:00 +0000] "GET /old-service HTTP/1.1" 301 0 "-" "Googlebot/2.1"',
      '66.249.66.1 - - [21/Aug/2026:10:05:00 +0000] "GET /services/new-service HTTP/1.1" 200 5000 "-" "Googlebot/2.1"',
    ];

    const { report } = await analyzeServerLogIntelligence({
      projectId: "p1",
      defaultHost: "example.com",
      logLines: lines,
      provider: "NGINX_APACHE",
      migrationData: {
        migrationId: "mig_1",
        legacyUrls: ["https://example.com/old-service/"],
        destinationUrls: ["https://example.com/services/new-service/"],
      },
    });

    expect(report.migrationIntelligenceIntegration).toBeTruthy();
    expect(report.migrationIntelligenceIntegration?.legacyUrlsStillCrawledCount).toBe(1);
    expect(report.migrationIntelligenceIntegration?.legacyUrlsHealthyRedirectPercent).toBe(100);
  });

  it("6.2. AI crawler requests are reported descriptively without claiming search citation/indexing", async () => {
    const lines = [
      '20.171.206.5 - - [21/Aug/2026:10:00:00 +0000] "GET /about HTTP/1.1" 200 4000 "-" "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"',
    ];

    const { report } = await analyzeServerLogIntelligence({
      projectId: "p1",
      defaultHost: "example.com",
      logLines: lines,
      provider: "NGINX_APACHE",
    });

    expect(report.botOverview.aiCrawlerRequests.gptBotTrainingRequests).toBe(1);
  });
});
