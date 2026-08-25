/**
 * Location Page Quality & Doorway Safeguards Tests.
 * Proves healthy location page quality assessment and city-token doorway detection.
 */

import { evaluateLocationPagesQuality, RawPageLocationData } from "../location-pages";

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

describe("3. Location Pages & Doorway Safeguards", () => {
  it("3.1. Dedicated healthy location page passes quality checks", () => {
    const pages: RawPageLocationData[] = [
      {
        url: "https://botconsulting.io/locations/jaipur",
        title: "Jaipur Office | BOT Consulting",
        h1: "ServiceNow Consulting Services in Jaipur",
        bodyText: "Visit our Jaipur headquarters on MI Road for enterprise digital transformation and CMDB governance.",
        statusCode: 200,
        isNoindex: false,
        canonicalUrl: "https://botconsulting.io/locations/jaipur",
        hasLocalSchema: true,
        hasAddressText: true,
        hasPhoneText: true,
        hasHoursText: true,
        discoveredInLocationHub: true,
      },
    ];

    const reviews = evaluateLocationPagesQuality(pages);
    expect(reviews.length).toBe(1);
    expect(reviews[0].classification).toBe("LOCATION_DETAIL_PAGE");
    expect(reviews[0].isIndexable).toBe(true);
    expect(reviews[0].hasStructuredData).toBe(true);
    expect(reviews[0].doorwayReviewFinding).toBe(undefined);
  });

  it("3.2. City-token substitution across 5+ duplicate pages triggers LOCAL_DOORWAY_PAGE_REVIEW", () => {
    const templateBody = "We provide premier enterprise consulting services and IT management for leading organizations with full technical support.";
    const cities = ["jaipur", "delhi", "mumbai", "bangalore", "chicago", "austin"];

    const cityPages: RawPageLocationData[] = cities.map((c) => ({
      url: `https://botconsulting.io/seo-${c}`,
      title: `Best SEO in ${c}`,
      h1: `Best SEO Services in ${c}`,
      bodyText: `${templateBody} Serving businesses in ${c} region.`,
      statusCode: 200,
      isNoindex: false,
    }));

    const reviews = evaluateLocationPagesQuality(cityPages);
    expect(reviews.length).toBe(6);
    expect(reviews[0].doorwayReviewFinding?.finding).toBe("LOCAL_DOORWAY_PAGE_REVIEW");
    expect(reviews[0].doorwayReviewFinding?.rationale.includes("Manual review; no automated penalty implied")).toBe(true);
  });
});
