/**
 * Action Overlap & Portfolio Opportunity Pool Deduplicator.
 * Implements sequence-aware dependency handling, partial overlap discounting,
 * opportunity pool deduplication, and template blast-radius safeguards.
 */

import { SeoImpactEstimate, PortfolioForecastSummary, BusinessEconomicsConfig } from "./types";
import { ForecastingPolicy, DEFAULT_FORECASTING_POLICY } from "./config";
import { computeBusinessScenarios } from "./business-roi";

export function computePortfolioScenarios(
  estimates: SeoImpactEstimate[],
  projectId: string,
  policy: ForecastingPolicy = DEFAULT_FORECASTING_POLICY,
  businessEconomics?: BusinessEconomicsConfig
): PortfolioForecastSummary {
  let totalObservedClicks = 0;
  let totalObservedImpressions = 0;

  let quantifiableCount = 0;
  let unquantifiedCount = 0;

  // Pools for SAME_OPPORTUNITY_POOL / HIGHLY_OVERLAPPING
  const poolMaxConservative = new Map<string, number>();
  const poolMaxBase = new Map<string, number>();
  const poolMaxUpside = new Map<string, number>();

  let independentConservativeMin = 0;
  let independentConservativeMax = 0;
  let independentBaseMin = 0;
  let independentBaseMax = 0;
  let independentUpsideMin = 0;
  let independentUpsideMax = 0;

  const topExposureActions: SeoImpactEstimate[] = [...estimates].sort(
    (a, b) => b.observedExposure.historicalMonthlyClicks - a.observedExposure.historicalMonthlyClicks
  );

  const topUpsideActions: SeoImpactEstimate[] = [...estimates]
    .filter((e) => e.quantificationSupported && e.scenarios)
    .sort((a, b) => (b.scenarios?.upside.maxMonthlyClicks || 0) - (a.scenarios?.upside.maxMonthlyClicks || 0));

  const nonQuantifiableHighValueActions = estimates.filter((e) => !e.quantificationSupported);

  for (const est of estimates) {
    totalObservedClicks += est.observedExposure.historicalMonthlyClicks;
    totalObservedImpressions += est.observedExposure.historicalMonthlyImpressions;

    if (est.quantificationSupported && est.scenarios) {
      quantifiableCount++;
      const poolId = est.opportunityPoolId || est.affectedUrls[0] || est.actionId;

      // 1. Dependency-aware Sequencing: If blocked by dependencies, immediate upside is deferred
      if (est.overlapState === "DEPENDENT" || est.dependencyBlockedByActionIds.length > 0) {
        // Sequenced action: upside deferred until blocker resolves
        continue;
      }

      // 2. Same Pool or Highly Overlapping
      if (est.overlapState === "SAME_OPPORTUNITY_POOL" || est.overlapState === "HIGHLY_OVERLAPPING") {
        poolMaxConservative.set(
          poolId,
          Math.max(poolMaxConservative.get(poolId) || 0, est.scenarios.conservative.maxMonthlyClicks)
        );
        poolMaxBase.set(poolId, Math.max(poolMaxBase.get(poolId) || 0, est.scenarios.base.maxMonthlyClicks));
        poolMaxUpside.set(poolId, Math.max(poolMaxUpside.get(poolId) || 0, est.scenarios.upside.maxMonthlyClicks));
      }
      // 3. Partially Overlapping with Explicit Coefficient
      else if (est.overlapState === "PARTIALLY_OVERLAPPING") {
        const coef = est.overlapAdjustmentCoefficient ?? policy.defaultPartialOverlapCoefficient;
        independentConservativeMin += Math.round(est.scenarios.conservative.minMonthlyClicks * coef);
        independentConservativeMax += Math.round(est.scenarios.conservative.maxMonthlyClicks * coef);
        independentBaseMin += Math.round(est.scenarios.base.minMonthlyClicks * coef);
        independentBaseMax += Math.round(est.scenarios.base.maxMonthlyClicks * coef);
        independentUpsideMin += Math.round(est.scenarios.upside.minMonthlyClicks * coef);
        independentUpsideMax += Math.round(est.scenarios.upside.maxMonthlyClicks * coef);
      }
      // 4. Independent Actions (or UNKNOWN_OVERLAP conservative handling)
      else {
        const discount = est.overlapState === "UNKNOWN_OVERLAP" ? 0.5 : 1.0;
        independentConservativeMin += Math.round(est.scenarios.conservative.minMonthlyClicks * discount);
        independentConservativeMax += Math.round(est.scenarios.conservative.maxMonthlyClicks * discount);
        independentBaseMin += Math.round(est.scenarios.base.minMonthlyClicks * discount);
        independentBaseMax += Math.round(est.scenarios.base.maxMonthlyClicks * discount);
        independentUpsideMin += Math.round(est.scenarios.upside.minMonthlyClicks * discount);
        independentUpsideMax += Math.round(est.scenarios.upside.maxMonthlyClicks * discount);
      }
    } else {
      unquantifiedCount++;
    }
  }

  // Sum pool maxes with independent/partial sums
  let poolConservativeTotal = 0;
  let poolBaseTotal = 0;
  let poolUpsideTotal = 0;

  for (const v of poolMaxConservative.values()) poolConservativeTotal += v;
  for (const v of poolMaxBase.values()) poolBaseTotal += v;
  for (const v of poolMaxUpside.values()) poolUpsideTotal += v;

  const portfolioScenarios = {
    conservativeMonthlyClicksRange: {
      min: independentConservativeMin,
      max: independentConservativeMax + poolConservativeTotal,
    },
    baseMonthlyClicksRange: {
      min: independentBaseMin,
      max: independentBaseMax + poolBaseTotal,
    },
    upsideMonthlyClicksRange: {
      min: independentUpsideMin,
      max: independentUpsideMax + poolUpsideTotal,
    },
  };

  let portfolioBusinessScenarios: PortfolioForecastSummary["portfolioBusinessScenarios"] | undefined;
  if (businessEconomics && businessEconomics.funnel && businessEconomics.funnel.averageOrderValueOrLtv) {
    const busRes = computeBusinessScenarios(
      {
        conservative: { minMonthlyClicks: portfolioScenarios.conservativeMonthlyClicksRange.min, maxMonthlyClicks: portfolioScenarios.conservativeMonthlyClicksRange.max, scenarioDescription: "Conservative" },
        base: { minMonthlyClicks: portfolioScenarios.baseMonthlyClicksRange.min, maxMonthlyClicks: portfolioScenarios.baseMonthlyClicksRange.max, scenarioDescription: "Base" },
        upside: { minMonthlyClicks: portfolioScenarios.upsideMonthlyClicksRange.min, maxMonthlyClicks: portfolioScenarios.upsideMonthlyClicksRange.max, scenarioDescription: "Upside" },
      },
      businessEconomics
    );

    if (busRes.conservativeMonthlyRevenue && busRes.baseMonthlyRevenue && busRes.upsideMonthlyRevenue) {
      portfolioBusinessScenarios = {
        conservativeMonthlyRevenueRange: busRes.conservativeMonthlyRevenue,
        baseMonthlyRevenueRange: busRes.baseMonthlyRevenue,
        upsideMonthlyRevenueRange: busRes.upsideMonthlyRevenue,
        estimatedScenarioRoiRange: busRes.estimatedScenarioRoi !== undefined ? { baseRoi: busRes.estimatedScenarioRoi, currency: businessEconomics.funnel.currency } : undefined,
        totalPortfolioCost: busRes.totalImplementationCost,
      };
    }
  }

  return {
    projectId,
    totalActionsEvaluated: estimates.length,
    quantifiableActionsCount: quantifiableCount,
    unquantifiedActionsCount: unquantifiedCount,
    totalObservedMonthlyClicksExposure: totalObservedClicks,
    totalObservedMonthlyImpressionsExposure: totalObservedImpressions,
    portfolioScenarios,
    portfolioBusinessScenarios,
    topExposureActions: topExposureActions.slice(0, 10),
    topUpsideActions: topUpsideActions.slice(0, 10),
    nonQuantifiableHighValueActions: nonQuantifiableHighValueActions.slice(0, 10),
  };
}
