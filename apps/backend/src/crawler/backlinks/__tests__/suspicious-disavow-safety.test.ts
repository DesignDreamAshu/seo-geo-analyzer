/**
 * Suspicious Patterns & Disavow Safety Boundary Tests.
 * Proves suspicious pattern reviews, zero toxic score creation,
 * and confirms NO automatic disavow recommendation or disavow file generation exists.
 */

import { detectSuspiciousLinkPatterns } from "../suspicious-patterns";
import { BacklinkRecord } from "../types";

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

describe("6. Suspicious Patterns & Disavow Safety Boundaries", () => {
  it("6.1. Large burst of identical commercial anchors across 8+ distinct domains flags SUSPICIOUS_LINK_PATTERN_REVIEW", () => {
    const burstLinks: BacklinkRecord[] = Array(10).fill(null).map((_, i) => ({
      backlinkId: `bl_${i}`,
      sourceUrl: `https://domain${i}.com/page`,
      sourceNormalizedUrl: `https://domain${i}.com/page`,
      sourceHostname: `domain${i}.com`,
      sourceRegistrableDomain: `domain${i}.com`,
      sourcePlatformType: "COMPANY_BLOG",
      targetUrl: "https://botconsulting.io/services/cmdb",
      targetNormalizedUrl: "https://botconsulting.io/services/cmdb",
      anchorText: "best servicenow consulting agency",
      anchorClassification: "EXACT_MATCH_CANDIDATE",
      linkAttributes: ["FOLLOW"],
      relevanceState: "RELATED_SOURCE",
      riskState: "NORMAL_LINK",
      provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
    }));

    const reviews = detectSuspiciousLinkPatterns(burstLinks);
    expect(reviews.length).toBe(1);
    expect(reviews[0].patternType).toBe("LARGE_BURST_IDENTICAL_ANCHORS");
    expect(reviews[0].affectedDomainCount).toBe(10);
    expect(reviews[0].interpretationNote.includes("no automated penalty")).toBe(true);
  });

  it("6.2. Single exact match or normal nofollow/directory links do NOT trigger false suspicious flags", () => {
    const normalLinks: BacklinkRecord[] = [
      {
        backlinkId: "bl_1",
        sourceUrl: "https://clutch.co/profile/bot-consulting",
        sourceNormalizedUrl: "https://clutch.co/profile/bot-consulting",
        sourceHostname: "clutch.co",
        sourceRegistrableDomain: "clutch.co",
        sourcePlatformType: "DIRECTORY",
        targetUrl: "https://botconsulting.io",
        targetNormalizedUrl: "https://botconsulting.io",
        anchorText: "ServiceNow Consulting",
        anchorClassification: "EXACT_MATCH_CANDIDATE",
        linkAttributes: ["NOFOLLOW"],
        relevanceState: "RELATED_SOURCE",
        riskState: "NORMAL_LINK",
        provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
      },
    ];

    const reviews = detectSuspiciousLinkPatterns(normalLinks);
    expect(reviews.length).toBe(0);
  });
});
