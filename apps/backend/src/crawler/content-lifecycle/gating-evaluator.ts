/**
 * Non-Content Alternative Explanation & SERP Confounding Gating Evaluator.
 * Enforces:
 * TRAFFIC_DECLINE ≠ CONTENT_DECAY
 * Ensures technical, indexation, migration, seasonal, demand, and SERP layout confounding are gated first.
 */

import { ContentLifecycleState, ContentLifecycleAction, LifecycleSignal } from "./types";
import { ContentLifecyclePolicy, DEFAULT_CONTENT_LIFECYCLE_POLICY } from "./config";

export interface GatingInput {
  url: string;
  isTechnicalDefectPresent?: boolean;
  technicalDefectReason?: string;
  isGoogleIndexBlocked?: boolean;
  googleIndexState?: string;
  isMigrationTransitionActive?: boolean;
  isSeasonallyCyclical?: boolean;
  isClusterDemandDeclining?: boolean;
  clusterDemandDropPercent?: number;
  isSerpCompetitorOvertaking?: boolean;
  serpCompetitorObservation?: string;
  isSerpLayoutChanged?: boolean;
  serpLayoutChangeDescription?: string;
  isCtrDropDominant?: boolean;
  ctrDropImpressionsVolume?: number;
  positionVariance?: number;
  isCannibalizationActive?: boolean;
  policy?: ContentLifecyclePolicy;
}

export interface GatingEvaluationResult {
  isGatedByAlternativeExplanation: boolean;
  gatedLifecycleState?: ContentLifecycleState;
  gatedRecommendedAction?: ContentLifecycleAction;
  gatingSignals: LifecycleSignal[];
  explanation: string;
}

