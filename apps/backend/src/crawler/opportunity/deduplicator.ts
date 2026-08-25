/**
 * Action Deduplication & Stable Identity Engine.
 * Collapses multi-source signals addressing the same root cause into a single canonical action
 * while guaranteeing invariant stability against volatile metrics and array ordering.
 */

import { SeoActionItem } from "./types";

export function buildStableActionId(
  type: string,
  rootCauseKey: string,
  primaryUrl: string
): string {
  const normUrl = primaryUrl.toLowerCase().replace(/\/$/, "");
  const cleanKey = rootCauseKey.replace(/[^a-zA-Z0-9_]/g, "_");
  return `ACT_${type}_${cleanKey}_${simpleHash(normUrl)}`;
}

export function deduplicateActions(actions: SeoActionItem[]): SeoActionItem[] {
  const canonicalMap = new Map<string, SeoActionItem>();

  for (const action of actions) {
    const key = action.actionId;

    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, { ...action });
    } else {
      const existing = canonicalMap.get(key)!;

      // Merge underlying rule codes
      const mergedRules = Array.from(new Set([...(existing.underlyingRuleCodes || []), ...(action.underlyingRuleCodes || [])]));
      // Merge monitoring signals
      const mergedMonSignals = Array.from(new Set([...(existing.monitoringSignals || []), ...(action.monitoringSignals || [])]));
      // Merge source signals
      const mergedSourceSignals = Array.from(new Set([...(existing.sourceSignals || []), ...(action.sourceSignals || [])]));
      // Merge affected URLs
      const mergedUrls = Array.from(new Set([...(existing.affectedUrls || []), ...(action.affectedUrls || [])]));

      // Merge whyThisPriority reasons
      const mergedWhy = Array.from(new Set([...(existing.whyThisPriority || []), ...(action.whyThisPriority || [])]));

      // Preserve highest priority
      const mergedPriority = getHigherPriority(existing.actionPriority, action.actionPriority);

      // Merge GSC exposure if available
      let mergedGsc = existing.gscExposure;
      if (action.gscExposure) {
        if (!mergedGsc) {
          mergedGsc = action.gscExposure;
        } else {
          mergedGsc = {
            totalImpressions: Math.max(mergedGsc.totalImpressions, action.gscExposure.totalImpressions),
            totalClicks: Math.max(mergedGsc.totalClicks, action.gscExposure.totalClicks),
            averageCtr: (mergedGsc.averageCtr + action.gscExposure.averageCtr) / 2,
            averagePosition: Math.min(mergedGsc.averagePosition, action.gscExposure.averagePosition),
            topQueries: [...mergedGsc.topQueries, ...action.gscExposure.topQueries].slice(0, 5),
            dataQuality: mergedGsc.dataQuality === "FRESH_COMPLETE" ? "FRESH_COMPLETE" : action.gscExposure.dataQuality,
          };
        }
      }

      canonicalMap.set(key, {
        ...existing,
        underlyingRuleCodes: mergedRules,
        monitoringSignals: mergedMonSignals,
        sourceSignals: mergedSourceSignals,
        affectedUrls: mergedUrls,
        affectedUrlsCount: mergedUrls.length,
        representativeUrls: mergedUrls.slice(0, 3),
        actionPriority: mergedPriority,
        whyThisPriority: mergedWhy,
        gscExposure: mergedGsc,
      });
    }
  }

  return Array.from(canonicalMap.values());
}

function getHigherPriority(p1: SeoActionItem["actionPriority"], p2: SeoActionItem["actionPriority"]): SeoActionItem["actionPriority"] {
  const ranks: Record<SeoActionItem["actionPriority"], number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    REVIEW: 1,
  };
  return ranks[p1] >= ranks[p2] ? p1 : p2;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}
