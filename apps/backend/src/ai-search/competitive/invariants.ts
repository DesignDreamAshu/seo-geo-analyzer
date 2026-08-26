/**
 * Phase 28J: Competitive Invariant & Denominator Validator.
 * Enforces rigorous mathematical and set-membership invariants across competitive benchmarks.
 */

import { AICompetitiveBenchmarkSnapshot } from "./types";

export function validateCompetitiveInvariants(snapshot: AICompetitiveBenchmarkSnapshot): void {
  const { summary, promptComparisons, intentComparisons, opportunities, clientAdvantages } = snapshot;

  const totalCompared = promptComparisons.length;
  if (totalCompared !== summary.totalPromptsCompared) {
    throw new Error(
      `[COMPETITIVE INVARIANT ERROR] Prompt comparisons length (${totalCompared}) does not match summary total (${summary.totalPromptsCompared})!`
    );
  }

  // 1. Validate State Distribution Sum == Total Prompts
  const stateCounts = {
    CLIENT_ADVANTAGE: 0,
    COMPETITOR_ADVANTAGE: 0,
    ROUGH_PARITY: 0,
    BOTH_WEAK: 0,
    CLIENT_ONLY: 0,
    COMPETITOR_ONLY: 0,
    INSUFFICIENT_EVIDENCE: 0,
  };

  for (const p of promptComparisons) {
    if (p.competitiveState in stateCounts) {
      stateCounts[p.competitiveState]++;
    }
  }

  const clientAdv = stateCounts.CLIENT_ADVANTAGE + stateCounts.CLIENT_ONLY;
  const compAdv = stateCounts.COMPETITOR_ADVANTAGE + stateCounts.COMPETITOR_ONLY;
  const parity = stateCounts.ROUGH_PARITY;
  const bothWeak = stateCounts.BOTH_WEAK;
  const insufficient = stateCounts.INSUFFICIENT_EVIDENCE;

  const sumStates = clientAdv + compAdv + parity + bothWeak + insufficient;
  if (sumStates !== totalCompared) {
    throw new Error(
      `[COMPETITIVE INVARIANT ERROR] Sum of competitive states (${sumStates}) does not equal total compared prompts (${totalCompared})!`
    );
  }

  // 2. Validate Intent Summaries
  for (const intent of intentComparisons) {
    const sumIntentStates =
      intent.clientAdvantages +
      intent.competitorAdvantages +
      intent.roughParity +
      intent.bothWeak +
      intent.insufficientEvidence;

    if (sumIntentStates !== intent.totalComparablePrompts) {
      throw new Error(
        `[COMPETITIVE INVARIANT ERROR] Intent "${intent.intentFamily}" state sum (${sumIntentStates}) does not equal total prompts (${intent.totalComparablePrompts})!`
      );
    }
  }

  // 3. Validate Set Membership
  const comparedPromptIds = new Set(promptComparisons.map((p) => p.promptId));

  for (const opp of opportunities) {
    for (const ap of opp.affectedPrompts) {
      if (!comparedPromptIds.has(ap.id)) {
        throw new Error(
          `[COMPETITIVE INVARIANT ERROR] Opportunity "${opp.opportunityId}" contains prompt "${ap.id}" outside compared universe!`
        );
      }
    }
  }

  for (const adv of clientAdvantages) {
    for (const ap of adv.affectedPrompts) {
      if (!comparedPromptIds.has(ap.id)) {
        throw new Error(
          `[COMPETITIVE INVARIANT ERROR] Client advantage "${adv.advantageId}" contains prompt "${ap.id}" outside compared universe!`
        );
      }
    }
  }
}
