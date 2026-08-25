/**
 * First-Party Observed Exposure & Baseline Distribution Engine.
 * Extracts and aggregates real observed search performance, position stability, and anomaly-checked baseline distributions.
 */

import { ObservedExposureMetric, HistoricalBaselineDistribution } from "./types";

export interface ExposureInputData {
  impressions?: number;
  clicks?: number;
  avgCtr?: number;
  avgPosition?: number;
  positionVolatilityStdDev?: number;
  affectedUrls: string[];
  queryClustersCount?: number;
  referringDomainsCount?: number;
  periodRange?: string;
  historicalPeriodMonthlyClicks?: number[]; // Array of monthly clicks to compute distribution
  anomalyNotes?: string[];
}

export function computeObservedExposure(input: ExposureInputData): ObservedExposureMetric {
  const imp = input.impressions || 0;
  const clk = input.clicks || 0;
  const calculatedCtr = imp > 0 ? (clk / imp) * 100 : input.avgCtr || 0;

  let baselineDist: HistoricalBaselineDistribution | undefined;
  if (input.historicalPeriodMonthlyClicks && input.historicalPeriodMonthlyClicks.length > 0) {
    const sorted = [...input.historicalPeriodMonthlyClicks].sort((a, b) => a - b);
    const n = sorted.length;
    const median = sorted[Math.floor(n / 2)];
    const p25 = sorted[Math.floor(n * 0.25)];
    const p75 = sorted[Math.floor(n * 0.75)];

    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const variance = sorted.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;

    const hasAnomalies = !!(input.anomalyNotes && input.anomalyNotes.length > 0);

    baselineDist = {
      medianMonthlyClicks: median,
      p25MonthlyClicks: p25,
      p75MonthlyClicks: p75,
      dispersionVariance: Math.round(variance * 10) / 10,
      periodCount: n,
      isAnomalyFree: !hasAnomalies,
      anomalyNotes: input.anomalyNotes,
    };
  }

  return {
    historicalMonthlyImpressions: imp,
    historicalMonthlyClicks: clk,
    historicalAverageCtr: Math.round(calculatedCtr * 100) / 100,
    historicalAveragePosition: input.avgPosition,
    positionVolatilityStdDev: input.positionVolatilityStdDev,
    affectedUrlsCount: input.affectedUrls.length,
    affectedQueryClustersCount: input.queryClustersCount || 1,
    referringDomainsCount: input.referringDomainsCount || 0,
    evidencePeriodRange: input.periodRange || "Last 28 days GSC",
    baselineDistribution: baselineDist,
  };
}
