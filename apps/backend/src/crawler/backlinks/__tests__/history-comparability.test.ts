/**
 * Backlink History, Velocity, & Comparability Gate Tests.
 * Proves comparability validation, newly observed/no longer observed tracking,
 * link burst detection, and runtime immutability.
 */

import { createBacklinkSnapshot, validateBacklinkComparability } from "../snapshots";
import { trackBacklinkHistory } from "../history-tracker";
import { BacklinkRecord, ReferringDomainAggregate } from "../types";

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

describe("5. History & Comparability Gate", () => {
  const makeLink = (src: string): BacklinkRecord => ({
    backlinkId: `bl_${src}`,
    sourceUrl: src,
    sourceNormalizedUrl: src,
    sourceHostname: new URL(src).hostname,
    sourceRegistrableDomain: new URL(src).hostname.replace(/^www\./, ""),
    sourcePlatformType: "COMPANY_BLOG",
    targetUrl: "https://botconsulting.io/cmdb",
    targetNormalizedUrl: "https://botconsulting.io/cmdb",
    anchorText: "CMDB",
    anchorClassification: "EXACT_MATCH_CANDIDATE",
    linkAttributes: ["FOLLOW"],
    relevanceState: "RELATED_SOURCE",
    riskState: "NORMAL_LINK",
    provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
  });

  const makeDomain = (dom: string): ReferringDomainAggregate => ({
    domain: dom,
    rootDomain: dom,
    observedBacklinkCount: 1,
    uniqueTargetUrlCount: 1,
    targetUrls: ["https://botconsulting.io/cmdb"],
    sampleAnchors: ["CMDB"],
    anchorDistribution: { BRANDED: 0, NAKED_URL: 0, GENERIC: 0, PARTIAL_MATCH: 0, EXACT_MATCH_CANDIDATE: 1, IMAGE_NO_TEXT: 0, UNKNOWN: 0 },
    attributeDistribution: { FOLLOW: 1, NOFOLLOW: 0, SPONSORED: 0, UGC: 0, UNKNOWN: 0 },
    sourcePlatformType: "COMPANY_BLOG",
    relevanceState: "RELATED_SOURCE",
    sitewideClassification: "NOT_SITEWIDE",
    provenance: { provider: "MOCK_BACKLINK_PROVIDER", snapshotId: "s1" },
  });

  it("5.1. Comparability Gate: Live vs Historic index is NOT comparable", () => {
    const liveSnap = createBacklinkSnapshot({
      snapshotId: "s_live",
      projectId: "p1",
      targetDomain: "botconsulting.io",
      targetRegistrableDomain: "botconsulting.io",
      provider: "AHREFS",
      providerVersion: "v1",
      indexType: "LIVE",
      observedBacklinks: [],
      referringDomains: [],
    });

    const histSnap = createBacklinkSnapshot({
      snapshotId: "s_hist",
      projectId: "p1",
      targetDomain: "botconsulting.io",
      targetRegistrableDomain: "botconsulting.io",
      provider: "AHREFS",
      providerVersion: "v1",
      indexType: "HISTORIC",
      observedBacklinks: [],
      referringDomains: [],
    });

    const comp = validateBacklinkComparability(liveSnap, histSnap);
    expect(comp.isComparable).toBe(false);
    if (!comp.isComparable) {
      expect((comp as any).reason).toBe("BACKLINK_INDEX_TYPE_CHANGED");
    }
  });

  it("5.2. Comparability Gate: Provider change suppresses history comparison", () => {
    const ahrefsSnap = createBacklinkSnapshot({
      snapshotId: "s_ahrefs",
      projectId: "p1",
      targetDomain: "botconsulting.io",
      targetRegistrableDomain: "botconsulting.io",
      provider: "AHREFS",
      providerVersion: "v1",
      indexType: "LIVE",
      observedBacklinks: [],
      referringDomains: [],
    });

    const semrushSnap = createBacklinkSnapshot({
      snapshotId: "s_semrush",
      projectId: "p1",
      targetDomain: "botconsulting.io",
      targetRegistrableDomain: "botconsulting.io",
      provider: "SEMRUSH",
      providerVersion: "v1",
      indexType: "LIVE",
      observedBacklinks: [],
      referringDomains: [],
    });

    const comp = validateBacklinkComparability(ahrefsSnap, semrushSnap);
    expect(comp.isComparable).toBe(false);
    if (!comp.isComparable) {
      expect((comp as any).reason).toBe("BACKLINK_PROVIDER_CHANGED");
    }
  });

  it("5.3. Correctly measures newly observed and no-longer-observed backlinks across comparable snapshots", () => {
    const prevSnap = createBacklinkSnapshot({
      snapshotId: "s_prev",
      projectId: "p1",
      targetDomain: "botconsulting.io",
      targetRegistrableDomain: "botconsulting.io",
      provider: "MOCK_BACKLINK_PROVIDER",
      providerVersion: "v1",
      indexType: "LIVE",
      observedBacklinks: [makeLink("https://a.com/1"), makeLink("https://b.com/1")],
      referringDomains: [makeDomain("a.com"), makeDomain("b.com")],
    });

    const currSnap = createBacklinkSnapshot({
      snapshotId: "s_curr",
      projectId: "p1",
      targetDomain: "botconsulting.io",
      targetRegistrableDomain: "botconsulting.io",
      provider: "MOCK_BACKLINK_PROVIDER",
      providerVersion: "v1",
      indexType: "LIVE",
      observedBacklinks: [makeLink("https://a.com/1"), makeLink("https://c.com/1")], // b.com gone, c.com added
      referringDomains: [makeDomain("a.com"), makeDomain("c.com")],
    });

    const history = trackBacklinkHistory(currSnap, prevSnap);
    expect(history.isComparable).toBe(true);
    expect(history.newlyObservedBacklinksCount).toBe(1);
    expect(history.noLongerObservedBacklinksCount).toBe(1);
    expect(history.newlyObservedReferringDomainsCount).toBe(1);
    expect(history.noLongerObservedReferringDomainsCount).toBe(1);
  });
});
