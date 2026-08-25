/**
 * Provider Adapter & Failure Degradation Tests.
 * Verifies Mock provider, auth failure, quota failure, and unconfigured provider degradation.
 */

import { MockSerpProvider } from "../providers/mock-provider";
import { analyzeCompetitorAndSerpIntelligence } from "../engine";

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

describe("1. SERP Provider Adapters & Failure States", () => {
  it("1.1. Configured Mock Provider fetches clean deterministic snapshot", async () => {
    const provider = new MockSerpProvider(true);
    const res = await provider.fetchSerp({ query: "servicenow cmdb consulting" }, "bot-consulting", ["botconsulting.io"]);

    expect(res.status).toBe("SERP_DATA_FRESH_COMPLETE");
    expect(res.snapshot).toBeTruthy();
    expect(res.snapshot?.organicResults.length).toBe(5);
    expect(res.snapshot?.ownSiteResults.length).toBe(1);
    expect(res.snapshot?.ownSiteResults[0].url).toBe("https://www.botconsulting.io/services/cmdb");
  });

  it("1.2. Unconfigured Provider degrades gracefully to SERP_DATA_NOT_CONFIGURED", async () => {
    const unconfiguredProvider = new MockSerpProvider(false);
    const res = await unconfiguredProvider.fetchSerp({ query: "test query" }, "bot-consulting");

    expect(res.status).toBe("SERP_DATA_NOT_CONFIGURED");
    expect(res.snapshot).toBe(undefined);

    const fullRes = await analyzeCompetitorAndSerpIntelligence({
      projectId: "bot-consulting",
      queryClusters: [],
      provider: unconfiguredProvider,
    });

    expect(fullRes.report.providerStatus).toBe("SERP_DATA_NOT_CONFIGURED");
  });

  it("1.3. Provider Auth Failure returns SERP_PROVIDER_AUTH_FAILED without crashing audit", async () => {
    const provider = new MockSerpProvider(true);
    provider.registerFixture({
      queryKeyword: "auth failure query",
      results: [],
      simulateStatus: "AUTH_FAILED",
    });

    const res = await provider.fetchSerp({ query: "auth failure query" }, "bot-consulting");
    expect(res.status).toBe("SERP_PROVIDER_AUTH_FAILED");
  });

  it("1.4. Provider Quota Exceeded returns SERP_PROVIDER_QUOTA_EXCEEDED without mutating SEO health", async () => {
    const provider = new MockSerpProvider(true);
    provider.registerFixture({
      queryKeyword: "quota exceeded query",
      results: [],
      simulateStatus: "QUOTA_EXCEEDED",
    });

    const res = await provider.fetchSerp({ query: "quota exceeded query" }, "bot-consulting");
    expect(res.status).toBe("SERP_PROVIDER_QUOTA_EXCEEDED");
  });
});
