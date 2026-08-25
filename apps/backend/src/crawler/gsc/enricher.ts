/**
 * GSC Fix Intelligence Enricher
 * Adds search visibility, organic traffic volume, and search priority metadata to Fix Intelligence blueprints.
 */

import { SeoFixIntelligence } from "../fix-intelligence/types";
import { PageGscMetrics, SearchPriorityLevel } from "./types";
import { GSC_POLICY_THRESHOLDS } from "./thresholds";

export interface GscEnrichedFixIntelligence extends SeoFixIntelligence {
  gscContext?: {
    searchPriority: SearchPriorityLevel;
    priorityReason: string;
    impressions: number;
    clicks: number;
    ctr: number;
    averagePosition: number;
    topQueries: string[];
    isDeclining: boolean;
    hasCtrOpportunity: boolean;
  };
}

export function enrichFixIntelligenceWithGsc(
  fix: SeoFixIntelligence,
  pagesGscMetrics: PageGscMetrics[]
): GscEnrichedFixIntelligence {
  if (!fix.affectedUrl) {
    return fix;
  }

  const gsc = pagesGscMetrics.find(
    (p) => p.matchedCrawlUrl === fix.affectedUrl || p.normalizedGscUrl === fix.affectedUrl || p.gscUrl === fix.affectedUrl
  );

  if (!gsc || (gsc.currentPeriod.impressions === 0 && gsc.currentPeriod.clicks === 0)) {
    return fix;
  }

  const imps = gsc.currentPeriod.impressions;
  const clks = gsc.currentPeriod.clicks;
  const pos = gsc.currentPeriod.averagePosition;

  let searchPriority: SearchPriorityLevel = "INFORMATIONAL";
  let priorityReason = "";

  if (
    imps >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.urgentBusinessImpressionThreshold ||
    clks >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.urgentBusinessClickThreshold
  ) {
    searchPriority = "URGENT_BUSINESS_PRIORITY";
    priorityReason = `Affects high-visibility landing page with ${(imps / 1000).toFixed(1)}k impressions and ${clks} organic clicks.`;
  } else if (
    imps >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.highImpressionThreshold ||
    clks >= GSC_POLICY_THRESHOLDS.SEARCH_PRIORITY.highClickThreshold
  ) {
    searchPriority = "HIGH_SEARCH_PRIORITY";
    priorityReason = `Affects active landing page receiving ${imps.toLocaleString()} impressions and ${clks} clicks.`;
  } else {
    searchPriority = "MEDIUM_SEARCH_PRIORITY";
    priorityReason = `Landing page receives search visibility (${imps} impressions, avg pos ${pos}).`;
  }

  const topQueries = gsc.topQueries.map((q) => q.query).slice(0, 5);

  return {
    ...fix,
    gscContext: {
      searchPriority,
      priorityReason,
      impressions: imps,
      clicks: clks,
      ctr: gsc.currentPeriod.ctr,
      averagePosition: pos,
      topQueries,
      isDeclining: gsc.isDeclining,
      hasCtrOpportunity: gsc.hasCtrOpportunity,
    },
  };
}
