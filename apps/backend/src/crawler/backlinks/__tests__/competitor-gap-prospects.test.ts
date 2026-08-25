/**
 * Competitor Link Gap & Prospect Review Tests.
 * Proves own/shared/competitor-only referring domain classification,
 * multi-competitor link intersects, and ensures generic directories are excluded from prospect reviews.
 */

import { analyzeCompetitorLinkGaps, CompetitorReferringDomainDataset } from "../competitor-gap";
import { ReferringDomainAggregate } from "../types";

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

describe("7. Competitor Link Gap & Prospect Reviews", () => {
  const makeDomain = (dom: string, platformType: ReferringDomainAggregate["sourcePlatformType"] = "EDITORIAL_PUBLICATION"): ReferringDomainAggregate => ({
    domain: dom,
    rootDomain: dom,
    observedBacklinkCount: 1,
    uniqueTargetUrlCount: 1,
    targetUrls: ["https://example.com/p"],
    sampleAnchors: ["Consulting"],
    anchorDistribution: { BRANDED: 0, NAKED_URL: 0, GENERIC: 0, PARTIAL_MATCH: 0, EXACT_MATCH_CANDIDATE: 1, IMAGE_NO_TEXT: 0, UNKNOWN: 0 },
    attributeDistribution: { FOLLOW: 1, NOFOLLOW: 0, SPONSORED: 0, UGC: 0, UNKNOWN: 0 },
    sourcePlatformType: platformType,
    relevanceState: "HIGHLY_RELEVANT_SOURCE",
    sitewideClassification: "NOT_SITEWIDE",
    provenance: { provider: "MOCK_BACKLINK_PROVIDER", snapshotId: "s1" },
  });

  it("7.1. Categorizes own-only, shared, and competitor-only referring domains accurately", () => {
    const ownDomains = [makeDomain("own-exclusive.com"), makeDomain("shared-publication.com")];

    const compDatasets: CompetitorReferringDomainDataset[] = [
      {
        competitorDomain: "accenture.com",
        referringDomains: [makeDomain("shared-publication.com"), makeDomain("competitor-exclusive.com")],
      },
    ];

    const res = analyzeCompetitorLinkGaps(ownDomains, compDatasets);
    expect(res.ownOnlyReferringDomainsCount).toBe(1);
    expect(res.sharedReferringDomainsCount).toBe(1);
    expect(res.competitorOnlyReferringDomainsCount).toBe(1);
  });

  it("7.2. Multi-competitor link intersect creates advisory LINK_PROSPECT_REVIEW and excludes directories", () => {
    const ownDomains = [makeDomain("own-portal.com")];

    const compDatasets: CompetitorReferringDomainDataset[] = [
      {
        competitorDomain: "accenture.com",
        referringDomains: [
          makeDomain("industry-journal.com", "EDITORIAL_PUBLICATION"),
          makeDomain("spammy-directory.com", "DIRECTORY"),
        ],
      },
      {
        competitorDomain: "deloitte.com",
        referringDomains: [
          makeDomain("industry-journal.com", "EDITORIAL_PUBLICATION"),
          makeDomain("spammy-directory.com", "DIRECTORY"),
        ],
      },
    ];

    const res = analyzeCompetitorLinkGaps(ownDomains, compDatasets);
    expect(res.linkProspectReviews.length).toBe(1);
    expect(res.linkProspectReviews[0].rootDomain).toBe("industry-journal.com");
    expect(res.linkProspectReviews[0].linkedCompetitorCount).toBe(2);
    expect(res.linkProspectReviews[0].competitorPrevalenceFraction).toBe("2 of 2");
    // Directory is suppressed from prospect reviews
    expect(res.linkProspectReviews.some((p) => p.rootDomain === "spammy-directory.com")).toBe(false);
  });
});
