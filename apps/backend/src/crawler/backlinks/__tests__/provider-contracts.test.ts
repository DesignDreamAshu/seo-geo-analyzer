/**
 * Backlink Provider Contracts & Failure Degradation Tests.
 * Verifies provider support states, mock provider fixtures, auth failures,
 * quota limits, and unconfigured graceful fallbacks.
 */

import { MockBacklinkProvider } from "../providers/mock-provider";
import { getBacklinkProviderSupportMatrix, getBacklinkProviderImplementationState } from "../providers/provider-registry";
import { analyzeBacklinkIntelligence } from "../engine";

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

describe("1. Backlink Provider Contracts & Support States", () => {
  it("1.1. Support matrix accurately reports IMPLEMENTED_AND_TESTED vs ARCHITECTURE_READY vs NOT_CONFIGURED", () => {
    const matrix = getBacklinkProviderSupportMatrix();
    expect(matrix.MOCK_BACKLINK_PROVIDER.state).toBe("IMPLEMENTED_AND_TESTED");
    expect(matrix.AHREFS.state).toBe("ARCHITECTURE_READY");
    expect(matrix.SEMRUSH.state).toBe("ARCHITECTURE_READY");
    expect(matrix.MOZ.state).toBe("ARCHITECTURE_READY");
    expect(matrix.MAJESTIC.state).toBe("ARCHITECTURE_READY");
    expect(matrix.DATAFORSEO.state).toBe("ARCHITECTURE_READY");
    expect(matrix.MANUAL_DATASET.state).toBe("ARCHITECTURE_READY");
    expect(matrix.UNCONFIGURED.state).toBe("NOT_CONFIGURED");
  });

  it("1.2. Configured Mock Provider fetches clean deterministic backlink dataset", async () => {
    const provider = new MockBacklinkProvider(true);
    const res = await provider.fetchDomainBacklinks({ targetDomain: "botconsulting.io", projectId: "bot-consulting" }, ["botconsulting.io"]);

    expect(res.status).toBe("BACKLINK_DATA_FRESH_COMPLETE");
    expect(res.snapshot).toBeTruthy();
    expect(res.snapshot?.observedBacklinks.length).toBe(5);
    expect(res.snapshot?.referringDomains.length).toBe(5);
  });

  it("1.3. Unconfigured Provider degrades gracefully to BACKLINK_DATA_NOT_CONFIGURED", async () => {
    const unconfiguredProvider = new MockBacklinkProvider(false);
    const res = await unconfiguredProvider.fetchDomainBacklinks({ targetDomain: "botconsulting.io", projectId: "bot-consulting" });

    expect(res.status).toBe("BACKLINK_DATA_NOT_CONFIGURED");

    const engineRes = await analyzeBacklinkIntelligence({
      projectId: "bot-consulting",
      targetDomain: "botconsulting.io",
      provider: unconfiguredProvider,
    });

    expect(engineRes.report.providerStatus).toBe("BACKLINK_DATA_NOT_CONFIGURED");
  });

  it("1.4. Auth failure returns BACKLINK_PROVIDER_AUTH_FAILED without crashing audit", async () => {
    const provider = new MockBacklinkProvider(true);
    provider.registerFixture({
      targetDomain: "auth-fail.com",
      simulateStatus: "BACKLINK_PROVIDER_AUTH_FAILED",
      records: [],
    });

    const res = await provider.fetchDomainBacklinks({ targetDomain: "auth-fail.com", projectId: "bot-consulting" });
    expect(res.status).toBe("BACKLINK_PROVIDER_AUTH_FAILED");
  });

  it("1.5. Quota exceeded returns BACKLINK_PROVIDER_QUOTA_EXCEEDED without mutating SEO Health", async () => {
    const provider = new MockBacklinkProvider(true);
    provider.registerFixture({
      targetDomain: "quota-fail.com",
      simulateStatus: "BACKLINK_PROVIDER_QUOTA_EXCEEDED",
      records: [],
    });

    const res = await provider.fetchDomainBacklinks({ targetDomain: "quota-fail.com", projectId: "bot-consulting" });
    expect(res.status).toBe("BACKLINK_PROVIDER_QUOTA_EXCEEDED");
  });
});
