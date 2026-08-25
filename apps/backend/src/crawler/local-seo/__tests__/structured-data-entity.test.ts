/**
 * Local Structured Data & Entity Alignment Tests.
 * Proves LocalBusiness subtypes, PostalAddress, and telephone verification.
 */

import { validateLocalStructuredData } from "../structured-data";
import { BusinessLocation } from "../types";

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

describe("4. Local Structured Data & Entity Alignment", () => {
  const loc: BusinessLocation = {
    locationId: "loc_jpr",
    projectId: "p1",
    businessName: "BOT Consulting",
    locationName: "Jaipur HQ",
    address: { streetAddress: "MI Road", addressLocality: "Jaipur", postalCode: "302001" },
    phone: "+91 98765 43210",
    locationType: "PHYSICAL_LOCATION",
    provenance: { source: "CONFIGURED", retrievedAt: "" },
  };

  it("4.1. Valid specific subtype (ProfessionalService) aligns cleanly", () => {
    const res = validateLocalStructuredData(loc, [
      {
        type: "ProfessionalService",
        name: "BOT Consulting",
        telephone: "+91 98765 43210",
        address: { streetAddress: "MI Road", addressLocality: "Jaipur", postalCode: "302001" },
      },
    ]);

    expect(res.isAligned).toBe(true);
    expect(res.schemaType).toBe("ProfessionalService");
    expect(res.issuesFound.length).toBe(0);
  });

  it("4.2. Conflicting city in schema produces descriptive entity mismatch", () => {
    const res = validateLocalStructuredData(loc, [
      {
        type: "LocalBusiness",
        name: "BOT Consulting",
        telephone: "+91 98765 43210",
        address: { streetAddress: "Connaught Place", addressLocality: "New Delhi", postalCode: "110001" },
      },
    ]);

    expect(res.isAligned).toBe(false);
    expect(res.issuesFound.some((i) => i.includes("conflicts with location address"))).toBe(true);
  });
});
