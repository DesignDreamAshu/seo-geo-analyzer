/**
 * Phase 28E: AI Visibility Trend & Run Comparison Engine.
 * Evaluates comparability guards, extracts like-for-like core sets, and computes percentage-point deltas.
 */

import { ObservationRunSummary, AIObservation } from "../observation/types";
import {
  AIVisibilityAnalyticsSnapshot,
  RunComparisonReport,
  VisibilityTrendSummary,
  ComparabilityStatus,
} from "./types";

export class AIVisibilityTrendEngine {
  public compareRuns(
    baselineRun: ObservationRunSummary,
    baselineObs: AIObservation[],
    currentRun: ObservationRunSummary,
    currentObs: AIObservation[]
  ): RunComparisonReport {
    // 1. Evaluate Comparability Status
    const { status, notes } = this.evaluateComparability(baselineRun, currentRun);

    // 2. Extract Matching Like-for-Like Prompts
    const baselinePromptIds = new Set(baselineObs.filter((o) => o.status === "SUCCESS").map((o) => o.promptId));
    const currentPromptIds = new Set(currentObs.filter((o) => o.status === "SUCCESS").map((o) => o.promptId));

    const intersectionPromptIds = new Set(
      Array.from(baselinePromptIds).filter((id) => currentPromptIds.has(id))
    );

    // Filter to like-for-like core observations
    const baseCore = baselineObs.filter((o) => o.status === "SUCCESS" && intersectionPromptIds.has(o.promptId));
    const currCore = currentObs.filter((o) => o.status === "SUCCESS" && intersectionPromptIds.has(o.promptId));

    // Compute metrics over core set
    const baseUnbranded = baseCore.filter((o) => o.brandedness === "UNBRANDED");
    const currUnbranded = currCore.filter((o) => o.brandedness === "UNBRANDED");

    const baseUnbrandedRate = baseUnbranded.length > 0
      ? (baseUnbranded.filter((o) => o.brandMentioned).length / baseUnbranded.length) * 100
      : 0;
    const currUnbrandedRate = currUnbranded.length > 0
      ? (currUnbranded.filter((o) => o.brandMentioned).length / currUnbranded.length) * 100
      : 0;

    const baseRecRate = baseCore.length > 0
      ? (baseCore.filter((o) => (o.brandMentions || []).some((m) => m.mentionType === "RECOMMENDED")).length / baseCore.length) * 100
      : 0;
    const currRecRate = currCore.length > 0
      ? (currCore.filter((o) => (o.brandMentions || []).some((m) => m.mentionType === "RECOMMENDED")).length / currCore.length) * 100
      : 0;

    const baseCitRate = baseCore.length > 0
      ? (baseCore.filter((o) => o.ownDomainCited).length / baseCore.length) * 100
      : 0;
    const currCitRate = currCore.length > 0
      ? (currCore.filter((o) => o.ownDomainCited).length / currCore.length) * 100
      : 0;

    const baseOverallRate = baseCore.length > 0
      ? (baseCore.filter((o) => o.brandMentioned).length / baseCore.length) * 100
      : 0;
    const currOverallRate = currCore.length > 0
      ? (currCore.filter((o) => o.brandMentioned).length / currCore.length) * 100
      : 0;

    return {
      baselineRunId: baselineRun.runId,
      currentRunId: currentRun.runId,
      comparabilityStatus: status,
      comparabilityNotes: notes,
      baselineStartedAt: baselineRun.startedAt,
      currentStartedAt: currentRun.startedAt,
      matchingPromptsCount: intersectionPromptIds.size,
      unbrandedDiscoveryDeltaPp: Number((currUnbrandedRate - baseUnbrandedRate).toFixed(1)),
      recommendationRateDeltaPp: Number((currRecRate - baseRecRate).toFixed(1)),
      ownDomainCitationRateDeltaPp: Number((currCitRate - baseCitRate).toFixed(1)),
      overallMentionRateDeltaPp: Number((currOverallRate - baseOverallRate).toFixed(1)),
    };
  }

  public evaluateComparability(
    runA: ObservationRunSummary,
    runB: ObservationRunSummary
  ): { status: ComparabilityStatus; notes: string[] } {
    const notes: string[] = [];

    if (runA.promptUniverseVersion !== runB.promptUniverseVersion) {
      notes.push(`Prompt universe version changed: ${runA.promptUniverseVersion} vs ${runB.promptUniverseVersion}`);
    }

    if (runA.config.country !== runB.config.country) {
      notes.push(`Country target changed: ${runA.config.country} vs ${runB.config.country}`);
    }

    if (runA.config.language !== runB.config.language) {
      notes.push(`Language changed: ${runA.config.language} vs ${runB.config.language}`);
    }

    const provA = new Set(runA.activeProviders);
    const provB = new Set(runB.activeProviders);
    const missingProviders = Array.from(provA).filter((p) => !provB.has(p));
    const addedProviders = Array.from(provB).filter((p) => !provA.has(p));

    if (missingProviders.length > 0 || addedProviders.length > 0) {
      notes.push(`Provider set differs: [${Array.from(provA).join(", ")}] vs [${Array.from(provB).join(", ")}]`);
    }

    let status: ComparabilityStatus = "COMPARABLE";
    if (notes.length >= 2) {
      status = "NOT_COMPARABLE";
    } else if (notes.length === 1) {
      status = "PARTIALLY_COMPARABLE";
    }

    return { status, notes };
  }

  public computeProjectTrends(
    projectId: string,
    runs: ObservationRunSummary[],
    snapshots: AIVisibilityAnalyticsSnapshot[]
  ): VisibilityTrendSummary {
    const sortedRuns = [...runs].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    const snapMap = new Map<string, AIVisibilityAnalyticsSnapshot>();
    for (const snap of snapshots) snapMap.set(snap.runId, snap);

    const historicalRuns = sortedRuns.map((r, idx) => {
      const snap = snapMap.get(r.runId);
      const unbranded = snap ? snap.metrics.mentionRates.unbrandedDiscovery.rate * 100 : r.unbrandedBrandMentionRate * 100;
      const rec = snap ? snap.metrics.recommendations.recommendationRate.rate * 100 : 0;
      const citation = snap ? snap.metrics.citations.ownDomainCitationRate.rate * 100 : r.ownDomainCitationRate * 100;
      const overall = snap ? snap.metrics.mentionRates.overall.rate * 100 : r.overallBrandMentionRate * 100;

      let comparability: ComparabilityStatus = "COMPARABLE";
      if (idx > 0) {
        comparability = this.evaluateComparability(sortedRuns[idx - 1], r).status;
      }

      return {
        runId: r.runId,
        startedAt: r.startedAt,
        unbrandedDiscoveryRate: Math.round(unbranded),
        recommendationRate: Math.round(rec),
        ownDomainCitationRate: Math.round(citation),
        overallMentionRate: Math.round(overall),
        comparabilityStatus: comparability,
      };
    });

    return {
      projectId,
      runCount: runs.length,
      historicalRuns,
    };
  }
}

export const globalAIVisibilityTrendEngine = new AIVisibilityTrendEngine();
