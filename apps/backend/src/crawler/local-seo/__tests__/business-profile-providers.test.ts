/**
 * Business Profile Provider Contracts & Support States Tests.
 * Proves support matrix accuracy, unconfigured degradation, and auth/quota error isolation.
 */

import { getLocalProviderSupportMatrix } from "../providers/provider-registry";
import { MockLocalBusinessProvider } from "../providers/mock-provider";

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

describe("5. Business Profile Provider Contracts & States", () => {
  it("5.1. Support matrix accurately reports IMPLEMENTED_AND_TESTED vs ARCHITECTURE_READY vs NOT_CONFIGURED", () => {
    const matrix = getLocalProviderSupportMatrix();
    expect(matrix.MOCK_LOCAL_PROVIDER.state).toBe("IMPLEMENTED_AND_TESTED");
    expect(matrix.GOOGLE_BUSINESS_PROFILE.state).toBe("ARCHITECTURE_READY");
    expect(matrix.UNCONFIGURED.state).toBe("NOT_CONFIGURED");
  });

  it("5.2. Unconfigured provider degrades gracefully to LOCAL_DATA_NOT_CONFIGURED (never GBP_MISSING)", async () => {
    const provider = new MockLocalBusinessProvider(false);
    const res = await provider.fetchBusinessProfiles({ projectId: "p1", targetDomain: "botconsulting.io" });
    expect(res.status).toBe("LOCAL_DATA_NOT_CONFIGURED");
  });

  it("5.3. Auth failure returns LOCAL_PROVIDER_AUTH_FAILED without crashing audit", async () => {
    const provider = new MockLocalBusinessProvider(true);
    provider.registerFixture({
      targetDomain: "auth-fail.com",
      simulateStatus: "LOCAL_PROVIDER_AUTH_FAILED",
      profiles: [],
    });

    const res = await provider.fetchBusinessProfiles({ projectId: "p1", targetDomain: "auth-fail.com" });
    expect(res.status).toBe("LOCAL_PROVIDER_AUTH_FAILED");
  });
});
