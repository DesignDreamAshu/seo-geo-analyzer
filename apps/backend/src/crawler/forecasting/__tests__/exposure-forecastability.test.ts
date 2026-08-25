/**
 * Observed Exposure & Forecastability Gate Tests.
 * Proves separation of observed exposure from speculative forecasts and enforces low-volume suppression.
 */

import { computeObservedExposure } from "../exposure-engine";
import { evaluateActionForecastability } from "../forecastability-gate";

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

describe("1. Observed Exposure & Forecastability Gate", () => {
  it("1.1. Computes observed search exposure from first-party baseline", () => {
    const exp = computeObservedExposure({
      impressions: 18400,
      clicks: 1220,
      affectedUrls: ["https://example.com/cmdb"],
      queryClustersCount: 42,
      referringDomainsCount: 13,
    });

    expect(exp.historicalMonthlyImpressions).toBe(18400);
    expect(exp.historicalMonthlyClicks).toBe(1220);
    expect(exp.historicalAverageCtr).toBe(6.63);
    expect(exp.affectedUrlsCount).toBe(1);
    expect(exp.referringDomainsCount).toBe(13);
  });

  it("1.2. Classifies deterministic technical fix with pre-regression baseline as HIGHLY_FORECASTABLE", () => {
    const exp = computeObservedExposure({
      impressions: 10000,
      clicks: 50,
      affectedUrls: ["https://example.com/page"],
    });

    const gate = evaluateActionForecastability({
      actionType: "TECHNICAL_FIX",
      ruleCode: "META_ROBOTS_NOINDEX",
      observedExposure: exp,
      hasHistoricalPreRegressionBaseline: true,
    });

    expect(gate.forecastability).toBe("HIGHLY_FORECASTABLE");
    expect(gate.quantificationSupported).toBe(true);
    expect(gate.confidence).toBe("HIGH");
  });

  it("1.3. Suppresses quantification for low-volume sample (<100 imp, <10 clicks)", () => {
    const exp = computeObservedExposure({
      impressions: 40,
      clicks: 2,
      affectedUrls: ["https://example.com/niche"],
    });

    const gate = evaluateActionForecastability({
      actionType: "TECHNICAL_FIX",
      observedExposure: exp,
      hasHistoricalPreRegressionBaseline: false,
    });

    expect(gate.quantificationSupported).toBe(false);
    expect(gate.forecastability).toBe("NOT_FORECASTABLE");
    expect(gate.confidence).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("1.4. Backlink prospecting is strictly classified as unquantified strategic opportunity", () => {
    const exp = computeObservedExposure({
      impressions: 5000,
      clicks: 200,
      affectedUrls: ["https://example.com/prospects"],
    });

    const gate = evaluateActionForecastability({
      actionType: "BACKLINK_OPPORTUNITY",
      observedExposure: exp,
      hasHistoricalPreRegressionBaseline: false,
      isBacklinkProspecting: true,
    });

    expect(gate.quantificationSupported).toBe(false);
    expect(gate.forecastability).toBe("LOW_FORECASTABILITY");
    expect(gate.unquantifiedReason !== undefined).toBe(true);
  });
});
