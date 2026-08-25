/**
 * Phase 22: Master SEO Experimentation & Causal Learning Engine.
 * Coordinates experiment design, cohort matching, pre-period validation, DiD analysis, and report generation.
 */

import {
  EvaluateExperimentInput,
  evaluateExperimentCausality,
} from "./causal-evaluator";
import {
  MatchCohortsInput,
  matchTreatmentAndControlCohorts,
} from "./cohort-matcher";
import {
  PrePeriodValidationInput,
  validatePrePeriod,
} from "./pre-period-validator";
import {
  ProposedChangeInput,
  evaluateExperimentability,
} from "./experimentability";
import {
  recordExperimentInTreatmentLibrary,
  getProjectTreatmentLibrary,
  resetProjectTreatmentLibrary,
} from "./treatment-library";
import {
  createExperimentSnapshot,
  validateExperimentSnapshotComparability,
} from "./snapshots";
import { serializeExperimentReportMarkdown } from "./report-serializer";
import {
  ExperimentEvaluation,
  ExperimentSnapshot,
  ProjectTreatmentLibraryEntry,
} from "./types";

export interface AnalyzeExperimentPipelineInput {
  experimentInput: EvaluateExperimentInput;
  saveToTreatmentLibrary?: boolean;
}

export interface AnalyzeExperimentPipelineResult {
  evaluation: ExperimentEvaluation;
  snapshot: ExperimentSnapshot;
  treatmentLibrary: ProjectTreatmentLibraryEntry[];
  reportMarkdown: string;
}

export async function runExperimentAnalysisPipeline(
  input: AnalyzeExperimentPipelineInput
): Promise<AnalyzeExperimentPipelineResult> {
  const evaluation = evaluateExperimentCausality(input.experimentInput);
  const snapshot = createExperimentSnapshot(evaluation);

  let treatmentLibrary: ProjectTreatmentLibraryEntry[] = [];
  if (input.saveToTreatmentLibrary !== false) {
    recordExperimentInTreatmentLibrary(evaluation.projectId, evaluation);
    treatmentLibrary = getProjectTreatmentLibrary(evaluation.projectId);
  }

  const reportMarkdown = serializeExperimentReportMarkdown({
    evaluation,
    treatmentLibrary,
  });

  return {
    evaluation,
    snapshot,
    treatmentLibrary,
    reportMarkdown,
  };
}

export {
  evaluateExperimentability,
  matchTreatmentAndControlCohorts,
  validatePrePeriod,
  evaluateExperimentCausality,
  recordExperimentInTreatmentLibrary,
  getProjectTreatmentLibrary,
  resetProjectTreatmentLibrary,
  createExperimentSnapshot,
  validateExperimentSnapshotComparability,
  serializeExperimentReportMarkdown,
};
