/**
 * Business Value & ROI Modeling Tests.
 * Proves that monetary ROI is calculated only when real business inputs are provided.
 */

import { computeBusinessScenarios } from "../business-roi";

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

describe("4. Business Value & ROI Modeling", () => {
  it("4.1. Without configured business economics, returns NO_BUSINESS_DATA without fabricating revenue", () => {
    const scenarios = {
      conservative: { minMonthlyClicks: 100, maxMonthlyClicks: 200, scenarioDescription: "c" },
      base: { minMonthlyClicks: 200, maxMonthlyClicks: 400, scenarioDescription: "b" },
      upside: { minMonthlyClicks: 400, maxMonthlyClicks: 600, scenarioDescription: "u" },
    };

    const res = computeBusinessScenarios(scenarios, undefined);
    expect(res.businessDataState).toBe("NO_BUSINESS_DATA");
    expect(res.baseMonthlyRevenue).toBe(undefined);
  });

  it("4.2. With valid conversion rate and deal value, calculates revenue ranges and ROI accurately", () => {
    const scenarios = {
      conservative: { minMonthlyClicks: 100, maxMonthlyClicks: 200, scenarioDescription: "c" },
      base: { minMonthlyClicks: 200, maxMonthlyClicks: 400, scenarioDescription: "b" },
      upside: { minMonthlyClicks: 400, maxMonthlyClicks: 600, scenarioDescription: "u" },
    };

    // 2% stage 1 * 50% stage 2 = 1% effective conversion rate. $1,000 deal value = $10 per click.
    const res = computeBusinessScenarios(
      scenarios,
      {
        funnel: {
          funnelType: "LEAD_GENERATION",
          currency: "USD",
          stage1ConversionRatePercent: 2.0,
          stage2ConversionRatePercent: 50.0,
          averageOrderValueOrLtv: 1000,
          grossMarginPercent: 70,
        },
        costs: {
          internalHourlyCost: 100,
          estimatedHours: 10, // $1,000 cost
        },
      }
    );

    expect(res.businessDataState).toBe("BUSINESS_DATA_AVAILABLE");
    expect(res.baseMonthlyRevenue?.min).toBe(2000); // 200 * $10
    expect(res.baseMonthlyRevenue?.max).toBe(4000); // 400 * $10
    expect(res.baseMonthlyRevenue?.currency).toBe("USD");
    expect(res.estimatedScenarioRoi).toBe(48); // Annual base rev ($4,000 * 12 = $48,000) / $1,000 cost = 48.0
    expect(res.estimatedScenarioProfitRoi).toBe(33.6); // 48 * 0.70 = 33.6
  });
});
