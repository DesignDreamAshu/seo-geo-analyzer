/**
 * Provider Normalization Unit Test Suite
 * Tests conversion of raw PageSpeed JSON into strict internal PerformanceProfile contracts.
 */

import { normalizePageSpeedResponse } from "../provider";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void) {
  try {
    fn();
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
    toBeGreaterThan(expected: number) {
      if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
  };
}

describe("PageSpeed Provider Normalization Tests", () => {
  it("1. Normalizes full URL-level CrUX field data and Lighthouse lab data correctly", () => {
    const mockRaw = {
      lighthouseResult: {
        categories: {
          performance: { score: 0.85 },
        },
        audits: {
          "largest-contentful-paint": { numericValue: 2200 },
          "cumulative-layout-shift": { numericValue: 0.05 },
          "total-blocking-time": { numericValue: 150 },
          "first-contentful-paint": { numericValue: 1200 },
          "speed-index": { numericValue: 2400 },
          "server-response-time": { numericValue: 350 },
          "largest-contentful-paint-element": {
            details: {
              items: [
                {
                  node: { selector: "div.hero > img", snippet: "<img src='hero.webp' loading='eager'>" },
                  url: "https://example.com/hero.webp",
                  type: "image",
                },
              ],
            },
          },
        },
      },
      loadingExperience: {
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2100 },
          INTERACTION_TO_NEXT_PAINT: { percentile: 140 },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 4 }, // 0.04
        },
      },
    };

    const profile = normalizePageSpeedResponse(mockRaw, "mobile");
    expect(profile).toBeTruthy();
    expect(profile?.performanceScore).toBe(85);
    expect(profile?.lab.lcpMs).toBe(2200);
    expect(profile?.lab.tbtMs).toBe(150);
    expect(profile?.field.fieldDataScope).toBe("URL");
    expect(profile?.field.sampleAvailable).toBe(true);
    expect(profile?.field.lcpP75Ms).toBe(2100);
    expect(profile?.field.inpP75Ms).toBe(140);
    expect(profile?.field.clsP75).toBe(0.04);
    expect(profile?.field.overallCategory).toBe("GOOD");
    expect(profile?.lcpDiagnosis?.isLazyLoaded).toBe(false);
  });

  it("2. Correctly flags ORIGIN fallback when URL-level field data is unavailable", () => {
    const mockOriginOnly = {
      lighthouseResult: {
        categories: { performance: { score: 0.65 } },
        audits: {
          "largest-contentful-paint": { numericValue: 3200 },
        },
      },
      loadingExperience: { metrics: {} },
      originLoadingExperience: {
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4200 }, // POOR on origin
          INTERACTION_TO_NEXT_PAINT: { percentile: 250 },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 15 }, // 0.15
        },
      },
    };

    const profile = normalizePageSpeedResponse(mockOriginOnly, "mobile");
    expect(profile?.field.fieldDataScope).toBe("ORIGIN");
    expect(profile?.field.sampleAvailable).toBe(true);
    expect(profile?.field.lcpP75Ms).toBe(4200);
    expect(profile?.field.overallCategory).toBe("POOR");
  });

  it("3. Handles lab-only response when no CrUX data exists", () => {
    const mockLabOnly = {
      lighthouseResult: {
        categories: { performance: { score: 0.45 } },
        audits: {
          "largest-contentful-paint": { numericValue: 4800 },
          "cumulative-layout-shift": { numericValue: 0.32 },
          "total-blocking-time": { numericValue: 750 },
        },
      },
    };

    const profile = normalizePageSpeedResponse(mockLabOnly, "mobile");
    expect(profile?.field.fieldDataScope).toBe("NONE");
    expect(profile?.field.sampleAvailable).toBe(false);
    expect(profile?.field.lcpP75Ms).toBe(undefined);
    expect(profile?.lab.lcpMs).toBe(4800);
    expect(profile?.lab.cls).toBe(0.32);
    expect(profile?.lab.tbtMs).toBe(750);
  });

  it("4. Returns undefined safely on empty/invalid JSON", () => {
    expect(normalizePageSpeedResponse(null, "mobile")).toBe(undefined);
    expect(normalizePageSpeedResponse({}, "desktop")).toBeTruthy();
  });
});
