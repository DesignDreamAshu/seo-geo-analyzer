/**
 * Master Content Lifecycle Intelligence Pipeline Orchestrator.
 * Coordinates page-level assessments, inventory summarization, snapshot creation, and reporting.
 */

import {
  ContentLifecycleAssessment,
  ContentLifecycleInventorySummary,
  ContentLifecycleReport,
  ContentLifecycleSnapshot,
} from "./types";
import { evaluateContentLifecycle, LifecycleEvaluationInput } from "./lifecycle-evaluator";
import { createLifecycleSnapshot } from "./snapshots";
import { ContentLifecyclePolicy, DEFAULT_CONTENT_LIFECYCLE_POLICY } from "./config";

export interface LifecyclePipelineInput {
  projectId: string;
  urlInputs: LifecycleEvaluationInput[];
  policy?: ContentLifecyclePolicy;
}

export interface LifecyclePipelineOutput {
  report: ContentLifecycleReport;
  snapshot: ContentLifecycleSnapshot;
  assessments: ContentLifecycleAssessment[];
}

export async function analyzeContentLifecycleIntelligence(
  input: LifecyclePipelineInput
): Promise<LifecyclePipelineOutput> {
  const policy = input.policy || DEFAULT_CONTENT_LIFECYCLE_POLICY;
  const assessments: ContentLifecycleAssessment[] = [];

  for (const item of input.urlInputs) {
    const assessment = evaluateContentLifecycle({
      ...item,
      projectId: input.projectId,
      policy,
    });
    assessments.push(assessment);
  }

  // Aggregate Inventory Summary
  const inventorySummary: ContentLifecycleInventorySummary = {
    projectId: input.projectId,
    totalEvaluatedUrls: assessments.length,
    healthyUrlsCount: assessments.filter((a) => a.lifecycleState === "HEALTHY" || a.lifecycleState === "STABLE").length,
    growingUrlsCount: assessments.filter((a) => a.lifecycleState === "GROWING").length,
    decayedUrlsCount: assessments.filter((a) => a.lifecycleState === "CONFIRMED_DECAY" || a.lifecycleState === "EARLY_DECAY_SIGNAL").length,
    seasonalDeclineCount: assessments.filter((a) => a.lifecycleState === "SEASONAL_DECLINE").length,
    demandDeclineCount: assessments.filter((a) => a.lifecycleState === "DEMAND_DECLINE").length,
    technicalDeclineCount: assessments.filter((a) => a.lifecycleState === "TECHNICAL_DECLINE").length,
    indexationDeclineCount: assessments.filter((a) => a.lifecycleState === "INDEXATION_DRIVEN_DECLINE").length,
    refreshCandidatesCount: assessments.filter((a) => a.primaryAction === "REFRESH" || a.primaryAction === "EXPAND").length,
    consolidationCandidatesCount: assessments.filter((a) => a.primaryAction === "CONSOLIDATE" || a.lifecycleState === "CONSOLIDATION_CANDIDATE").length,
    retirementReviewsCount: assessments.filter((a) => a.lifecycleState === "RETIREMENT_REVIEW" || a.lifecycleState === "BUSINESS_VALUE_UNKNOWN").length,
    insufficientEvidenceCount: assessments.filter((a) => a.lifecycleState === "INSUFFICIENT_EVIDENCE").length,
    complianceProtectedCount: assessments.filter((a) => a.isComplianceProtected || a.lifecycleState === "RETIREMENT_NOT_APPLICABLE").length,

    topHighValueRefreshCandidates: assessments
      .filter((a) => a.primaryAction === "REFRESH" || a.primaryAction === "EXPAND")
      .sort((a, b) => (b.baselinePerformance?.monthlyClicks || 0) - (a.baselinePerformance?.monthlyClicks || 0))
      .slice(0, 10),

    topConsolidationOpportunities: assessments
      .filter((a) => a.primaryAction === "CONSOLIDATE")
      .slice(0, 10),

    retirementReviewCandidates: assessments
      .filter((a) => a.lifecycleState === "RETIREMENT_REVIEW" || a.lifecycleState === "BUSINESS_VALUE_UNKNOWN")
      .slice(0, 10),
  };

  const governanceLimitations = [
    "Observational Correlation: Traffic changes after refresh reflect observational associations rather than deterministic causality.",
    "Non-Search Conversions: Pages with near-zero search visibility may serve vital sales, customer support, or regulatory functions.",
    "Manual Approval Required: Consolidation redirects and retirement decisions mandate explicit human review before execution.",
    "Statistical Variance Safety: Traffic percentage changes on low-volume queries are suppressed to prevent false positive decay alerts.",
  ];

  const report: ContentLifecycleReport = {
    generatedAt: new Date().toISOString(),
    projectId: input.projectId,
    modelVersion: policy.modelVersion,
    policyVersion: policy.policyVersion,
    inventorySummary,
    assessments,
    governanceLimitations,
    immutabilityStatement: "RUNTIME_IMMUTABLE",
  };

  const snapshot = createLifecycleSnapshot({
    snapshotId: `snap_lifecycle_${Date.now()}`,
    projectId: input.projectId,
    inventorySummary,
    assessments,
    modelVersion: policy.modelVersion,
    policyVersion: policy.policyVersion,
  });

  return {
    report,
    snapshot,
    assessments,
  };
}
