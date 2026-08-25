/**
 * Hardened Observed Demand Trend Engine.
 * Evaluates first-party observed GSC query trend changes across comparison periods
 * with configurable policies and strict data quality safeguards.
 */

import { DemandTrendAssessment, DemandTrendState, QueryCluster } from "./types";
import { GscDataQuality } from "../opportunity/types";
import { DemandScalePolicy, DEFAULT_DEMAND_POLICY } from "./config";

export function evaluateDemandTrend(
  cluster: QueryCluster,
  comparisonPeriodImpressions?: number,
  dataQuality: GscDataQuality = "FRESH_COMPLETE",
  policy: DemandScalePolicy = DEFAULT_DEMAND_POLICY,
  isPeriodMismatched: boolean = false
): DemandTrendAssessment {
  const current = cluster.totalObservedImpressions;

  // 1. Data Quality & Comparability Guards
  if (dataQuality === "NOT_AVAILABLE" || dataQuality === "STALE" || isPeriodMismatched) {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      trendState: "INSUFFICIENT_DATA",
      currentPeriodImpressions: current,
      comparisonPeriodImpressions,
      isLowVolumeSample: false,
      rationale: `Trend analysis suppressed due to GSC data quality state: ${dataQuality}${isPeriodMismatched ? " (Comparison Period Mismatched)" : ""}.`,
    };
  }

  // 2. Low Volume Sample Guard
  if (current < policy.minImpressionsForTrendEvaluation && (comparisonPeriodImpressions || 0) < policy.minImpressionsForTrendEvaluation) {
    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      trendState: "INSUFFICIENT_DATA",
      currentPeriodImpressions: current,
      comparisonPeriodImpressions,
      isLowVolumeSample: true,
      rationale: `Volume is too low (<${policy.minImpressionsForTrendEvaluation} impressions) to establish a statistically meaningful observed visibility trend.`,
    };
  }

  // 3. Emerging Demand (New query cluster with zero or minimal prior history)
  if (comparisonPeriodImpressions !== undefined) {
    if (comparisonPeriodImpressions <= 5 && current >= policy.minImpressionsForEmergingDemand) {
      return {
        clusterId: cluster.clusterId,
        representativeLabel: cluster.representativeLabel,
        trendState: "EMERGING_DEMAND",
        currentPeriodImpressions: current,
        comparisonPeriodImpressions,
        percentageChange: 100,
        isLowVolumeSample: false,
        rationale: `Newly emerging observed GSC visibility: Cluster grew from ${comparisonPeriodImpressions} to ${current} observed impressions. (Note: Observed visibility within property, not total third-party market demand).`,
      };
    }

    const diff = current - comparisonPeriodImpressions;
    const pct = comparisonPeriodImpressions > 0 ? (diff / comparisonPeriodImpressions) * 100 : 0;

    let trendState: DemandTrendState = "STABLE_DEMAND";
    if (pct >= policy.trendGrowingPercentageThreshold && diff >= policy.trendMinAbsoluteChange) {
      trendState = "GROWING_DEMAND";
    } else if (pct <= policy.trendDecliningPercentageThreshold && diff <= -policy.trendMinAbsoluteChange) {
      trendState = "DECLINING_DEMAND";
    } else {
      trendState = "STABLE_DEMAND";
    }

    return {
      clusterId: cluster.clusterId,
      representativeLabel: cluster.representativeLabel,
      trendState,
      currentPeriodImpressions: current,
      comparisonPeriodImpressions,
      percentageChange: Math.round(pct * 10) / 10,
      isLowVolumeSample: false,
      rationale: `Observed GSC impressions for this query cluster ${trendState === "GROWING_DEMAND" ? "increased" : trendState === "DECLINING_DEMAND" ? "decreased" : "remained stable"} by ${Math.abs(Math.round(pct))}% during the evaluated period.`,
    };
  }

  return {
    clusterId: cluster.clusterId,
    representativeLabel: cluster.representativeLabel,
    trendState: "STABLE_DEMAND",
    currentPeriodImpressions: current,
    isLowVolumeSample: false,
    rationale: "No prior comparison period data available; treated as active baseline demand.",
  };
}
