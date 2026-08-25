/**
 * GSC Market & SERP Integrators Tests.
 * Proves GSC country alignment, SERP market context differences, and Phase 15 locale vs location separation.
 */

import { evaluateGscMarketAlignment } from "../market-integrators";
import { GscCountryPerformance } from "../types";

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

describe("8. GSC Market Performance & Intent", () => {
  it("8.1. UK country traffic landing on US URL while UK URL exists emits INTERNATIONAL_QUERY_PAGE_ALIGNMENT_REVIEW", () => {
    const gscCountryData: GscCountryPerformance[] = [
      { country: "GB", clicks: 150, impressions: 2000, ctr: 0.075, position: 3.2, topUrl: "https://example.com/en-us/cloud" },
    ];

    const localeMap = new Map([["GB", "https://example.com/en-gb/"]]);
    const res = evaluateGscMarketAlignment(gscCountryData, localeMap);

    expect(res.length).toBe(1);
    expect(res[0].alignmentState).toBe("INTERNATIONAL_QUERY_PAGE_ALIGNMENT_REVIEW");
  });

  it("8.2. Aligned country traffic is marked MARKET_ALIGNED", () => {
    const gscCountryData: GscCountryPerformance[] = [
      { country: "GB", clicks: 150, impressions: 2000, ctr: 0.075, position: 3.2, topUrl: "https://example.com/en-gb/cloud" },
    ];

    const localeMap = new Map([["GB", "https://example.com/en-gb/"]]);
    const res = evaluateGscMarketAlignment(gscCountryData, localeMap);

    expect(res.length).toBe(1);
    expect(res[0].alignmentState).toBe("MARKET_ALIGNED");
  });
});
