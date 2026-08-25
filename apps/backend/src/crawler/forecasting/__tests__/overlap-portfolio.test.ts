/**
 * Action Overlap & Portfolio Deduplication Tests.
 * Proves that multiple actions in the same opportunity pool do not inflate total traffic forecasts.
 */

import { computePortfolioScenarios } from "../overlap-deduplicator";
import { SeoImpactEstimate } from "../types";

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

describe("3. Action Overlap & Portfolio Deduplication", () => {
  it("3.1. Two actions competing for the SAME_OPPORTUNITY_POOL do NOT double-count upside", () => {
    const act1: SeoImpactEstimate = {
      actionId: "act_title_ctr",
      projectId: "p1",
      title: "Improve Title CTR on /services/cmdb",
      impactNature: "CONDITIONAL_SCENARIO_RANGE",
      forecastability: "HIGHLY_FORECASTABLE",
      quantificationSupported: true,
      scenarioMethod: "SAME_SITE_COHORT_BENCHMARK",
      affectedUrls: ["https://example.com/services/cmdb"],
      opportunityPoolId: "POOL_URL_SERVICES_CMDB",
      overlapState: "SAME_OPPORTUNITY_POOL",
      observedExposure: { historicalMonthlyImpressions: 10000, historicalMonthlyClicks: 200, historicalAverageCtr: 2.0, affectedUrlsCount: 1, affectedQueryClustersCount: 1, evidencePeriodRange: "28d" },
      baselineType: "HISTORICAL_HEALTHY_PERIOD",
      seasonalComparability: "STRONG",
      isBaselineAnomalyFree: true,
      scenarios: {
        conservative: { minMonthlyClicks: 50, maxMonthlyClicks: 100, scenarioDescription: "c" },
        base: { minMonthlyClicks: 100, maxMonthlyClicks: 200, scenarioDescription: "b" },
        upside: { minMonthlyClicks: 200, maxMonthlyClicks: 300, scenarioDescription: "u" },
      },
      confidence: "HIGH",
      uncertaintyReasons: [],
      downsideRisk: "LOW_RISK",
      reversibility: "HIGHLY_REVERSIBLE",
      dependencyBlockedByActionIds: [],
      isIndexationDependent: false,
      modelVersion: "1.0.0",
      policyVersion: "1.0.0",
    };

    const act2: SeoImpactEstimate = {
      actionId: "act_content_expand",
      projectId: "p1",
      title: "Expand Content on /services/cmdb",
      impactNature: "CONDITIONAL_SCENARIO_RANGE",
      forecastability: "HIGHLY_FORECASTABLE",
      quantificationSupported: true,
      scenarioMethod: "SAME_SITE_COHORT_BENCHMARK",
      affectedUrls: ["https://example.com/services/cmdb"],
      opportunityPoolId: "POOL_URL_SERVICES_CMDB",
      overlapState: "SAME_OPPORTUNITY_POOL",
      observedExposure: { historicalMonthlyImpressions: 10000, historicalMonthlyClicks: 200, historicalAverageCtr: 2.0, affectedUrlsCount: 1, affectedQueryClustersCount: 1, evidencePeriodRange: "28d" },
      baselineType: "HISTORICAL_HEALTHY_PERIOD",
      seasonalComparability: "STRONG",
      isBaselineAnomalyFree: true,
      scenarios: {
        conservative: { minMonthlyClicks: 40, maxMonthlyClicks: 80, scenarioDescription: "c" },
        base: { minMonthlyClicks: 80, maxMonthlyClicks: 150, scenarioDescription: "b" },
        upside: { minMonthlyClicks: 150, maxMonthlyClicks: 250, scenarioDescription: "u" },
      },
      confidence: "HIGH",
      uncertaintyReasons: [],
      downsideRisk: "LOW_RISK",
      reversibility: "HIGHLY_REVERSIBLE",
      dependencyBlockedByActionIds: [],
      isIndexationDependent: false,
      modelVersion: "1.0.0",
      policyVersion: "1.0.0",
    };

    const portfolio = computePortfolioScenarios([act1, act2], "p1");

    // Naive sum of upside max would be 300 + 250 = 550.
    // Pool deduplication takes pool max = 300!
    expect(portfolio.portfolioScenarios.upsideMonthlyClicksRange.max).toBe(300);
    expect(portfolio.portfolioScenarios.baseMonthlyClicksRange.max).toBe(200);
  });
});
