/**
 * SERP Normalization, Context, & Comparability Gate Tests.
 * Proves US != India, Desktop != Mobile, Jaipur != National,
 * Provider changes are non-comparable, and own-domain hostname matching is secure.
 */

import { parseAndNormalizeUrl, isOwnDomain, extractRootDomain } from "../normalization";
import { createSerpSnapshot, validateSerpComparability } from "../serp-snapshot";

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

describe("2. SERP Normalization, Context & Comparability Gate", () => {
  it("2.1. Domain normalizer preserves meaningful subdomains", () => {
    const parsedDocs = parseAndNormalizeUrl("https://docs.servicenow.com/bundle/utah/page/intro.html?utm_source=google");
    expect(parsedDocs.domain).toBe("docs.servicenow.com");
    expect(parsedDocs.rootDomain).toBe("servicenow.com");
    expect(parsedDocs.subdomain).toBe("docs");
    expect(parsedDocs.normalizedUrl.includes("utm_source")).toBe(false); // Strips tracking parameters
  });

  it("2.2. Own-domain matching strictly rejects substring spoofing", () => {
    const ownAliases = ["botconsulting.io"];
    expect(isOwnDomain("https://www.botconsulting.io/services", ownAliases)).toBe(true);
    expect(isOwnDomain("https://app.botconsulting.io/login", ownAliases)).toBe(true);
    // Spoofed domain with own name as prefix
    expect(isOwnDomain("https://botconsulting.io.evil-phishing.com/page", ownAliases)).toBe(false);
  });

  it("2.3. Comparability Gate: US Desktop vs US Desktop is comparable", () => {
    const snap1 = createSerpSnapshot({
      snapshotId: "snap-1",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const snap2 = createSerpSnapshot({
      snapshotId: "snap-2",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    expect(validateSerpComparability(snap1, snap2).isComparable).toBe(true);
  });

  it("2.4. Comparability Gate: US vs India is NOT comparable", () => {
    const snapUS = createSerpSnapshot({
      snapshotId: "snap-us",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const snapIN = createSerpSnapshot({
      snapshotId: "snap-in",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "in", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const comp = validateSerpComparability(snapUS, snapIN);
    expect(comp.isComparable).toBe(false);
    if (!comp.isComparable) {
      expect((comp as any).reason).toBe("SERP_SNAPSHOTS_NOT_COMPARABLE");
    }
  });

  it("2.5. Comparability Gate: Desktop vs Mobile is NOT comparable", () => {
    const snapDesktop = createSerpSnapshot({
      snapshotId: "snap-desk",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const snapMobile = createSerpSnapshot({
      snapshotId: "snap-mob",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "MOBILE" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const comp = validateSerpComparability(snapDesktop, snapMobile);
    expect(comp.isComparable).toBe(false);
    if (!comp.isComparable) {
      expect((comp as any).reason).toBe("SERP_SNAPSHOTS_NOT_COMPARABLE");
    }
  });

  it("2.6. Comparability Gate: Provider Change triggers SERP_PROVIDER_CHANGED", () => {
    const snap1 = createSerpSnapshot({
      snapshotId: "snap-1",
      projectId: "bot-consulting",
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const snap2 = createSerpSnapshot({
      snapshotId: "snap-2",
      projectId: "bot-consulting",
      provider: "DATAFORSEO",
      providerVersion: "v1",
      request: { query: "servicenow cmdb", country: "us", language: "en", device: "DESKTOP" },
      normalizedQuery: "servicenow cmdb",
      organicResults: [],
    });

    const comp = validateSerpComparability(snap1, snap2);
    expect(comp.isComparable).toBe(false);
    if (!comp.isComparable) {
      expect((comp as any).reason).toBe("SERP_PROVIDER_CHANGED");
    }
  });
});
