/**
 * Target Health & Broken Backlink Reclamation Tests.
 * Proves 404/410 broken backlink detection, redirect chain discovery,
 * and equivalent resource recommendations.
 */

import { evaluateBacklinkTargetHealth } from "../target-health";
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

describe("4. Target Health & Broken Backlinks", () => {
  const makeLink = (src: string, tgt: string): BacklinkRecord => ({
    backlinkId: `bl_${src}_${tgt}`,
    sourceUrl: src,
    sourceNormalizedUrl: src,
    sourceHostname: new URL(src).hostname,
    sourceRegistrableDomain: new URL(src).hostname.replace(/^www\./, ""),
    sourcePlatformType: "EDITORIAL_PUBLICATION",
    targetUrl: tgt,
    targetNormalizedUrl: tgt,
    anchorText: "ServiceNow Guide",
    anchorClassification: "EXACT_MATCH_CANDIDATE",
    linkAttributes: ["FOLLOW"],
    relevanceState: "HIGHLY_RELEVANT_SOURCE",
    riskState: "NORMAL_LINK",
    provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
  });

  it("4.1. Inbound links targeting 404 endpoint emit BROKEN_BACKLINK_RECLAMATION_OPPORTUNITY", () => {
    const backlinks = [
      makeLink("https://gartner.com/review", "https://botconsulting.io/old-deleted-tool"),
      makeLink("https://forbes.com/post", "https://botconsulting.io/old-deleted-tool"),
    ];

    const crawlMap = new Map([
      [
        "https://botconsulting.io/old-deleted-tool",
        { statusCode: 404, equivalentResourceCandidate: "https://botconsulting.io/tools/cmdb-audit" },
      ],
    ]);

    const res = evaluateBacklinkTargetHealth(backlinks, crawlMap);
    expect(res.brokenTargets.length).toBe(1);
    expect(res.brokenTargets[0].observedReferringDomainCount).toBe(2);
    expect(res.brokenTargets[0].redirectEquivalenceConfidence).toBe("HIGH_EQUIVALENCE");
    expect(res.brokenTargets[0].recommendedAction.includes("/tools/cmdb-audit")).toBe(true);
  });

  it("4.2. Backlink targeting multi-hop redirect origin emits BACKLINK_REDIRECT_CHAIN_REVIEW", () => {
    const backlinks = [makeLink("https://techcrunch.com/post", "https://botconsulting.io/v1/page")];

    const crawlMap = new Map([
      [
        "https://botconsulting.io/v1/page",
        {
          statusCode: 301,
          redirectChain: ["https://botconsulting.io/v1/page", "https://botconsulting.io/v2/page", "https://botconsulting.io/final"],
          finalDestinationUrl: "https://botconsulting.io/final",
        },
      ],
    ]);

    const res = evaluateBacklinkTargetHealth(backlinks, crawlMap);
    expect(res.redirectTargetReviews.length).toBe(1);
    expect(res.redirectTargetReviews[0].finalDestinationUrl).toBe("https://botconsulting.io/final");
  });

  it("4.3. Backlink targeting canonicalized-away URL emits BACKLINK_TARGET_ALIGNMENT_REVIEW", () => {
    const backlinks = [makeLink("https://medium.com/post", "https://botconsulting.io/page?variant=a")];

    const crawlMap = new Map([
      [
        "https://botconsulting.io/page?variant=a",
        {
          statusCode: 200,
          isCanonicalMatch: false,
          declaredCanonical: "https://botconsulting.io/page",
        },
      ],
    ]);

    const res = evaluateBacklinkTargetHealth(backlinks, crawlMap);
    expect(res.canonicalTargetReviews.length).toBe(1);
    expect(res.canonicalTargetReviews[0].declaredCanonicalUrl).toBe("https://botconsulting.io/page");
  });
});