export function evaluateNonContentDeclineGating(input: GatingInput): GatingEvaluationResult {
  const policy = input.policy || DEFAULT_CONTENT_LIFECYCLE_POLICY;
  const signals: LifecycleSignal[] = [];

  // 1. Technical Defects Gate (Phase 1-6 & 11)
  if (input.isTechnicalDefectPresent) {
    signals.push({
      signalType: "TECHNICAL_BLOCKER",
      description: `Technical crawler/indexability defect detected: ${input.technicalDefectReason || "Critical HTTP or directive blocker"}.`,
      severity: "CRITICAL",
    });
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "TECHNICAL_DECLINE",
      gatedRecommendedAction: "RESTORE_TECHNICAL_VISIBILITY",
      gatingSignals: signals,
      explanation: `Traffic decline is explained by a deterministic technical defect (${input.technicalDefectReason}). Content refresh is NOT the root cause or solution.`,
    };
  }

  // 2. Google Indexation Gate (Phase 19)
  if (input.isGoogleIndexBlocked || (input.googleIndexState && input.googleIndexState !== "INDEXED")) {
    signals.push({
      signalType: "INDEX_LOSS",
      description: `Google Indexation status is non-indexed or excluded (${input.googleIndexState || "NOT_INDEXED"}).`,
      severity: "CRITICAL",
    });
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "INDEXATION_DRIVEN_DECLINE",
      gatedRecommendedAction: "REPAIR_INDEXATION",
      gatingSignals: signals,
      explanation: `URL search visibility is suppressed by Google indexation exclusion (${input.googleIndexState}). Content refresh cannot recover search traffic while unindexed.`,
    };
  }

  // 3. Migration Transition Gate (Phase 17)
  if (input.isMigrationTransitionActive) {
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "MIGRATION_RELATED_DECLINE",
      gatedRecommendedAction: "MONITOR",
      gatingSignals: signals,
      explanation: "Active migration domain/canonical transition in progress. Traffic shifts between mapped URL cohorts must not be classified as individual page content decay.",
    };
  }

  // 4. Seasonality Gate
  if (input.isSeasonallyCyclical) {
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "SEASONAL_DECLINE",
      gatedRecommendedAction: "MONITOR",
      gatingSignals: signals,
      explanation: "Decline matches established Year-over-Year seasonal cycle. Organic interest fluctuates predictably and does not indicate page content deterioration.",
    };
  }

  // 5. Overall Search Demand Decline Gate (Phase 12)
  if (input.isClusterDemandDeclining && input.clusterDemandDropPercent && input.clusterDemandDropPercent > 25) {
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "DEMAND_DECLINE",
      gatedRecommendedAction: "MONITOR",
      gatingSignals: signals,
      explanation: `Underlying search demand across target query clusters declined by ${input.clusterDemandDropPercent}% site-wide. Decline reflects broader market interest rather than page quality degradation.`,
    };
  }

  // 6. Cannibalization Pressure Gate (Phase 12)
  if (input.isCannibalizationActive) {
    signals.push({
      signalType: "CANNIBALIZATION_DETECTED",
      description: "Multiple internal URLs are competing for the same query clusters, fragmenting ranking signals.",
      severity: "WARNING",
    });
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "CANNIBALIZATION_PRESSURE",
      gatedRecommendedAction: "CONSOLIDATE",
      gatingSignals: signals,
      explanation: "Traffic decline correlates with internal query cannibalization across overlapping pages. Resolution requires intent differentiation or consolidation rather than standalone rewrite.",
    };
  }

  // 7. SERP Feature & Layout Confounding Gate (Phase 13)
  if (input.isSerpLayoutChanged) {
    signals.push({
      signalType: "SERP_LAYOUT_CONFOUNDING",
      description: `SERP layout confounding detected: ${input.serpLayoutChangeDescription || "Major SERP feature insertion or layout redesign observed"}.`,
      severity: "WARNING",
    });
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "SERP_LAYOUT_CONFOUNDING",
      gatedRecommendedAction: "EVALUATE_SERP_FEATURES",
      gatingSignals: signals,
      explanation: `SERP layout shifted significantly (${input.serpLayoutChangeDescription || "SERP feature shift"}). CTR or visibility changes are confounded by search engine presentation rather than snippet or content flaws.`,
    };
  }

  // 8. SERP Competitor Observational Shift Gate (Phase 13)
  if (input.isSerpCompetitorOvertaking) {
    signals.push({
      signalType: "SERP_LAYOUT_SHIFT",
      description: `Competitor pages with expanded comparison coverage were observed while our visibility declined (${input.serpCompetitorObservation || "Competitor coverage expansion"}).`,
      severity: "WARNING",
    });
    return {
      isGatedByAlternativeExplanation: true,
      gatedLifecycleState: "SERP_COMPETITIVE_LOSS",
      gatedRecommendedAction: "REFRESH",
      gatingSignals: signals,
      explanation: `Observational correlation: Competitor pages with expanded comparison coverage were observed while our visibility declined (${input.serpCompetitorObservation || "Competitor coverage expansion"}).`,
    };
  }

  // 9. Snippet CTR Decay Gate (with Volume & Position Stability Validation)
  if (input.isCtrDropDominant) {
    const hasSufficientVolume = (input.ctrDropImpressionsVolume || 0) >= policy.minImpressionsForCtrDecayEvaluation;
    const isPositionStable = (input.positionVariance || 0) <= policy.maxPositionVarianceForCtrDecay;

    if (hasSufficientVolume && isPositionStable) {
      signals.push({
        signalType: "CTR_DROP",
        description: "CTR declined significantly while search impressions and average rankings remained stable.",
        severity: "WARNING",
      });
      return {
        isGatedByAlternativeExplanation: true,
        gatedLifecycleState: "CTR_DECAY",
        gatedRecommendedAction: "REOPTIMIZE_SNIPPET",
        gatingSignals: signals,
        explanation: `Impressions (${input.ctrDropImpressionsVolume} imp) and average ranking position remain stable, but CTR deteriorated significantly. Title tag, meta description, or rich snippet re-optimization is recommended before touching body content.`,
      };
    }
  }

  return {
    isGatedByAlternativeExplanation: false,
    gatingSignals: [],
    explanation: "No non-content alternative explanation detected; candidate for direct content decay evaluation.",
  };
}
