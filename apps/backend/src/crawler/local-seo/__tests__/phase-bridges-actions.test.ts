/**
 * Phase 11 Canonical Actions Bridge & Deduplication Tests.
 * Proves deduplication with technical rules, owner routing, and technical severity preservation.
 */

import { bridgeLocalOpportunitiesToPhase11 } from "../phase-integrators";
import { BusinessLocation, LocationPageQualityReview } from "../types";

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

describe("8. Phase 11 Integration & Action Deduplication", () => {
  it("8.1. Broken/noindex location page emits indexability action without creating duplicates", () => {
    const locationPages: LocationPageQualityReview[] = [
      {
        url: "https://botconsulting.io/locations/jaipur",
        classification: "LOCATION_DETAIL_PAGE",
        hasUniqueIdentity: true,
        hasAddressOrServiceArea: true,
        hasPhoneOrContact: true,
        hasHours: true,
        hasStructuredData: true,
        isIndexable: false, // Broken / noindex
        isSelfCanonical: true,
      },
    ];

    const actions = bridgeLocalOpportunitiesToPhase11("bot-consulting", [], locationPages, [], []);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe("TECHNICAL_FIX");
    expect(actions[0].technicalSeverity).toBe("high"); // Preserves standard severity

    // Deduplication check
    const dedup = bridgeLocalOpportunitiesToPhase11("bot-consulting", [], locationPages, [], actions);
    expect(dedup.length).toBe(0);
  });

  it("8.2. Business profile website mismatch routes to Client / SEO owner", () => {
    const profileAlignments = [
      {
        locationId: "loc_jpr",
        websiteUrlAlignment: "BUSINESS_PROFILE_WEBSITE_MISMATCH",
        categoryAlignment: "CATEGORY_ALIGNED",
      },
    ];

    const actions = bridgeLocalOpportunitiesToPhase11("bot-consulting", [], [], profileAlignments, []);
    expect(actions.length).toBe(1);
    expect(actions[0].primaryOwner).toBe("Client");
    expect(actions[0].type).toBe("CONTENT_STRUCTURE_OPPORTUNITY");
  });
});
