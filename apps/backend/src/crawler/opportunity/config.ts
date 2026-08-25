/**
 * Centralized, Configurable Opportunity & Action Planning Policies.
 * Replaces hardcoded magic thresholds with site-scale-aware configuration.
 */

export type SiteTrafficScale = "DEFAULT" | "B2B_NICHE" | "HIGH_VOLUME_PUBLISHER";

export interface OpportunityConfig {
  siteScale: SiteTrafficScale;
  thresholds: {
    highSearchDemandImpressions: number;
    moderateSearchDemandImpressions: number;
    lowVolumeSampleThreshold: number;
    quickWinMinImpressionsForSinglePage: number;
  };
  rankingOpportunityBands: {
    strikingDistanceMinPosition: number;
    strikingDistanceMaxPosition: number;
  };
}

export function getOpportunityConfig(scale: SiteTrafficScale = "DEFAULT"): OpportunityConfig {
  if (scale === "B2B_NICHE") {
    return {
      siteScale: "B2B_NICHE",
      thresholds: {
        highSearchDemandImpressions: 500,
        moderateSearchDemandImpressions: 100,
        lowVolumeSampleThreshold: 20,
        quickWinMinImpressionsForSinglePage: 150,
      },
      rankingOpportunityBands: {
        strikingDistanceMinPosition: 4,
        strikingDistanceMaxPosition: 15,
      },
    };
  }

  if (scale === "HIGH_VOLUME_PUBLISHER") {
    return {
      siteScale: "HIGH_VOLUME_PUBLISHER",
      thresholds: {
        highSearchDemandImpressions: 25000,
        moderateSearchDemandImpressions: 5000,
        lowVolumeSampleThreshold: 500,
        quickWinMinImpressionsForSinglePage: 10000,
      },
      rankingOpportunityBands: {
        strikingDistanceMinPosition: 4,
        strikingDistanceMaxPosition: 12,
      },
    };
  }

  return {
    siteScale: "DEFAULT",
    thresholds: {
      highSearchDemandImpressions: 3000,
      moderateSearchDemandImpressions: 400,
      lowVolumeSampleThreshold: 50,
      quickWinMinImpressionsForSinglePage: 800,
    },
    rankingOpportunityBands: {
      strikingDistanceMinPosition: 4,
      strikingDistanceMaxPosition: 15,
    },
  };
}

export const DEFAULT_OPPORTUNITY_CONFIG = getOpportunityConfig("DEFAULT");
