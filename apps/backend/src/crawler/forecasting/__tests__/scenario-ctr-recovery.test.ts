/**
 * Scenario Modeling: CTR Benchmark & Technical Recovery Tests.
 * Proves construction of conservative, base, and upside ranges.
 */

import { generateImpactScenarios } from "../scenario-model";
import { computeObservedExposure } from "../exposure-engine";

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

describe("2. Scenario Modeling: CTR & Technical Recovery", () => {
  it("2.1. Constructs defensible CTR scenario ranges toward same-site cohort benchmark", () => {
    const exp = computeObservedExposure({
      impressions: 20000,
      clicks: 240, // 1.2% CTR
      affectedUrls: ["https://example.com/cmdb"],
    });

    const res = generateImpactScenarios({
      modelType: "CTR_BENCHMARK_OPTIMIZATION",
      observedExposure: exp,
      sameSiteBenchmarkCtrPercent: 2.2, // 1.0% CTR delta = 200 clicks total potential
    });

    const scenarios = res.scenarios;
    expect(scenarios.conservative.minMonthlyClicks).toBe(50);
    expect(scenarios.conservative.maxMonthlyClicks).toBe(100);
    expect(scenarios.base.minMonthlyClicks).toBe(100);
    expect(scenarios.base.maxMonthlyClicks).toBe(160);
    expect(scenarios.upside.minMonthlyClicks).toBe(160);
    expect(scenarios.upside.maxMonthlyClicks).toBe(240);
  });

  it("2.2. Constructs technical recovery scenario based on pre-regression lost clicks", () => {
    const exp = computeObservedExposure({
      impressions: 5000,
      clicks: 20, // regressed
      affectedUrls: ["https://example.com/pricing"],
    });

    const res = generateImpactScenarios({
      modelType: "TECHNICAL_RECOVERY",
      observedExposure: exp,
      historicalPreRegressionMonthlyClicks: 1020, // 1,000 lost clicks
    });

    const scenarios = res.scenarios;
    expect(scenarios.conservative.minMonthlyClicks).toBe(300);
    expect(scenarios.conservative.maxMonthlyClicks).toBe(600);
    expect(scenarios.base.minMonthlyClicks).toBe(600);
    expect(scenarios.base.maxMonthlyClicks).toBe(900);
    expect(scenarios.upside.minMonthlyClicks).toBe(900);
    expect(scenarios.upside.maxMonthlyClicks).toBe(1100);
  });
});
