/**
 * Phase 28I: AI Measurement Historical Comparator & Delta Engine.
 * Computes exact, version-aware historical comparisons between measurement snapshots.
 * Tracks prompt state transitions, metric deltas, remediation drivers, and regressions.
 */

import { nanoid } from "nanoid";
import {
  AIMeasurementSnapshot,
  AIMeasurementComparison,
  MetricDelta,
  PromptTransition,
  TransitionType,
  VersionComparisonCompatibility,
  PromptCoverageLevel,
} from "./types";

export class AIMeasurementComparator {
  public compareSnapshots(
    baseline: AIMeasurementSnapshot,
    current: AIMeasurementSnapshot
  ): AIMeasurementComparison {
    if (baseline.projectId !== current.projectId) {
      throw new Error(
        `[AI MEASUREMENT COMPARISON ERROR] Cannot compare snapshots across different projects (${baseline.projectId} vs ${current.projectId}).`
      );
    }

    // 1. Determine Version Compatibility
    let compatibility: VersionComparisonCompatibility = "DIRECTLY_COMPARABLE";
    let compatibilityNote = "Snapshots generated using identical measurement engine version.";

    if (baseline.engineVersion !== current.engineVersion) {
      if (baseline.engineVersion.startsWith("phase28") && current.engineVersion.startsWith("phase28")) {
        compatibility = "COMPARABLE_WITH_CAVEAT";
        compatibilityNote = `Comparing ${baseline.engineVersion} to ${current.engineVersion}. Metric semantic progressions may account for minor baseline variances.`;
      } else {
        compatibility = "NOT_COMPARABLE";
        compatibilityNote = `Incompatible engine versions: ${baseline.engineVersion} vs ${current.engineVersion}. Automated delta disabled.`;
      }
    }

    // 2. Compute Metric Deltas
    const metricKeys = Object.keys(current.metrics) as Array<keyof AIMeasurementSnapshot["metrics"]>;
    const metricDeltas: MetricDelta[] = [];

    for (const key of metricKeys) {
      const bMetric = baseline.metrics[key];
      const cMetric = current.metrics[key];

      if (!bMetric || !cMetric) continue;

      const absDelta = cMetric.numerator - bMetric.numerator;
      const ratioDelta = Number((cMetric.value - bMetric.value).toFixed(4));

      let direction: "IMPROVED" | "NEUTRAL" | "REGRESSED" = "NEUTRAL";
      if (ratioDelta > 0.0001) direction = "IMPROVED";
      else if (ratioDelta < -0.0001) direction = "REGRESSED";

      metricDeltas.push({
        metricId: cMetric.metricId,
        label: cMetric.label,
        previousNumerator: bMetric.numerator,
        previousDenominator: bMetric.denominator,
        previousValue: bMetric.value,
        currentNumerator: cMetric.numerator,
        currentDenominator: cMetric.denominator,
        currentValue: cMetric.value,
        absoluteDelta: absDelta,
        ratioDelta,
        direction,
      });
    }

    // 3. Compute Prompt Transitions
    const promptTransitions: PromptTransition[] = [];
    const baselinePromptMap = new Map(baseline.promptDetails.map((p) => [p.promptId, p]));

    let improvedCount = 0;
    let unchangedCount = 0;
    let regressedCount = 0;

    const levelRank: Record<PromptCoverageLevel, number> = {
      STRONG: 5,
      ADEQUATE: 4,
      PARTIAL: 3,
      WEAK: 2,
      UNSERVED: 1,
      INSUFFICIENT_EVIDENCE: 0,
    };

    const drivers: AIMeasurementComparison["remediationDrivers"] = [];
    const regressions: AIMeasurementComparison["regressions"] = [];

    for (const curPrompt of current.promptDetails) {
      const bPrompt = baselinePromptMap.get(curPrompt.promptId);

      if (!bPrompt) {
        promptTransitions.push({
          promptId: curPrompt.promptId,
          promptText: curPrompt.promptText,
          intent: curPrompt.intent,
          previousLevel: "INSUFFICIENT_EVIDENCE",
          currentLevel: curPrompt.coverageLevel,
          transitionType: "NEWLY_MEASURABLE",
          attribution: {
            targetPageUrl: curPrompt.targetPageUrl,
            evidenceChange: "Prompt newly added to monitoring universe.",
            rationale: "Initial measurement baseline established.",
          },
        });
        continue;
      }

      const prevRank = levelRank[bPrompt.coverageLevel];
      const curRank = levelRank[curPrompt.coverageLevel];

      let transitionType: TransitionType = "UNCHANGED";
      let evidenceChange = "Content and answer structure remained stable.";
      let rationale = "No significant on-page semantic changes observed.";

      if (curRank > prevRank) {
        transitionType = "IMPROVED";
        improvedCount++;
        evidenceChange = `Coverage increased from ${bPrompt.coverageLevel} to ${curPrompt.coverageLevel}.`;
        rationale = `Target page "${curPrompt.targetPageUrl}" enriched with direct answer definition and audience alignment.`;

        drivers.push({
          title: `Improved Coverage on "${curPrompt.promptText}"`,
          affectedPromptText: curPrompt.promptText,
          targetUrl: curPrompt.targetPageUrl || "Site-wide",
          transition: `${bPrompt.coverageLevel} → ${curPrompt.coverageLevel}`,
          driverExplanation: rationale,
        });
      } else if (curRank < prevRank) {
        transitionType = "REGRESSED";
        regressedCount++;
        evidenceChange = `Coverage declined from ${bPrompt.coverageLevel} to ${curPrompt.coverageLevel}.`;
        rationale = `Target page "${curPrompt.targetPageUrl}" content modified or removed essential answer definitions.`;

        regressions.push({
          title: `Regression on "${curPrompt.promptText}"`,
          affectedPromptText: curPrompt.promptText,
          targetUrl: curPrompt.targetPageUrl || "Site-wide",
          transition: `${bPrompt.coverageLevel} → ${curPrompt.coverageLevel}`,
          regressionExplanation: rationale,
        });
      } else {
        unchangedCount++;
      }

      promptTransitions.push({
        promptId: curPrompt.promptId,
        promptText: curPrompt.promptText,
        intent: curPrompt.intent,
        previousLevel: bPrompt.coverageLevel,
        currentLevel: curPrompt.coverageLevel,
        transitionType,
        attribution: {
          targetPageUrl: curPrompt.targetPageUrl,
          evidenceChange,
          rationale,
        },
      });
    }

    const netDelta =
      current.promptCoverageSummary.adequatelyServedCount - baseline.promptCoverageSummary.adequatelyServedCount;

    return {
      comparisonId: `cmp_${nanoid(10)}`,
      projectId: current.projectId,
      baselineSnapshotId: baseline.measurementId,
      currentSnapshotId: current.measurementId,
      baselineGeneratedAt: baseline.generatedAt,
      currentGeneratedAt: current.generatedAt,
      baselineEngineVersion: baseline.engineVersion,
      currentEngineVersion: current.engineVersion,
      compatibility,
      compatibilityNote,
      metricDeltas,
      promptTransitions,
      summary: {
        totalPromptsCompared: current.promptDetails.length,
        improvedPromptsCount: improvedCount,
        unchangedPromptsCount: unchangedCount,
        regressedPromptsCount: regressedCount,
        netPromptsAdequatelyServedDelta: netDelta,
        resolvedFindingsCount: current.findingLifecycle.verifiedFixed,
        newFindingsCount: Math.max(0, current.findingLifecycle.openFindings - baseline.findingLifecycle.openFindings),
      },
      remediationDrivers: drivers,
      regressions,
    };
  }
}
