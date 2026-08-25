/**
 * Phase 12: Content & Search Demand Intelligence Configuration.
 * Centralizes configurable evidence thresholds and policies for demand coverage,
 * clustering, trend evaluation, and cannibalization detection.
 */

export interface DemandScalePolicy {
  policyName: "DEFAULT" | "B2B_NICHE" | "HIGH_VOLUME_PUBLISHER" | "CUSTOM";
  description: string;
  clusteringAlgorithmVersion: string;
  minImpressionsForNewPageCandidate: number;
  minImpressionsForCannibalization: number;
  minImpressionsForTrendEvaluation: number;
  minImpressionsForEmergingDemand: number;
  trendGrowingPercentageThreshold: number;
  trendDecliningPercentageThreshold: number;
  trendMinAbsoluteChange: number;
  maxRankingPositionForStrongFitBonus: number;
}

export const DEFAULT_DEMAND_POLICY: DemandScalePolicy = {
  policyName: "DEFAULT",
  description: "Standard commercial website policy for general business and ecommerce sites.",
  clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
  minImpressionsForNewPageCandidate: 800,
  minImpressionsForCannibalization: 50,
  minImpressionsForTrendEvaluation: 30,
  minImpressionsForEmergingDemand: 50,
  trendGrowingPercentageThreshold: 25,
  trendDecliningPercentageThreshold: -25,
  trendMinAbsoluteChange: 50,
  maxRankingPositionForStrongFitBonus: 3.5,
};

export const B2B_NICHE_DEMAND_POLICY: DemandScalePolicy = {
  policyName: "B2B_NICHE",
  description: "High-value B2B enterprise policy where lower search volume represents significant commercial demand.",
  clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
  minImpressionsForNewPageCandidate: 250,
  minImpressionsForCannibalization: 25,
  minImpressionsForTrendEvaluation: 15,
  minImpressionsForEmergingDemand: 25,
  trendGrowingPercentageThreshold: 20,
  trendDecliningPercentageThreshold: -20,
  trendMinAbsoluteChange: 20,
  maxRankingPositionForStrongFitBonus: 4.5,
};

export const HIGH_VOLUME_DEMAND_POLICY: DemandScalePolicy = {
  policyName: "HIGH_VOLUME_PUBLISHER",
  description: "High-volume media or global consumer publisher policy.",
  clusteringAlgorithmVersion: "v1.2.0-semantic-stem",
  minImpressionsForNewPageCandidate: 5000,
  minImpressionsForCannibalization: 200,
  minImpressionsForTrendEvaluation: 100,
  minImpressionsForEmergingDemand: 250,
  trendGrowingPercentageThreshold: 30,
  trendDecliningPercentageThreshold: -30,
  trendMinAbsoluteChange: 200,
  maxRankingPositionForStrongFitBonus: 3.0,
};

export function resolveDemandScalePolicy(policyName?: string, customPolicy?: Partial<DemandScalePolicy>): DemandScalePolicy {
  let basePolicy: DemandScalePolicy = DEFAULT_DEMAND_POLICY;
  if (policyName === "B2B_NICHE") {
    basePolicy = B2B_NICHE_DEMAND_POLICY;
  } else if (policyName === "HIGH_VOLUME_PUBLISHER") {
    basePolicy = HIGH_VOLUME_DEMAND_POLICY;
  }

  if (customPolicy) {
    return {
      ...basePolicy,
      ...customPolicy,
      policyName: customPolicy.policyName || "CUSTOM",
    };
  }

  return basePolicy;
}
