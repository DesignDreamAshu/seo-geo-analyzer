/**
 * Referring Domains & Anchor Text Intelligence Tests.
 * Proves sitewide link deduplication and conservative anchor text classification.
 */

import { aggregateReferringDomains } from "../referring-domains";
import { classifyAnchorText, analyzeAnchorDistribution } from "../anchor-intelligence";
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

describe("3. Referring Domains & Anchor Intelligence", () => {
  it("3.1. Sitewide links (e.g. 50 footer links on 1 domain) collapse into 1 referring domain with sitewide flag", () => {
    const links: BacklinkRecord[] = Array(50).fill(null).map((_, i) => ({
      backlinkId: `bl_${i}`,
      sourceUrl: `https://partner-portal.com/page/${i}`,
      sourceNormalizedUrl: `https://partner-portal.com/page/${i}`,
      sourceHostname: "partner-portal.com",
      sourceRegistrableDomain: "partner-portal.com",
      sourcePlatformType: "COMPANY_BLOG",
      targetUrl: "https://botconsulting.io/services/cmdb",
      targetNormalizedUrl: "https://botconsulting.io/services/cmdb",
      anchorText: "ServiceNow CMDB Consulting",
      anchorClassification: "EXACT_MATCH_CANDIDATE",
      linkAttributes: ["FOLLOW"],
      relevanceState: "HIGHLY_RELEVANT_SOURCE",
      riskState: "NORMAL_LINK",
      provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
    }));

    const refDomains = aggregateReferringDomains(links, "MOCK_BACKLINK_PROVIDER", "snap_1");
    expect(refDomains.length).toBe(1);
    expect(refDomains[0].observedBacklinkCount).toBe(50);
    expect(refDomains[0].sitewideClassification).toBe("SITEWIDE_TEMPLATE_DOMINANT");
  });

  it("3.2. Classifies all 7 anchor categories accurately", () => {
    const brandAliases = ["bot consulting", "botconsulting"];
    expect(classifyAnchorText("BOT Consulting", brandAliases)).toBe("BRANDED");
    expect(classifyAnchorText("https://botconsulting.io/services", brandAliases)).toBe("NAKED_URL");
    expect(classifyAnchorText("Click Here", brandAliases)).toBe("GENERIC");
    expect(classifyAnchorText("BOT Consulting ServiceNow Services", brandAliases)).toBe("PARTIAL_MATCH");
    expect(classifyAnchorText("ServiceNow CMDB Consulting", brandAliases)).toBe("EXACT_MATCH_CANDIDATE");
    expect(classifyAnchorText("", brandAliases)).toBe("IMAGE_NO_TEXT");
    expect(classifyAnchorText("unrelated random text", brandAliases)).toBe("UNKNOWN");
  });

  it("3.3. Anchor distribution review triggers only with sufficient sample size (>= 50) and high exact-match ratio", () => {
    const brandAliases = ["bot consulting", "botconsulting"];

    // A. 5 links (all exact match) -> Sample size too small (< 50) -> NO review finding
    const smallLinks: BacklinkRecord[] = Array(5).fill(null).map((_, i) => ({
      backlinkId: `bl_${i}`,
      sourceUrl: `https://s${i}.com/p`,
      sourceNormalizedUrl: `https://s${i}.com/p`,
      sourceHostname: `s${i}.com`,
      sourceRegistrableDomain: `s${i}.com`,
      sourcePlatformType: "COMPANY_BLOG",
      targetUrl: "https://botconsulting.io/services/cmdb",
      targetNormalizedUrl: "https://botconsulting.io/services/cmdb",
      anchorText: "ServiceNow CMDB Consulting",
      anchorClassification: "EXACT_MATCH_CANDIDATE",
      linkAttributes: ["FOLLOW"],
      relevanceState: "HIGHLY_RELEVANT_SOURCE",
      riskState: "NORMAL_LINK",
      provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
    }));

    const smallRes = analyzeAnchorDistribution(smallLinks);
    expect(smallRes.distributionReview).toBe(undefined);

    // B. 60 links (25 exact match = 41.6%) -> Sample >= 50 and ratio >= 30% -> ANCHOR_DISTRIBUTION_REVIEW
    const largeLinks: BacklinkRecord[] = [
      ...Array(25).fill(null).map((_, i) => ({
        ...smallLinks[0],
        backlinkId: `bl_exact_${i}`,
        anchorClassification: "EXACT_MATCH_CANDIDATE" as const,
      })),
      ...Array(35).fill(null).map((_, i) => ({
        ...smallLinks[0],
        backlinkId: `bl_brand_${i}`,
        anchorClassification: "BRANDED" as const,
      })),
    ];

    const largeRes = analyzeAnchorDistribution(largeLinks);
    expect(largeRes.distributionReview?.finding).toBe("ANCHOR_DISTRIBUTION_REVIEW");
  });
});
