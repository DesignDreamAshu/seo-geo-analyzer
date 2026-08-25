/**
 * Backlink Historical Change & Velocity Tracker.
 * Safely measures changes in observed backlinks and referring domains across comparable snapshots.
 * Invariant: Provider/Index changes and incomplete datasets suppress growth and loss conclusions.
 */

import { BacklinkSnapshot } from "./types";
import { validateBacklinkComparability } from "./snapshots";
import { DEFAULT_BACKLINK_POLICY, BacklinkIntelligencePolicy } from "./config";

export interface BacklinkHistoryAnalysisResult {
  isComparable: boolean;
  incomparabilityReason?: string;
  newlyObservedBacklinksCount: number;
  noLongerObservedBacklinksCount: number;
  newlyObservedReferringDomainsCount: number;
  noLongerObservedReferringDomainsCount: number;
  burstObservation?: {
    finding: "BACKLINK_BURST_OBSERVED";
    rationale: string;
  };
}

export function trackBacklinkHistory(
  currentSnapshot: BacklinkSnapshot,
  previousSnapshot?: BacklinkSnapshot,
  policy: BacklinkIntelligencePolicy = DEFAULT_BACKLINK_POLICY
): BacklinkHistoryAnalysisResult {
  if (!previousSnapshot) {
    return {
      isComparable: true,
      newlyObservedBacklinksCount: currentSnapshot.observedBacklinks.length,
      noLongerObservedBacklinksCount: 0,
      newlyObservedReferringDomainsCount: currentSnapshot.referringDomains.length,
      noLongerObservedReferringDomainsCount: 0,
    };
  }

  const comparability = validateBacklinkComparability(currentSnapshot, previousSnapshot);
  if (comparability.isComparable === false) {
    return {
      isComparable: false,
      incomparabilityReason: comparability.details,
      newlyObservedBacklinksCount: 0,
      noLongerObservedBacklinksCount: 0,
      newlyObservedReferringDomainsCount: 0,
      noLongerObservedReferringDomainsCount: 0,
    };
  }

  // Calculate set differences for Backlinks
  const currentBacklinkKeys = new Set(
    currentSnapshot.observedBacklinks.map((b) => `${b.sourceNormalizedUrl}--->${b.targetNormalizedUrl}`)
  );
  const prevBacklinkKeys = new Set(
    previousSnapshot.observedBacklinks.map((b) => `${b.sourceNormalizedUrl}--->${b.targetNormalizedUrl}`)
  );

  let newlyObservedBacklinks = 0;
  for (const key of currentBacklinkKeys) {
    if (!prevBacklinkKeys.has(key)) newlyObservedBacklinks++;
  }

  let noLongerObservedBacklinks = 0;
  for (const key of prevBacklinkKeys) {
    if (!currentBacklinkKeys.has(key)) noLongerObservedBacklinks++;
  }

  // Calculate set differences for Referring Domains
  const currentDomainKeys = new Set(currentSnapshot.referringDomains.map((d) => d.rootDomain));
  const prevDomainKeys = new Set(previousSnapshot.referringDomains.map((d) => d.rootDomain));

  let newlyObservedDomains = 0;
  for (const dom of currentDomainKeys) {
    if (!prevDomainKeys.has(dom)) newlyObservedDomains++;
  }

  let noLongerObservedDomains = 0;
  for (const dom of prevDomainKeys) {
    if (!currentDomainKeys.has(dom)) noLongerObservedDomains++;
  }

  // Check for Sudden Link Burst
  let burstObservation: BacklinkHistoryAnalysisResult["burstObservation"];
  const prevTotal = previousSnapshot.observedBacklinks.length;
  const currTotal = currentSnapshot.observedBacklinks.length;

  if (
    prevTotal >= 20 &&
    currTotal >= prevTotal * policy.burstThresholdRatio &&
    newlyObservedBacklinks >= policy.minBurstObservedCount
  ) {
    burstObservation = {
      finding: "BACKLINK_BURST_OBSERVED",
      rationale: `Observed +${newlyObservedBacklinks} new backlink records (${Math.round(
        (currTotal / prevTotal) * 100
      )}% increase over baseline ${prevTotal} records). Review acquisition velocity and anchor patterns. (Descriptive observation; not automatically spam).`,
    };
  }

  return {
    isComparable: true,
    newlyObservedBacklinksCount: newlyObservedBacklinks,
    noLongerObservedBacklinksCount: noLongerObservedBacklinks,
    newlyObservedReferringDomainsCount: newlyObservedDomains,
    noLongerObservedReferringDomainsCount: noLongerObservedDomains,
    burstObservation,
  };
}
