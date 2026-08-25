/**
 * Local SERP & Proximity Safety Tests.
 * Proves Phase 13 Local Pack integration and proximity data unavailability when exact coordinates are absent.
 */

import { extractLocalPackObservations } from "../local-serp-integrator";
import { SerpSnapshot } from "../../competitor-serp/types";

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

describe("7. Local SERP & Proximity Safety", () => {
  it("7.1. Reuses Phase 13 Local Pack features and extracts observed competitors", () => {
    const mockSerpSnapshot: SerpSnapshot = {
      snapshotId: "serp_1",
      projectId: "p1",
      query: "servicenow consulting jaipur",
      normalizedQuery: "servicenow consulting jaipur",
      country: "IN",
      language: "en",
      device: "DESKTOP",
      location: "Jaipur",
      locationGranularity: "CITY",
      depth: 10,
      timestamp: new Date().toISOString(),
      provider: "MOCK_PROVIDER",
      providerVersion: "v1",
      providerCompleteness: "COMPLETE",
      organicResults: [],
      ownSiteResults: [],
      serpFeatures: [
        {
          featureType: "LOCAL_PACK",
          owningDomain: "competitor.com",
          title: "Competitor A",
        },
      ],
    };

    const res = extractLocalPackObservations([mockSerpSnapshot], "botconsulting.io", "BOT Consulting");
    expect(res.observations.length).toBe(1);
    expect(res.observations[0].locationContext).toBe("Jaipur, IN");
    expect(res.observations[0].competitorsObserved.length).toBe(1);
    expect(res.proximityAvailability).toBe("LOCAL_PROXIMITY_DATA_UNAVAILABLE"); // Proximity safety verified
  });
});
