/**
 * Search Competitor Discovery Tests.
 * Proves repeated visibility requirement, business vs search competitor distinction,
 * and suppresses 1-hit wonder false positives.
 */

import { discoverSearchCompetitors } from "../competitor-discovery";
import { createSerpSnapshot } from "../serp-snapshot";
import { OrganicSerpResult } from "../types";

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

describe("3. Search Competitor Discovery & Business Relationships", () => {
  const makeResult = (pos: number, url: string, title: string): OrganicSerpResult => ({
    position: pos,
    url,
    normalizedUrl: url,
    domain: new URL(url).hostname.replace(/^www\./, ""),
    rootDomain: new URL(url).hostname.replace(/^www\./, ""),
    title,
    snippet: title,
    resultType: "SERVICE_PAGE",
    resultTypeConfidence: "HIGH_CONFIDENCE",
    isOwnDomain: false,
  });

  const snap1 = createSerpSnapshot({
    snapshotId: "snap-1",
    projectId: "bot-consulting",
    provider: "MOCK_PROVIDER",
    providerVersion: "v1",
    request: { query: "servicenow cmdb consulting", clusterId: "CLUST_cmdb" },
    normalizedQuery: "servicenow cmdb consulting",
    organicResults: [
      makeResult(1, "https://www.accenture.com/cmdb", "Accenture CMDB"),
      makeResult(2, "https://www.deloitte.com/cmdb", "Deloitte CMDB"),
      makeResult(3, "https://www.random-one-hit.com/post", "One Hit Post"),
    ],
  });

  const snap2 = createSerpSnapshot({
    snapshotId: "snap-2",
    projectId: "bot-consulting",
    provider: "MOCK_PROVIDER",
    providerVersion: "v1",
    request: { query: "servicenow itsm services", clusterId: "CLUST_itsm" },
    normalizedQuery: "servicenow itsm services",
    organicResults: [
      makeResult(1, "https://www.accenture.com/itsm", "Accenture ITSM"),
      makeResult(2, "https://www.cprime.com/itsm", "Cprime ITSM"),
    ],
  });

  const snap3 = createSerpSnapshot({
    snapshotId: "snap-3",
    projectId: "bot-consulting",
    provider: "MOCK_PROVIDER",
    providerVersion: "v1",
    request: { query: "servicenow csm consulting", clusterId: "CLUST_csm" },
    normalizedQuery: "servicenow csm consulting",
    organicResults: [
      makeResult(1, "https://www.accenture.com/csm", "Accenture CSM"),
      makeResult(2, "https://www.cprime.com/csm", "Cprime CSM"),
    ],
  });

  it("3.1. Domain repeatedly appearing across multiple clusters is discovered as search competitor", () => {
    const comps = discoverSearchCompetitors({
      snapshots: [snap1, snap2, snap3],
      configuredBusinessCompetitors: ["deloitte.com", "kpmg.com"],
      ownDomainAliases: ["botconsulting.io"],
    });

    const accenture = comps.find((c) => c.rootDomain === "accenture.com");
    expect(accenture?.relationship).toBe("DISCOVERED_SEARCH_COMPETITOR");
    expect(accenture?.trackedClustersAppearedIn).toBe(3);
    expect(accenture?.top10Appearances).toBe(3);
  });

  it("3.2. Single isolated appearance does NOT qualify as search competitor (suppresses 1-hit noise)", () => {
    const comps = discoverSearchCompetitors({
      snapshots: [snap1, snap2, snap3],
      configuredBusinessCompetitors: [],
      ownDomainAliases: ["botconsulting.io"],
    });

    const oneHit = comps.find((c) => c.rootDomain === "random-one-hit.com");
    expect(oneHit).toBe(undefined);
  });

  it("3.3. Configured business competitor with search visibility is classified as BOTH", () => {
    const comps = discoverSearchCompetitors({
      snapshots: [snap1, snap2, snap3],
      configuredBusinessCompetitors: ["cprime.com"],
      ownDomainAliases: ["botconsulting.io"],
    });

    const cprime = comps.find((c) => c.rootDomain === "cprime.com");
    expect(cprime?.relationship).toBe("BOTH");
  });

  it("3.4. Configured business competitor without search visibility is preserved as CONFIGURED_BUSINESS_COMPETITOR", () => {
    const comps = discoverSearchCompetitors({
      snapshots: [snap1, snap2, snap3],
      configuredBusinessCompetitors: ["kpmg.com"],
      ownDomainAliases: ["botconsulting.io"],
    });

    const kpmg = comps.find((c) => c.rootDomain === "kpmg.com");
    expect(kpmg?.relationship).toBe("CONFIGURED_BUSINESS_COMPETITOR");
    expect(kpmg?.top10Appearances).toBe(0);
  });
});
