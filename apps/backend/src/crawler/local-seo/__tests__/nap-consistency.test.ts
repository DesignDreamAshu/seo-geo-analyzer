/**
 * NAP Normalization & Multi-Location Branch Safety Tests.
 * Proves format variation safety, phone normalization, and branch-level isolation.
 */

import { normalizePhone, normalizeAddressStreet, compareAddresses, evaluateNapConsistency } from "../nap-normalization";
import { BusinessLocation, ObservedNapEvidence } from "../types";

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

describe("2. NAP Normalization & Multi-Location Safety", () => {
  it("2.1. Phone normalizer handles international, leading zero, and formatted numbers", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("(123) 456-7890")).toBe("1234567890");
  });

  it("2.2. Address comparison classifies harmless Road vs Rd as format variation", () => {
    const addr1 = { streetAddress: "123 M.I. Road", addressLocality: "Jaipur", postalCode: "302001" };
    const addr2 = { streetAddress: "123 MI Rd", addressLocality: "Jaipur", postalCode: "302001" };
    const comp = compareAddresses(addr1, addr2);
    expect(comp.isFormatVariation).toBe(true);
    expect(comp.isMismatch).toBe(false);
  });

  it("2.3. Multi-location safety: Jaipur and Delhi branches are evaluated in isolation without cross-conflict", () => {
    const jaipurLoc: BusinessLocation = {
      locationId: "loc_jpr",
      projectId: "p1",
      businessName: "BOT Consulting",
      locationName: "Jaipur HQ",
      address: { streetAddress: "MI Road", addressLocality: "Jaipur", postalCode: "302001" },
      phone: "+91 98765 43210",
      locationType: "PHYSICAL_LOCATION",
      provenance: { source: "CONFIGURED", retrievedAt: "" },
    };

    const delhiLoc: BusinessLocation = {
      locationId: "loc_del",
      projectId: "p1",
      businessName: "BOT Consulting",
      locationName: "Delhi Office",
      address: { streetAddress: "Connaught Place", addressLocality: "New Delhi", postalCode: "110001" },
      phone: "+91 11 2345 6789",
      locationType: "PHYSICAL_LOCATION",
      provenance: { source: "CONFIGURED", retrievedAt: "" },
    };

    const evidences: ObservedNapEvidence[] = [
      {
        sourceUrl: "https://botconsulting.io/locations/jaipur",
        sourceType: "LOCATION_PAGE",
        observedAddress: { streetAddress: "MI Road", addressLocality: "Jaipur", postalCode: "302001" },
        observedPhone: "+91 98765 43210",
        locationId: "loc_jpr",
        confidence: "HIGH_CONFIDENCE",
      },
      {
        sourceUrl: "https://botconsulting.io/locations/delhi",
        sourceType: "LOCATION_PAGE",
        observedAddress: { streetAddress: "Connaught Place", addressLocality: "New Delhi", postalCode: "110001" },
        observedPhone: "+91 11 2345 6789",
        locationId: "loc_del",
        confidence: "HIGH_CONFIDENCE",
      },
    ];

    const evalJaipur = evaluateNapConsistency(jaipurLoc, evidences);
    const evalDelhi = evaluateNapConsistency(delhiLoc, evidences);

    expect(evalJaipur.state).toBe("NAP_CONSISTENT");
    expect(evalDelhi.state).toBe("NAP_CONSISTENT");
  });
});
