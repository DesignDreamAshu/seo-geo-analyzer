/**
 * Phase 28I: AI Optimization Measurement & Benchmarking Data Contracts.
 * Pure, transparent, evidence-backed measurement schemas with zero synthetic composite scores.
 * All metrics preserve explicit numerators and denominators.
 */

import {
  AIOptimizationCategory,
  AIOptimizationConfidence,
  AIEvidenceStrength,
  AIOptimizationFinding,
  AIOptimizationSnapshot,
  PromptPageMapping,
} from "../optimization/types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { AIObservation } from "../observation/types";

export const AI_MEASUREMENT_ENGINE_VERSION = "phase28i-measurement-v1";

export type PromptCoverageLevel =
  | "STRONG"
  | "ADEQUATE"
  | "PARTIAL"
  | "WEAK"
  | "UNSERVED"
  | "INSUFFICIENT_EVIDENCE";

export type PageTargetingState =
  | "CLEAR_PRIMARY_TARGET"
  | "MULTIPLE_COMPETING_TARGETS"
  | "WEAK_PRIMARY_TARGET"
  | "WRONG_PAGE_TYPE_TARGET"
  | "NO_TARGET"
  | "INSUFFICIENT_EVIDENCE";

export type CategoryHealthState =
  | "STRONG"
  | "HEALTHY"
  | "NEEDS_ATTENTION"
  | "LIMITED_EVIDENCE"
  | "NOT_MEASURABLE";

export type TransitionType =
  | "IMPROVED"
  | "UNCHANGED"
  | "REGRESSED"
  | "NEWLY_MEASURABLE"
  | "NO_LONGER_MEASURABLE";

export type VersionComparisonCompatibility =
  | "DIRECTLY_COMPARABLE"
  | "COMPARABLE_WITH_CAVEAT"
  | "NOT_COMPARABLE";

export interface MetricRecord {
  metricId: string;
  label: string;
  description: string;
  numerator: number;
  denominator: number;
  value: number; // Ratio: numerator / denominator (or 0 if denominator is 0)
  unit: "PROMPTS" | "PAGES" | "CLAIMS" | "POLICIES" | "FINDINGS" | "RATIO";
  scope: "CANONICAL_PROMPT_UNIVERSE" | "ELIGIBLE_SEMANTIC_CORPUS" | "ALL_CRAWLED_RESOURCES" | "OPTIMIZATION_FINDINGS";
  evidenceSource: string;
  measurementMethod: string;
  evidenceStrength: AIEvidenceStrength;
  providerDependency: "DETERMINISTIC_ON_SITE" | "PROVIDER_OBSERVATION_REQUIRED";
}

export interface PromptMeasurementDetail {
  promptId: string;
  promptText: string;
  intent: string;
  funnelStage: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  coverageLevel: PromptCoverageLevel;
  targetPageUrl: string | null;
  targetPageTitle?: string | null;
  mappingConfidence: AIOptimizationConfidence;
  answerCoverage: string;
  pageTargetingState: PageTargetingState;
  evidenceStrength: AIEvidenceStrength;
  supportingFindingsCount: number;
  notes?: string;
}

export interface IntentCoverageRecord {
  intentFamily: string;
  totalPrompts: number;
  adequatelyServed: number; // STRONG + ADEQUATE
  partial: number;
  weakOrUnserved: number;
  insufficientEvidence: number;
  coverageRatio: number; // adequatelyServed / (totalPrompts - insufficientEvidence)
  prompts: PromptMeasurementDetail[];
}

export interface CategoryMeasurementRecord {
  category: AIOptimizationCategory;
  capabilityStatus: "FULLY_IMPLEMENTED" | "PARTIAL_IMPLEMENTATION";
  healthState: CategoryHealthState;
  explanation: string;
  numerator?: number;
  denominator?: number;
  ratio?: number;
  unit?: string;
  activeFindingCount: number;
  highImpactFindingCount: number;
  evidenceStrength: AIEvidenceStrength;
}

export interface PageDemandMeasurement {
  url: string;
  title?: string | null;
  mappedPromptCount: number;
  adequatelyServedPromptCount: number;
  primaryIntents: string[];
  openFindingsCount: number;
  contentSpecificityAdequate: boolean;
  evidenceSupportAdequate: boolean;
}

