/**
 * Phase 11 & Phase 12 Integration Bridge Tests for Backlinks.
 * Proves action deduplication with existing Phase 11 tasks,
 * technical severity preservation, and linkable asset identification.
 */

import { bridgeBrokenBacklinksToPhase11, bridgeLinkProspectsToPhase11, identifyLinkableAssets } from "../phase-integrators";
import { BrokenBacklinkTargetOpportunity, LinkProspectReview, BacklinkRecord, ReferringDomainAggregate } from "../types";

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

describe("8. Phase 11 & Phase 12 Integration Bridges", () => {
  it("8.1. Bridges broken backlink targets to canonical Phase 11 actions and deduplicates", () => {
    const brokenList: BrokenBacklinkTargetOpportunity[] = [
      {
        targetUrl: "https://botconsulting.io/deleted-cmdb",
        statusCode: 404,
        observedBacklinkCount: 18,
        observedReferringDomainCount: 7,
        relevantSourceCount: 5,
        sampleReferringDomains: ["gartner.com", "forbes.com"],
        existingEquivalentUrlCandidate: "https://botconsulting.io/services/cmdb",
        redirectEquivalenceConfidence: "HIGH_EQUIVALENCE",
        recommendedAction: "Review 301 redirect to /services/cmdb",
        requiresOutreach: true,
      },
    ];

    const actions = bridgeBrokenBacklinksToPhase11("bot-consulting", brokenList, []);
    expect(actions.length).toBe(1);
    expect(actions[0].actionId.startsWith("ACT_")).toBe(true);
    expect(actions[0].type).toBe("TECHNICAL_FIX");
    expect(actions[0].isQuickWin).toBe(true);

    // Deduplication check
    const dedup = bridgeBrokenBacklinksToPhase11("bot-consulting", brokenList, actions);
    expect(dedup.length).toBe(0);
  });

  it("8.2. Identifies linkable high-demand assets from Phase 12", () => {
    const backlinks: BacklinkRecord[] = [
      {
        backlinkId: "bl_1",
        sourceUrl: "https://a.com/p",
        sourceNormalizedUrl: "https://a.com/p",
        sourceHostname: "a.com",
        sourceRegistrableDomain: "a.com",
        sourcePlatformType: "EDITORIAL_PUBLICATION",
        targetUrl: "https://botconsulting.io/resources/cmdb-guide",
        targetNormalizedUrl: "https://botconsulting.io/resources/cmdb-guide",
        anchorText: "ServiceNow Guide",
        anchorClassification: "EXACT_MATCH_CANDIDATE",
        linkAttributes: ["FOLLOW"],
        relevanceState: "HIGHLY_RELEVANT_SOURCE",
        riskState: "NORMAL_LINK",
        provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
      },
      {
        backlinkId: "bl_2",
        sourceUrl: "https://b.com/p",
        sourceNormalizedUrl: "https://b.com/p",
        sourceHostname: "b.com",
        sourceRegistrableDomain: "b.com",
        sourcePlatformType: "EDITORIAL_PUBLICATION",
        targetUrl: "https://botconsulting.io/resources/cmdb-guide",
        targetNormalizedUrl: "https://botconsulting.io/resources/cmdb-guide",
        anchorText: "CMDB Architecture",
        anchorClassification: "EXACT_MATCH_CANDIDATE",
        linkAttributes: ["FOLLOW"],
        relevanceState: "HIGHLY_RELEVANT_SOURCE",
        riskState: "NORMAL_LINK",
        provenance: { provider: "MOCK_BACKLINK_PROVIDER", providerVersion: "v1", retrievalTimestamp: "" },
      },
    ];

    const assets = identifyLinkableAssets(backlinks, []);
    expect(assets.length).toBe(1);
    expect(assets[0].targetUrl).toBe("https://botconsulting.io/resources/cmdb-guide");
    expect(assets[0].assetType).toBe("GUIDE_RESEARCH");
  });
});
