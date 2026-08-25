/**
 * Phase 11 Canonical Action Decision Bridge.
 * Enriches Phase 11 SEO Opportunity Actions with observed exposure and scenario ranges without mutating priority authority.
 */

import { SeoActionItem } from "../opportunity/types";
import { SeoImpactEstimate } from "./types";

export function enrichPhase11ActionsWithForecast(
  actions: SeoActionItem[],
  estimates: SeoImpactEstimate[]
): SeoActionItem[] {
  const estimateMap = new Map<string, SeoImpactEstimate>();
  for (const est of estimates) {
    estimateMap.set(est.actionId, est);
  }

  return actions.map((act) => {
    const est = estimateMap.get(act.actionId);
    if (!est) return act;

    const gscExposure = act.gscExposure
      ? {
          ...act.gscExposure,
          totalImpressions: est.observedExposure.historicalMonthlyImpressions,
          totalClicks: est.observedExposure.historicalMonthlyClicks,
          averageCtr: est.observedExposure.historicalAverageCtr,
        }
      : {
          totalImpressions: est.observedExposure.historicalMonthlyImpressions,
          totalClicks: est.observedExposure.historicalMonthlyClicks,
          averageCtr: est.observedExposure.historicalAverageCtr,
          averagePosition: est.observedExposure.historicalAveragePosition || 10,
          topQueries: [],
          dataQuality: "FRESH_COMPLETE" as const,
        };

    return {
      ...act,
      gscExposure,
      rootCauseGroup: est.opportunityPoolId || act.rootCauseGroup,
      // Phase 11 actionPriority, owner, and effort remain authoritative
    };
  });
}