export interface FindingLifecycleMeasurement {
  totalBaselineFindings: number;
  verifiedFixed: number;
  partiallyFixed: number;
  openFindings: number;
  reopenedFindings: number;
  newFindings: number;
  unverifiableFindings: number;
  verifiedRemediationCompletionRatio: number; // verifiedFixed / totalBaselineFindings
}

export interface AIMeasurementSnapshot {
  measurementId: string;
  projectId: string;
  auditRunId: string;
  optimizationSnapshotId: string;
  promptUniverseVersion: string;
  engineVersion: string;
  generatedAt: string;
  fingerprint: string;

  // 1. Overall Transparent Ratio Metrics
  metrics: {
    promptCoverage: MetricRecord;
    highPriorityPromptCoverage: MetricRecord;
    pageTargetingClarity: MetricRecord;
    answerCoverageAdequacy: MetricRecord;
    contentSpecificityCompliance: MetricRecord;
    evidenceSupportAnchoring: MetricRecord;
    remediationProgress: MetricRecord;
  };

  // 2. Distributions
  promptCoverageSummary: {
    totalCanonicalPrompts: number;
    measurablePrompts: number;
    strongCount: number;
    adequateCount: number;
    partialCount: number;
    weakCount: number;
    unservedCount: number;
    insufficientEvidenceCount: number;
    adequatelyServedCount: number; // strong + adequate
  };

  pageTargetingSummary: {
    totalEvaluated: number;
    clearPrimaryTargets: number;
    multipleCompetingTargets: number;
    weakPrimaryTargets: number;
    wrongPageTypeTargets: number;
    noTargetPrompts: number;
    insufficientEvidence: number;
  };

  // 3. Drilldowns
  promptDetails: PromptMeasurementDetail[];
  intentBreakdowns: IntentCoverageRecord[];
  categoryMeasurements: CategoryMeasurementRecord[];
  pageDemandSummaries: PageDemandMeasurement[];
  findingLifecycle: FindingLifecycleMeasurement;

  // 4. Provider Observation Status
  providerObservationStatus: {
    availabilityState: "GROUNDING_ACTIVE" | "PROVIDER_EVIDENCE_UNAVAILABLE" | "OBSERVATIONS_RECORDED";
    totalPromptsObserved: number;
    brandMentionsObserved: number;
    citationsObserved: number;
    note: string;
  };

  disclaimer: string;
}

export interface PromptTransition {
  promptId: string;
  promptText: string;
  intent: string;
  previousLevel: PromptCoverageLevel;
  currentLevel: PromptCoverageLevel;
  transitionType: TransitionType;
  attribution: {
    targetPageUrl: string | null;
    evidenceChange: string;
    rationale: string;
  };
}

export interface MetricDelta {
  metricId: string;
  label: string;
  previousNumerator: number;
  previousDenominator: number;
  previousValue: number;
  currentNumerator: number;
  currentDenominator: number;
  currentValue: number;
  absoluteDelta: number; // currentNumerator - previousNumerator
  ratioDelta: number; // currentValue - previousValue
  direction: "IMPROVED" | "NEUTRAL" | "REGRESSED";
}

export interface AIMeasurementComparison {
  comparisonId: string;
  projectId: string;
  baselineSnapshotId: string;
  currentSnapshotId: string;
  baselineGeneratedAt: string;
  currentGeneratedAt: string;
  baselineEngineVersion: string;
  currentEngineVersion: string;
  compatibility: VersionComparisonCompatibility;
  compatibilityNote: string;

  metricDeltas: MetricDelta[];
  promptTransitions: PromptTransition[];

  summary: {
    totalPromptsCompared: number;
    improvedPromptsCount: number;
    unchangedPromptsCount: number;
    regressedPromptsCount: number;
    netPromptsAdequatelyServedDelta: number;
    resolvedFindingsCount: number;
    newFindingsCount: number;
  };

  remediationDrivers: Array<{
    title: string;
    affectedPromptText: string;
    targetUrl: string;
    transition: string;
    driverExplanation: string;
  }>;

  regressions: Array<{
    title: string;
    affectedPromptText: string;
    targetUrl: string;
    transition: string;
    regressionExplanation: string;
  }>;
}
