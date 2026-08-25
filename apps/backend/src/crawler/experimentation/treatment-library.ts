/**
 * Phase 22: Hardened Project Treatment Library & Replication Repository.
 * Maintains project-isolated treatment evidence, transferability scopes, and negative replication.
 */

import {
  ProjectTreatmentLibraryEntry,
  ReplicationStatus,
  ExperimentEvaluation,
  TransferabilityScope,
} from "./types";

export interface TreatmentLibraryStore {
  projectId: string;
  entries: Map<string, ProjectTreatmentLibraryEntry>;
}

const projectStores = new Map<string, TreatmentLibraryStore>();

export function getProjectTreatmentLibrary(projectId: string): ProjectTreatmentLibraryEntry[] {
  const store = projectStores.get(projectId);
  if (!store) return [];
  return Array.from(store.entries.values());
}

export function recordExperimentInTreatmentLibrary(
  projectId: string,
  evaluation: ExperimentEvaluation
): ProjectTreatmentLibraryEntry {
  let store = projectStores.get(projectId);
  if (!store) {
    store = { projectId, entries: new Map() };
    projectStores.set(projectId, store);
  }

  const treatmentKey = `${evaluation.experimentType}::${evaluation.hypothesis.slice(0, 50)}`;
  let entry = store.entries.get(treatmentKey);

  if (!entry) {
    let repStatus: ReplicationStatus = "UNREPLICATED_FINDING";
    entry = {
      entryId: `lib_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      treatmentName: evaluation.experimentName,
      experimentType: evaluation.experimentType,
      primaryMetric: evaluation.primaryMetric,
      applicablePageTypes: Array.from(new Set(evaluation.treatmentCohort.map((u) => u.pageType))),
      applicableIntents: ["commercial", "transactional"],
      totalExperimentsCount: 0,
      positiveOutcomesCount: 0,
      negativeOutcomesCount: 0,
      neutralOutcomesCount: 0,
      inconclusiveOutcomesCount: 0,
      replicationStatus: repStatus,
      transferabilityScope: evaluation.transferabilityScope,
      averageControlAdjustedEffectPercent: 0,
      averageControlAdjustedAbsoluteEffect: 0,
      evidenceConfidence: evaluation.evidenceQuality,
      lastExperimentDate: evaluation.evaluatedAt,
      isExcludedFromGeneralization: false,
    };
  }

  // Update counts
  entry.totalExperimentsCount += 1;
  if (evaluation.outcomeClassification === "POSITIVE_EVIDENCE") {
    entry.positiveOutcomesCount += 1;
  } else if (evaluation.outcomeClassification === "NEGATIVE_EVIDENCE") {
    entry.negativeOutcomesCount += 1;
  } else if (evaluation.outcomeClassification === "NO_CLEAR_DIFFERENCE") {
    entry.neutralOutcomesCount += 1;
  } else {
    entry.inconclusiveOutcomesCount += 1;
  }

  // Update replication status within project
  if (entry.totalExperimentsCount >= 3 && entry.positiveOutcomesCount >= 2 && entry.negativeOutcomesCount === 0) {
    entry.replicationStatus = "REPLICATED_WITHIN_PROJECT";
  } else if (entry.totalExperimentsCount >= 2 && entry.positiveOutcomesCount >= 1) {
    entry.replicationStatus = "PARTIALLY_REPLICATED";
  } else {
    entry.replicationStatus = "UNREPLICATED_FINDING";
  }

  // Repeated negative/neutral outcomes downgrade evidence confidence
  if (entry.negativeOutcomesCount > entry.positiveOutcomesCount || entry.neutralOutcomesCount >= 2) {
    entry.evidenceConfidence = "WEAK";
  } else {
    entry.evidenceConfidence = evaluation.evidenceQuality;
  }

  // Exclude invalid experiments from effect calculation
  if (evaluation.outcomeClassification === "INVALID_EXPERIMENT") {
    entry.isExcludedFromGeneralization = true;
    entry.exclusionReason = "Experiment was invalidated by fatal confounder or design defect.";
  } else {
    const prevRelTotal = entry.averageControlAdjustedEffectPercent * (entry.totalExperimentsCount - 1);
    const newRelEffect = evaluation.primaryMetricResult.controlAdjustedRelativeChangePercent;
    entry.averageControlAdjustedEffectPercent = parseFloat(((prevRelTotal + newRelEffect) / entry.totalExperimentsCount).toFixed(2));

    const prevAbsTotal = entry.averageControlAdjustedAbsoluteEffect * (entry.totalExperimentsCount - 1);
    const newAbsEffect = evaluation.primaryMetricResult.controlAdjustedAbsoluteChange;
    entry.averageControlAdjustedAbsoluteEffect = parseFloat(((prevAbsTotal + newAbsEffect) / entry.totalExperimentsCount).toFixed(2));
  }

  entry.transferabilityScope = evaluation.transferabilityScope;
  entry.lastExperimentDate = evaluation.evaluatedAt;
  store.entries.set(treatmentKey, entry);
  return entry;
}

export function resetProjectTreatmentLibrary(projectId?: string): void {
  if (projectId) {
    projectStores.delete(projectId);
  } else {
    projectStores.clear();
  }
}
