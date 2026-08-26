/**
 * Phase 28I: AI Measurement Central Accounting & Invariant Validator.
 * Enforces rigorous mathematical and set-membership invariants across all measurement metrics.
 * Strictly prevents impossible states, negative values, and denominator overflows.
 */

import { AIMeasurementSnapshot } from "./types";

export function validateAIMeasurementInvariants(snapshot: AIMeasurementSnapshot): void {
  const { metrics, promptCoverageSummary, pageTargetingSummary, promptDetails, findingLifecycle } = snapshot;

  // 1. Validate General Metric Record Bounds (0 <= numerator <= denominator)
  for (const [key, metric] of Object.entries(metrics)) {
    if (metric.numerator < 0) {
      throw new Error(`[AI MEASUREMENT INVARIANT ERROR] Metric "${key}" has negative numerator (${metric.numerator}).`);
    }
    if (metric.denominator < 0) {
      throw new Error(`[AI MEASUREMENT INVARIANT ERROR] Metric "${key}" has negative denominator (${metric.denominator}).`);
    }
    if (metric.denominator > 0 && metric.numerator > metric.denominator) {
      throw new Error(
        `[AI MEASUREMENT INVARIANT ERROR] Metric "${key}" numerator (${metric.numerator}) exceeds denominator (${metric.denominator})!`
      );
    }
  }

  // 2. Validate Prompt Coverage Accounting
  const {
    totalCanonicalPrompts,
    measurablePrompts,
    strongCount,
    adequateCount,
    partialCount,
    weakCount,
    unservedCount,
    insufficientEvidenceCount,
    adequatelyServedCount,
  } = promptCoverageSummary;

  if (measurablePrompts > totalCanonicalPrompts) {
    throw new Error(
      `[AI MEASUREMENT INVARIANT ERROR] Measurable prompts (${measurablePrompts}) exceeds total canonical prompts (${totalCanonicalPrompts})!`
    );
  }

  if (adequatelyServedCount !== strongCount + adequateCount) {
    throw new Error(
      `[AI MEASUREMENT INVARIANT ERROR] Adequately served count (${adequatelyServedCount}) does not equal strong (${strongCount}) + adequate (${adequateCount})!`
    );
  }

  const sumOfPromptStates =
    strongCount + adequateCount + partialCount + weakCount + unservedCount + insufficientEvidenceCount;

  if (sumOfPromptStates !== totalCanonicalPrompts) {
    throw new Error(
      `[AI MEASUREMENT INVARIANT ERROR] Sum of prompt states (${sumOfPromptStates}) does not match total canonical prompts (${totalCanonicalPrompts})!`
    );
  }

  // 3. Validate Page Targeting Accounting
  const {
    totalEvaluated,
    clearPrimaryTargets,
    multipleCompetingTargets,
    weakPrimaryTargets,
    wrongPageTypeTargets,
    noTargetPrompts,
    insufficientEvidence: targetInsufficient,
  } = pageTargetingSummary;

  if (totalEvaluated > totalCanonicalPrompts) {
    throw new Error(
      `[AI MEASUREMENT INVARIANT ERROR] Target evaluated prompts (${totalEvaluated}) exceeds total canonical prompts (${totalCanonicalPrompts})!`
    );
  }

  const sumOfTargetStates =
    clearPrimaryTargets +
    multipleCompetingTargets +
    weakPrimaryTargets +
    wrongPageTypeTargets +
    noTargetPrompts +
    targetInsufficient;

  if (sumOfTargetStates !== totalEvaluated) {
    throw new Error(
      `[AI MEASUREMENT INVARIANT ERROR] Sum of target states (${sumOfTargetStates}) does not match total evaluated (${totalEvaluated})!`
    );
  }

  // 4. Validate Set Membership Invariants (Stable ID Containment)
  const canonicalIds = new Set(promptDetails.map((p) => p.promptId));
  if (canonicalIds.size !== promptDetails.length) {
    throw new Error(`[AI MEASUREMENT INVARIANT ERROR] Duplicate promptId detected in promptDetails!`);
  }

  const adequatelyServedIds = new Set(
    promptDetails
      .filter((p) => p.coverageLevel === "STRONG" || p.coverageLevel === "ADEQUATE")
      .map((p) => p.promptId)
  );

  const measurableIds = new Set(
    promptDetails.filter((p) => p.coverageLevel !== "INSUFFICIENT_EVIDENCE").map((p) => p.promptId)
  );

  for (const id of adequatelyServedIds) {
    if (!measurableIds.has(id)) {
      throw new Error(
        `[AI MEASUREMENT INVARIANT ERROR] Prompt ID "${id}" is in AdequatelyServedSet but not in MeasurableSet!`
      );
    }
  }

  for (const id of measurableIds) {
    if (!canonicalIds.has(id)) {
      throw new Error(
        `[AI MEASUREMENT INVARIANT ERROR] Prompt ID "${id}" is in MeasurableSet but not in CanonicalSet!`
      );
    }
  }

  // 5. Validate Finding Lifecycle Accounting
  const { totalBaselineFindings, verifiedFixed, partiallyFixed, openFindings } = findingLifecycle;
  if (verifiedFixed > totalBaselineFindings && totalBaselineFindings > 0) {
    throw new Error(
      `[AI MEASUREMENT INVARIANT ERROR] Verified fixed findings (${verifiedFixed}) exceeds total baseline findings (${totalBaselineFindings})!`
    );
  }
}
