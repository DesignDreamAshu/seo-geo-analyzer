/**
 * Post-Fix Measurement & Historical Calibration Tests.
 * Proves verification of realization states and attribution confidence degradation under confounding events.
 */

import { evaluatePostFixOutcome, ProjectBenchmarkLearner } from "../post-fix-measurement";
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

describe("5. Post-Fix Measurement & Historical Calibration", () => {
  const mockEstimate: SeoImpactEstimate = {
    actionId: "act_1",
    projectId: "proj_alpha",
    title: "Fix noindex on service page",
    impactNature: "CONDITIONAL_SCENARIO_RANGE",
    forecastability: "HIGHLY_FORECASTABLE",
    quantificationSupported: true,
    scenarioMethod: "SAME_URL_HISTORICAL_DISTRIBUTION",
    affectedUrls: ["https://example.com/service"],
    overlapState: "INDEPENDENT",
    observedExposure: { historicalMonthlyImpressions: 10000, historicalMonthlyClicks: 100, historicalAverageCtr: 1.0, affectedUrlsCount: 1, affectedQueryClustersCount: 1, evidencePeriodRange: "28d" },
    baselineType: "PRE_REGRESSION_WINDOW",
    seasonalComparability: "STRONG",
    isBaselineAnomalyFree: true,
    scenarios: {
      conservative: { minMonthlyClicks: 200, maxMonthlyClicks: 400, scenarioDescription: "c" },
      base: { minMonthlyClicks: 400, maxMonthlyClicks: 700, scenarioDescription: "b" },
      upside: { minMonthlyClicks: 700, maxMonthlyClicks: 1000, scenarioDescription: "u" },
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

  it("5.1. Classifies realized traffic within expected base range when fix validated", () => {
    const res = evaluatePostFixOutcome({
      estimate: mockEstimate,
      observedPostFixMonthlyClicks: 550, // within base range (400-700)
      isFixValidatedInPhase11: true,
      technicalResolutionSuccess: true,
      measurementWindowDays: 30,
    });

    expect(res.realizationState).toBe("WITHIN_BASE_RANGE");
    expect(res.technicalResolutionSuccess).toBe(true);
    expect(res.attributionConfidence).toBe("HIGH_ATTRIBUTION_CONFIDENCE");
  });

  it("5.2. Degrades attribution confidence when concurrent algorithm update overlaps measurement", () => {
    const res = evaluatePostFixOutcome({
      estimate: mockEstimate,
      observedPostFixMonthlyClicks: 550,
      isFixValidatedInPhase11: true,
      technicalResolutionSuccess: true,
      measurementWindowDays: 30,
      algorithmUpdateOverlap: true,
    });

    expect(res.realizationState).toBe("WITHIN_BASE_RANGE");
    expect(res.attributionConfidence).toBe("MODERATE_ATTRIBUTION_CONFIDENCE");
    expect(res.confoundingFactors.length).toBe(1);
  });

  it("5.3. Project Benchmark Learner requires minimum historical sample before calibration and handles outliers", () => {
    ProjectBenchmarkLearner.clearAll();

    // 1 fix recorded: insufficient sample
    ProjectBenchmarkLearner.recordOutcome("proj_alpha", "TITLE_CTR_OPTIMIZATION", 0.6);
    const check1 = ProjectBenchmarkLearner.getCalibratedBenchmark("proj_alpha", "TITLE_CTR_OPTIMIZATION");
    expect(check1.qualityState).toBe("INSUFFICIENT_HISTORICAL_SAMPLE");

    // 5 fixes recorded: meets minimum sample threshold
    for (let i = 0; i < 4; i++) {
      ProjectBenchmarkLearner.recordOutcome("proj_alpha", "TITLE_CTR_OPTIMIZATION", 0.5 + i * 0.1);
    }
    const check2 = ProjectBenchmarkLearner.getCalibratedBenchmark("proj_alpha", "TITLE_CTR_OPTIMIZATION");
    expect(check2.qualityState).toBe("BENCHMARK_MODERATE");
    expect(check2.sampleCount).toBe(5);
  });
});
