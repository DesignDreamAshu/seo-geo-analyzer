/**
 * SERP Position Observation & Movement Engine.
 * Safely tracks relative position shifts across strictly comparable snapshots.
 * Invariant: Leaving tracked top-N results is classified as 'NO_LONGER_OBSERVED_IN_TRACKED_RANGE',
 * NEVER falsely declared as 'DEINDEXED' or 'RANK_LOST'.
 */

import { SerpSnapshot, SerpPositionHistoryItem, PositionChangeState } from "./types";
import { validateSerpComparability } from "./serp-snapshot";

export function trackSerpPositionHistory(
  currentSnapshot: SerpSnapshot,
  previousSnapshot?: SerpSnapshot
): SerpPositionHistoryItem[] {
  if (!previousSnapshot) {
    return currentSnapshot.ownSiteResults.map((r) => ({
      query: currentSnapshot.query,
      clusterId: currentSnapshot.clusterId,
      url: r.url,
      currentPosition: r.position,
      state: "ENTERED_OBSERVED_RANGE",
      rationale: `Initial observation: ranking at position #${r.position} in tracked SERP.`,
    }));
  }

  const comparability = validateSerpComparability(currentSnapshot, previousSnapshot);
  if (comparability.isComparable === false) {
    const errorDetails = comparability.details;
    return currentSnapshot.ownSiteResults.map((r) => ({
      query: currentSnapshot.query,
      clusterId: currentSnapshot.clusterId,
      url: r.url,
      currentPosition: r.position,
      state: "INSUFFICIENT_DATA",
      rationale: `Snapshots not directly comparable: ${errorDetails}`,
    }));
  }

  const history: SerpPositionHistoryItem[] = [];
  const currentOwnMap = new Map<string, number>();
  for (const r of currentSnapshot.ownSiteResults) {
    currentOwnMap.set(r.normalizedUrl, r.position);
  }

  const prevOwnMap = new Map<string, number>();
  for (const r of previousSnapshot.ownSiteResults) {
    prevOwnMap.set(r.normalizedUrl, r.position);
  }

  // 1. Process URLs present in current snapshot
  for (const [url, currPos] of currentOwnMap.entries()) {
    const prevPos = prevOwnMap.get(url);

    if (prevPos === undefined) {
      history.push({
        query: currentSnapshot.query,
        clusterId: currentSnapshot.clusterId,
        url,
        currentPosition: currPos,
        state: "ENTERED_OBSERVED_RANGE",
        rationale: `Newly observed in tracked top results at position #${currPos}.`,
      });
    } else {
      const diff = prevPos - currPos; // positive means rank improved (e.g. 5 -> 2 = +3)
      let state: PositionChangeState = "STABLE";
      let rationale = `Position stable (previous #${prevPos} vs current #${currPos}).`;

      if (diff >= 2) {
        state = "IMPROVED";
        rationale = `Observed position improved by +${diff} spots (#${prevPos} -> #${currPos}).`;
      } else if (diff <= -2) {
        state = "DECLINED";
        rationale = `Observed position declined by ${diff} spots (#${prevPos} -> #${currPos}).`;
      }

      history.push({
        query: currentSnapshot.query,
        clusterId: currentSnapshot.clusterId,
        url,
        previousPosition: prevPos,
        currentPosition: currPos,
        state,
        rationale,
      });
    }
  }

  // 2. Process URLs present in previous snapshot but missing now
  for (const [url, prevPos] of prevOwnMap.entries()) {
    if (!currentOwnMap.has(url)) {
      history.push({
        query: currentSnapshot.query,
        clusterId: currentSnapshot.clusterId,
        url,
        previousPosition: prevPos,
        state: "NO_LONGER_OBSERVED_IN_TRACKED_RANGE",
        rationale: `URL was previously observed at #${prevPos}, but is no longer observed within the tracked top-${currentSnapshot.organicResults.length} SERP results. (Descriptive observation; does NOT imply deindexing).`,
      });
    }
  }

  return history;
}
