/**
 * Phase 28C: Calibrated Deterministic AI Readiness Scoring Engine
 * Computes 4 independent sub-scores with strict denominator transparency and rich evaluator breakdowns.
 * Never penalizes missing external provider credentials.
 * Version: v28c-2.0 (Methodology: ai-readiness-v2).
 */

import type {
  AIReadinessScoreBreakdown,
  AIReadinessSubScore,
  AIObservabilityRecord,
  AISearchPillar,
  EvaluatorResult,
  EvaluationStatus,
} from "../types";
import { SCORING_MODEL_VERSION } from "./scoring-contract";

export function computeCalibratedPillarScore(
  pillar: AISearchPillar,
  evaluators: EvaluatorResult[],
  observability: AIObservabilityRecord[] = []
): AIReadinessSubScore {
  const pillarEvaluators = evaluators.filter((e) => e.pillar === pillar);

  let eligibleDimensions = 0;
  let evaluatedDimensions = 0;
  let passedDimensions = 0;
  let failedDimensions = 0;
  let advisoryCount = 0;
  let providerRequiredCount = 0;
  let notApplicableCount = 0;

  let totalEarnedPoints = 0;
  let totalEligibleMaxPoints = 0;
  let eligibleWeight = 0;
  let evaluatedWeight = 0;

  const passedChecks: string[] = [];
  const partialChecks: string[] = [];
  const failedChecks: string[] = [];
  const recommendations: string[] = [];

  for (const ev of pillarEvaluators) {
    if (ev.status === "NOT_APPLICABLE") {
      notApplicableCount++;
      continue;
    }

    if (ev.status === "NOT_EVALUATED") {
      providerRequiredCount++;
      continue;
    }

    eligibleDimensions++;
    evaluatedDimensions++;
    totalEligibleMaxPoints += ev.maxPoints;
    totalEarnedPoints += ev.earnedPoints;
    eligibleWeight += ev.weight;
    evaluatedWeight += ev.weight;

    if (ev.status === "PASS") {
      passedDimensions++;
      passedChecks.push(ev.evaluatorName);
    } else if (ev.status === "PARTIAL") {
      partialChecks.push(`${ev.evaluatorName} (${Math.round(ev.score * 100)}%)`);
      if (ev.recommendation) recommendations.push(ev.recommendation);
    } else if (ev.status === "FAIL") {
      failedDimensions++;
      failedChecks.push(ev.evaluatorName);
      if (ev.recommendation) recommendations.push(ev.recommendation);
    }
  }

  // Also account for pure observability records if present
  for (const obs of observability.filter((o) => o.pillar === pillar)) {
    if (obs.measurementClass === "EXPERIMENTAL" || obs.evidenceLevel === "LEVEL_D") {
      advisoryCount++;
    }
    if (obs.measurementClass === "PROVIDER_REQUIRED" || obs.status === "PROVIDER_REQUIRED") {
      providerRequiredCount++;
    }
  }

  // CRITICAL RULE: Zero evaluated checks or 0 eligible max points MUST produce score: null (NEVER 100!)
  const score = (evaluatedDimensions > 0 && totalEligibleMaxPoints > 0)
    ? Math.max(0, Math.min(100, Math.round((totalEarnedPoints / totalEligibleMaxPoints) * 100)))
    : null;

  const evaluationCoverage = pillarEvaluators.length > 0
    ? Math.round((evaluatedDimensions / pillarEvaluators.length) * 100)
    : 0;

  const evaluationStatus: EvaluationStatus =
    evaluationCoverage >= 90
      ? "FULLY_EVALUATED"
      : evaluationCoverage >= 75
      ? "SUBSTANTIALLY_EVALUATED"
      : evaluationCoverage >= 50
      ? "PARTIALLY_EVALUATED"
      : "INSUFFICIENT_EVIDENCE";

  return {
    score,
    weight: 25,
    eligibleWeight,
    evaluatedWeight,
    evaluationCoverage,
    evaluationStatus,
    evaluators: pillarEvaluators,
    passedChecks,
    partialChecks,
    failedChecks,
    recommendations,
    eligibleDimensions,
    evaluatedDimensions,
    passedDimensions,
    failedDimensions,
    advisoryCount,
    providerRequiredCount,
    notApplicableCount,
  };
}

export function computeAIReadinessScores(
  evaluators: EvaluatorResult[],
  observability: AIObservabilityRecord[] = []
): AIReadinessScoreBreakdown {
  const technicalAccessibility = computeCalibratedPillarScore("TECHNICAL", evaluators, observability);
  const aeoReadiness = computeCalibratedPillarScore("AEO", evaluators, observability);
  const geoEvidenceReadiness = computeCalibratedPillarScore("GEO", evaluators, observability);
  const entityGrounding = computeCalibratedPillarScore("ENTITY_LLM", evaluators, observability);

  const allPillars = [technicalAccessibility, aeoReadiness, geoEvidenceReadiness, entityGrounding];
  const evaluatedPillars = allPillars.filter((p) => p.score !== null);

  const overallCoverage = Math.round(
    ((technicalAccessibility.evaluationCoverage || 0) +
      (aeoReadiness.evaluationCoverage || 0) +
      (geoEvidenceReadiness.evaluationCoverage || 0) +
      (entityGrounding.evaluationCoverage || 0)) /
      4
  );

  const overallStatus: EvaluationStatus =
    overallCoverage >= 90
      ? "FULLY_EVALUATED"
      : overallCoverage >= 75
      ? "SUBSTANTIALLY_EVALUATED"
      : overallCoverage >= 50
      ? "PARTIALLY_EVALUATED"
      : "INSUFFICIENT_EVIDENCE";

  // Quorum rule: Requires at least 2 evaluated pillars AND >= 50% overall coverage to emit an overall score
  const overallScore = (evaluatedPillars.length >= 2 && overallCoverage >= 50)
    ? Math.round(evaluatedPillars.reduce((sum, p) => sum + (p.score as number), 0) / evaluatedPillars.length)
    : null;

  return {
    scoreModelVersion: SCORING_MODEL_VERSION,
    overallScore,
    overallCoverage,
    overallStatus,
    technicalAccessibility,
    aeoReadiness,
    geoEvidenceReadiness,
    entityGrounding,
  };
}
