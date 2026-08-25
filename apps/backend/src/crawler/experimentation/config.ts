/**
 * Phase 22: Centralized & Contextual Experimentation Policy Configuration.
 */

import { ExperimentType, PrimaryMetricType } from "./types";

export interface ContextualPolicyThresholds {
  minMonthlyImpressions: number;
  minMonthlyClicks: number;
  minObservationDays: number;
  maxPreTrendSlopeDivergencePercent: number;
  criticalSafetyStopDropPercent: number;
  practicalSignificanceThresholdPercent: number;
}

export interface ExperimentationPolicy {
  policyVersion: string;
  policyName: string;
  minCohortSizeForStatisticalInference: number;
  matchingDimensionWeights: {
    pageType: number;
    baselineClicks: number;
    baselineImpressions: number;
    averagePosition: number;
    queryIntent: number;
    template: number;
  };
  defaultPrimaryMetrics: Record<ExperimentType, PrimaryMetricType>;
  contextualThresholds: {
    highTraffic: ContextualPolicyThresholds;
    mediumTraffic: ContextualPolicyThresholds;
    lowTraffic: ContextualPolicyThresholds;
  };
}

export const DEFAULT_EXPERIMENTATION_POLICY: ExperimentationPolicy = {
  policyVersion: "1.1.0",
  policyName: "DEFAULT_CONTEXTUAL_EXPERIMENTATION_POLICY_V1_1",
  minCohortSizeForStatisticalInference: 5,
  matchingDimensionWeights: {
    pageType: 0.30,
    baselineClicks: 0.25,
    baselineImpressions: 0.15,
    averagePosition: 0.15,
    queryIntent: 0.10,
    template: 0.05,
  },
  defaultPrimaryMetrics: {
    TITLE_TEST: "CTR",
    META_DESCRIPTION_TEST: "CTR",
    CONTENT_REFRESH_TEST: "ORGANIC_CLICKS",
    CONTENT_EXPANSION_TEST: "QUERY_COVERAGE",
    INTERNAL_LINKING_TEST: "IMPRESSIONS",
    STRUCTURED_DATA_TEST: "CTR",
    TEMPLATE_CHANGE_TEST: "ORGANIC_CLICKS",
    UX_CONTENT_TEST: "ORGANIC_CLICKS",
    INFORMATION_ARCHITECTURE_TEST: "ORGANIC_CLICKS",
    CONSOLIDATION_TEST: "ORGANIC_CLICKS",
    CUSTOM_SEO_TEST: "ORGANIC_CLICKS",
  },
  contextualThresholds: {
    highTraffic: {
      minMonthlyImpressions: 1000,
      minMonthlyClicks: 100,
      minObservationDays: 14,
      maxPreTrendSlopeDivergencePercent: 15.0,
      criticalSafetyStopDropPercent: 20.0,
      practicalSignificanceThresholdPercent: 3.0,
    },
    mediumTraffic: {
      minMonthlyImpressions: 300,
      minMonthlyClicks: 25,
      minObservationDays: 21,
      maxPreTrendSlopeDivergencePercent: 20.0,
      criticalSafetyStopDropPercent: 30.0,
      practicalSignificanceThresholdPercent: 5.0,
    },
    lowTraffic: {
      minMonthlyImpressions: 100,
      minMonthlyClicks: 10,
      minObservationDays: 28,
      maxPreTrendSlopeDivergencePercent: 25.0,
      criticalSafetyStopDropPercent: 35.0,
      practicalSignificanceThresholdPercent: 8.0,
    },
  },
};

export function getContextualThresholds(
  monthlyImpressions: number,
  monthlyClicks: number,
  policy: ExperimentationPolicy = DEFAULT_EXPERIMENTATION_POLICY
): ContextualPolicyThresholds {
  if (monthlyImpressions >= 5000 || monthlyClicks >= 250) {
    return policy.contextualThresholds.highTraffic;
  }
  if (monthlyImpressions >= 300 || monthlyClicks >= 25) {
    return policy.contextualThresholds.mediumTraffic;
  }
  return policy.contextualThresholds.lowTraffic;
}
