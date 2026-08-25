/**
 * Scenario Modeling Engine.
 * Constructs non-probabilistic conditional scenario ranges (conservative, base, upside).
 * Prioritizes historical baseline distributions (p25, median, p75) and same-site cohorts over hardcoded assumptions.
 */

import { ImpactScenarioRange, ObservedExposureMetric, ScenarioConstructionMethod } from "./types";

export interface ScenarioGenerationInput {
  modelType: "CTR_BENCHMARK_OPTIMIZATION" | "TECHNICAL_RECOVERY" | "CONTENT_STRUCTURE_EXPANSION" | "GENERIC_OPPORTUNITY";
  observedExposure: ObservedExposureMetric;
  historicalPreRegressionMonthlyClicks?: number;
  sameSiteBenchmarkCtrPercent?: number; // e.g. 2.5%
  userConfiguredAssumptions?: {
    conservativeMultiplier: number;
    baseMultiplier: number;
    upsideMultiplier: number;
  };
}

export function generateImpactScenarios(input: ScenarioGenerationInput): {
  scenarios: {
    conservative: ImpactScenarioRange;
    base: ImpactScenarioRange;
    upside: ImpactScenarioRange;
  };
  scenarioMethod: ScenarioConstructionMethod;
} {
  const imp = input.observedExposure.historicalMonthlyImpressions;
  const currentClicks = input.observedExposure.historicalMonthlyClicks;
  const currentCtr = input.observedExposure.historicalAverageCtr;
  const dist = input.observedExposure.baselineDistribution;

  // 1. Technical Recovery from Historical Baseline Distribution
  if (input.modelType === "TECHNICAL_RECOVERY" && input.historicalPreRegressionMonthlyClicks) {
    const lostMonthlyClicks = Math.max(0, input.historicalPreRegressionMonthlyClicks - currentClicks);

    if (dist && dist.p25MonthlyClicks !== undefined && dist.p75MonthlyClicks !== undefined) {
      // Evidence-derived ranges from historical quartiles
      const p25Recovery = Math.max(0, dist.p25MonthlyClicks - currentClicks);
      const medianRecovery = Math.max(0, dist.medianMonthlyClicks - currentClicks);
      const p75Recovery = Math.max(0, dist.p75MonthlyClicks - currentClicks);

      return {
        scenarios: {
          conservative: {
            minMonthlyClicks: Math.min(p25Recovery, medianRecovery),
            maxMonthlyClicks: medianRecovery,
            scenarioDescription: "Conditional recovery based on historical p25 to median distribution.",
          },
          base: {
            minMonthlyClicks: medianRecovery,
            maxMonthlyClicks: Math.round((medianRecovery + p75Recovery) / 2),
            scenarioDescription: "Conditional recovery based on historical median to upper-quartile performance.",
          },
          upside: {
            minMonthlyClicks: Math.round((medianRecovery + p75Recovery) / 2),
            maxMonthlyClicks: p75Recovery,
            scenarioDescription: "Conditional recovery reaching historical p75 performance window.",
          },
        },
        scenarioMethod: "SAME_URL_HISTORICAL_DISTRIBUTION",
      };
    }

    // Fallback: Assumption-driven recovery range
    return {
      scenarios: {
        conservative: {
          minMonthlyClicks: Math.round(lostMonthlyClicks * 0.3),
          maxMonthlyClicks: Math.round(lostMonthlyClicks * 0.6),
          scenarioDescription: "Assumption-driven conservative recovery (30-60% of lost historical clicks).",
        },
        base: {
          minMonthlyClicks: Math.round(lostMonthlyClicks * 0.6),
          maxMonthlyClicks: Math.round(lostMonthlyClicks * 0.9),
          scenarioDescription: "Assumption-driven base recovery (60-90% of lost historical clicks).",
        },
        upside: {
          minMonthlyClicks: Math.round(lostMonthlyClicks * 0.9),
          maxMonthlyClicks: Math.round(lostMonthlyClicks * 1.1),
          scenarioDescription: "Assumption-driven upside recovery (90-110% of lost historical clicks).",
        },
      },
      scenarioMethod: "ASSUMPTION_DRIVEN_SCENARIO",
    };
  }

  // 2. CTR Benchmark Optimization Scenario
  if (input.modelType === "CTR_BENCHMARK_OPTIMIZATION" && input.sameSiteBenchmarkCtrPercent) {
    const targetCtr = input.sameSiteBenchmarkCtrPercent;
    const currentRate = currentCtr / 100;
    const targetRate = targetCtr / 100;

    if (targetRate > currentRate && imp > 0) {
      const fullDeltaClicks = imp * (targetRate - currentRate);

      return {
        scenarios: {
          conservative: {
            minMonthlyClicks: Math.round(fullDeltaClicks * 0.25),
            maxMonthlyClicks: Math.round(fullDeltaClicks * 0.5),
            scenarioDescription: "Conditional CTR scenario (moving 25-50% toward same-site cohort benchmark).",
          },
          base: {
            minMonthlyClicks: Math.round(fullDeltaClicks * 0.5),
            maxMonthlyClicks: Math.round(fullDeltaClicks * 0.8),
            scenarioDescription: "Conditional CTR scenario (moving 50-80% toward same-site cohort benchmark).",
          },
          upside: {
            minMonthlyClicks: Math.round(fullDeltaClicks * 0.8),
            maxMonthlyClicks: Math.round(fullDeltaClicks * 1.2),
            scenarioDescription: "Conditional CTR scenario (fully reaching cohort benchmark).",
          },
        },
        scenarioMethod: "SAME_SITE_COHORT_BENCHMARK",
      };
    }
  }

  // 3. User Configured Assumptions
  if (input.userConfiguredAssumptions) {
    const u = input.userConfiguredAssumptions;
    const baseVal = Math.max(10, Math.round(imp * 0.005));
    return {
      scenarios: {
        conservative: {
          minMonthlyClicks: 0,
          maxMonthlyClicks: Math.round(baseVal * u.conservativeMultiplier),
          scenarioDescription: "User-configured conservative assumption.",
        },
        base: {
          minMonthlyClicks: Math.round(baseVal * u.conservativeMultiplier),
          maxMonthlyClicks: Math.round(baseVal * u.baseMultiplier),
          scenarioDescription: "User-configured base assumption.",
        },
        upside: {
          minMonthlyClicks: Math.round(baseVal * u.baseMultiplier),
          maxMonthlyClicks: Math.round(baseVal * u.upsideMultiplier),
          scenarioDescription: "User-configured upside assumption.",
        },
      },
      scenarioMethod: "USER_CONFIGURED_ASSUMPTIONS",
    };
  }

  // 4. Generic Assumption-Driven Fallback
  const baseDelta = Math.max(10, Math.round(imp * 0.005));
  return {
    scenarios: {
      conservative: {
        minMonthlyClicks: 0,
        maxMonthlyClicks: Math.round(baseDelta * 0.5),
        scenarioDescription: "Assumption-driven conservative scenario.",
      },
      base: {
        minMonthlyClicks: Math.round(baseDelta * 0.5),
        maxMonthlyClicks: Math.round(baseDelta * 1.5),
        scenarioDescription: "Assumption-driven base conditional scenario.",
      },
      upside: {
        minMonthlyClicks: Math.round(baseDelta * 1.5),
        maxMonthlyClicks: Math.round(baseDelta * 3.0),
        scenarioDescription: "Assumption-driven upside conditional scenario.",
      },
    },
    scenarioMethod: "ASSUMPTION_DRIVEN_SCENARIO",
  };
}
