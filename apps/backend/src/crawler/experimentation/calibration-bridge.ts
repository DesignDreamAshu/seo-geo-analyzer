/**
 * Phase 22: Hardened Forecast Calibration & Cross-Phase Bridge Engine.
 * Creates explicit, auditable Phase 20 calibration candidates and Phase 11 action enrichments.
 */

import {
  ExperimentEvaluation,
  ForecastCalibrationCandidate,
  ExperimentCandidateOpportunity,
} from "./types";
import { evaluateExperimentability } from "./experimentability";

export function createForecastCalibrationCandidate(
  evaluation: ExperimentEvaluation,
  targetPageType: string,
  contributingExperimentsCount = 1
): ForecastCalibrationCandidate {
  const observedEffect = evaluation.primaryMetricResult.controlAdjustedRelativeChangePercent;
  const suggestedFactor = parseFloat((1.0 + observedEffect / 100.0).toFixed(3));

  return {
    candidateId: `calib_${evaluation.experimentId}_${Date.now()}`,
    projectId: evaluation.projectId,
    sourceExperimentId: evaluation.experimentId,
    treatmentType: evaluation.experimentType,
    targetPageType,
    observedControlAdjustedEffectPercent: observedEffect,
    evidenceQuality: evaluation.evidenceQuality,
    transferabilityScope: evaluation.transferabilityScope,
    contributingExperimentsCount,
    suggestedPhase20FactorAdjustment: suggestedFactor,
    isApprovedForForecasting: false, // Mandates explicit human approval
    auditTrail: `Generated from Experiment ${evaluation.experimentId} (${evaluation.experimentName}) with ${evaluation.evidenceQuality} evidence quality across ${contributingExperimentsCount} experiment(s). Scope: ${evaluation.transferabilityScope}. Requires explicit approval before applying to Phase 20 forecasting models.`,
  };
}

export function enrichPhase11ActionWithExperimentability(action: {
  actionId: string;
  title: string;
  category: string;
  affectedUrls: string[];
  priority: string;
  primaryOwner?: string;
  isDeterministicBugFix?: boolean;
}): ExperimentCandidateOpportunity {
  const assess = evaluateExperimentability({
    actionId: action.actionId,
    actionTitle: action.title,
    changeType: action.category,
    targetUrls: action.affectedUrls,
    isDeterministicBugFix: action.isDeterministicBugFix,
  });

  return {
    actionId: action.actionId,
    actionTitle: action.title,
    experimentType: assess.suggestedExperimentType,
    experimentability: assess.experimentability,
    eligibilityReason: assess.reasons.join(" "),
    suggestedUnit: action.affectedUrls.length > 1 ? "URL_COHORT" : "URL",
    suggestedPrimaryMetric: assess.suggestedExperimentType === "TITLE_TEST" ? "CTR" : "ORGANIC_CLICKS",
    candidateUrlsCount: action.affectedUrls.length,
    blockers: assess.blockers,
    requiresManualApproval: assess.riskLevel === "HIGH_RISK" || assess.experimentability === "LOW_EXPERIMENTABILITY",
  };
}
