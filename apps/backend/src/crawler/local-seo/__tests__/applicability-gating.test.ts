/**
 * Local SEO Applicability Gating & Non-Local Safety Boundary Tests.
 * Proves gating for PHYSICAL, MULTI_LOCATION, SAB, and ONLINE_ONLY businesses,
 * verifying zero false local defects on non-local sites.
 */

import { determineLocalSeoApplicability } from "../applicability";
import { analyzeLocalSeoIntelligence } from "../engine";

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

describe("1. Local SEO Applicability Gating & Non-Local Safety", () => {
  it("1.1. Physical local business classified accurately", () => {
    const res = determineLocalSeoApplicability({
      configuredLocations: [
        {
          locationId: "loc_1",
          projectId: "p1",
          businessName: "Design Studio",
          locationName: "Studio Jaipur",
          locationType: "PHYSICAL_LOCATION",
          provenance: { source: "CONFIGURED", retrievedAt: "" },
        },
      ],
    });

    expect(res.applicability).toBe("LOCAL_BUSINESS");
    expect(res.isLocalIntelligenceApplicable).toBe(true);
  });

  it("1.2. Multi-location business with 2+ locations classified accurately", () => {
    const res = determineLocalSeoApplicability({
      configuredLocations: [
        { locationId: "loc_1", projectId: "p1", businessName: "Studio", locationName: "Jaipur", locationType: "PHYSICAL_LOCATION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
        { locationId: "loc_2", projectId: "p1", businessName: "Studio", locationName: "Delhi", locationType: "PHYSICAL_LOCATION", provenance: { source: "CONFIGURED", retrievedAt: "" } },
      ],
    });

    expect(res.applicability).toBe("MULTI_LOCATION_BUSINESS");
    expect(res.isLocalIntelligenceApplicable).toBe(true);
  });

  it("1.3. Service Area Business (SAB) classified accurately", () => {
    const res = determineLocalSeoApplicability({
      configuredLocations: [
        {
          locationId: "loc_sab",
          projectId: "p1",
          businessName: "Plumbing Express",
          locationName: "Regional Hub",
          locationType: "SERVICE_AREA",
          serviceAreas: [{ name: "Jaipur" }, { name: "Ajmer" }],
          provenance: { source: "CONFIGURED", retrievedAt: "" },
        },
      ],
    });

    expect(res.applicability).toBe("SERVICE_AREA_BUSINESS");
    expect(res.isLocalIntelligenceApplicable).toBe(true);
  });

  it("1.4. Non-local / SaaS / Online-Only site produces 0 false local defects", async () => {
    const res = await analyzeLocalSeoIntelligence({
      projectId: "cloud-saas",
      targetDomain: "cloudsaas.io",
      projectContext: { businessType: "SAAS", hasOnlineOnlyFlag: true },
    });

    expect(res.report.applicability).toBe("ONLINE_ONLY_BUSINESS");
    expect(res.report.providerStatus).toBe("LOCAL_SEO_NOT_APPLICABLE");
    expect(res.report.locations.length).toBe(0);
    expect(res.actions.length).toBe(0); // Zero actions/defects generated
  });
});
