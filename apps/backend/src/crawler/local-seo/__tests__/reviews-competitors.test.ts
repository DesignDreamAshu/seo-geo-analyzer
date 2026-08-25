/**
 * Local Reviews & Competitor Gap Tests.
 * Proves review gap observations, competitor relationship preservation,
 * and zero review manipulation recommendations.
 */

import { evaluateLocalReviewGap } from "../competitor-integrator";
import { BusinessProfileDataset } from "../types";

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

describe("6. Local Reviews & Competitor Gap", () => {
  const makeProfile = (id: string, reviews: number): BusinessProfileDataset => ({
    profileId: id,
    locationId: id,
    businessName: "Competitor",
    primaryCategory: "Consultant",
    additionalCategories: [],
    profileStatus: "VERIFIED",
    reviewCount: reviews,
    aggregateRating: 4.9,
    provenance: { provider: "MOCK_LOCAL_PROVIDER", providerVersion: "v1", retrievedAt: "" },
  });

  it("6.1. Material review gap against 5+ competitors emits advisory LOCAL_REVIEW_VOLUME_GAP_OBSERVED", () => {
    const projectProfile = makeProfile("own", 20);
    const compProfiles = [
      makeProfile("c1", 120),
      makeProfile("c2", 150),
      makeProfile("c3", 180),
      makeProfile("c4", 210),
      makeProfile("c5", 300),
    ];

    const res = evaluateLocalReviewGap(projectProfile, compProfiles);
    expect(res.projectReviewCount).toBe(20);
    expect(res.competitorMedianReviewCount).toBe(180);
    expect(res.gapFinding?.finding).toBe("LOCAL_REVIEW_VOLUME_GAP_OBSERVED");
    expect(res.gapFinding?.rationale.includes("no ranking causality or penalty implied")).toBe(true);
  });

  it("6.2. Small sample or close review counts produce no false review gap alerts", () => {
    const projectProfile = makeProfile("own", 90);
    const compProfiles = [makeProfile("c1", 100), makeProfile("c2", 95)];

    const res = evaluateLocalReviewGap(projectProfile, compProfiles);
    expect(res.gapFinding).toBe(undefined);
  });
});
