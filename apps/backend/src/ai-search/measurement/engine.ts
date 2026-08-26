/**
 * Phase 28I: AI Optimization Measurement & Benchmarking Engine.
 * Computes deterministic, transparent, evidence-backed measurement snapshots.
 * Strictly avoids synthetic composite scoring (no fake AEO/GEO scores).
 */

import { nanoid } from "nanoid";
import {
  AIMeasurementSnapshot,
  MetricRecord,
  PromptMeasurementDetail,
  IntentCoverageRecord,
  CategoryMeasurementRecord,
  PageDemandMeasurement,
  FindingLifecycleMeasurement,
  PromptCoverageLevel,
  PageTargetingState,
  CategoryHealthState,
  AI_MEASUREMENT_ENGINE_VERSION,
} from "./types";
import {
  AIOptimizationSnapshot,
  AIOptimizationFinding,
  AIOptimizationCategory,
  AI_OPTIMIZATION_CATEGORY_CAPABILITIES,
  PromptPageMapping,
} from "../optimization/types";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptUniverseReport, PromptCandidate } from "../prompts/types";
import { AIObservation } from "../observation/types";
import { CrawledPageContext } from "../optimization/mapper";
import { validateAIMeasurementInvariants } from "./invariants";
import { computeAIMeasurementFingerprint } from "./fingerprint";

export class AIMeasurementEngine {
  public computeMeasurementSnapshot(
    projectId: string,
    auditRunId: string,
    optimizationSnapshot: AIOptimizationSnapshot,
    profile: ProjectKnowledgeProfile,
    promptUniverse: PromptUniverseReport,
    pages: CrawledPageContext[] = [],
    observations: AIObservation[] = [],
    baselineFindings: AIOptimizationFinding[] = []
  ): AIMeasurementSnapshot {
    const rawPrompts: PromptCandidate[] =
      promptUniverse.allCandidates || promptUniverse.monitoringSet || (promptUniverse as any).prompts || [];

    const mappings = optimizationSnapshot.mappings || [];
    const findings = optimizationSnapshot.findings || [];

    // 1. Compute Prompt Measurement Details
    const promptDetails: PromptMeasurementDetail[] = [];

    let strongCount = 0;
    let adequateCount = 0;
    let partialCount = 0;
    let weakCount = 0;
    let unservedCount = 0;
    let insufficientEvidenceCount = 0;

    let clearPrimaryTargets = 0;
    let multipleCompetingTargets = 0;
    let weakPrimaryTargets = 0;
    let wrongPageTypeTargets = 0;
    let noTargetPrompts = 0;
    let targetInsufficientEvidence = 0;

    for (const prompt of rawPrompts) {
      const mapping = mappings.find((m) => m.promptId === prompt.id);

      // Determine Page Targeting State
      let targetingState: PageTargetingState = "CLEAR_PRIMARY_TARGET";
      if (!mapping || mapping.coverageState === "NO_TARGET_PAGE" || !mapping.targetPageUrl) {
        targetingState = "NO_TARGET";
      } else if (mapping.candidatePages && mapping.candidatePages.length >= 2) {
        const top1 = mapping.candidatePages[0];
        const top2 = mapping.candidatePages[1];
        if (top1.score >= 70 && top2.score >= 65 && Math.abs(top1.score - top2.score) <= 10) {
          targetingState = "MULTIPLE_COMPETING_TARGETS";
        }
      }

      if (mapping?.targetPageUrl) {
        const urlLower = mapping.targetPageUrl.toLowerCase();
        if (
          (urlLower.includes("/job") || urlLower.includes("/career")) &&
          (prompt.promptType === "SERVICE_DISCOVERY" || prompt.brandedness === "UNBRANDED")
        ) {
          targetingState = "WRONG_PAGE_TYPE_TARGET";
        }
      }

      if (mapping && mapping.coverageState === "WEAK_MATCH") {
        targetingState = "WEAK_PRIMARY_TARGET";
      }

      // Count targeting states
      if (targetingState === "CLEAR_PRIMARY_TARGET") clearPrimaryTargets++;
      else if (targetingState === "MULTIPLE_COMPETING_TARGETS") multipleCompetingTargets++;
      else if (targetingState === "WEAK_PRIMARY_TARGET") weakPrimaryTargets++;
      else if (targetingState === "WRONG_PAGE_TYPE_TARGET") wrongPageTypeTargets++;
      else if (targetingState === "NO_TARGET") noTargetPrompts++;
      else targetInsufficientEvidence++;

      // Determine Overall Prompt Coverage Level
      let level: PromptCoverageLevel = "ADEQUATE";

      if (!mapping || mapping.mappingConfidence === "LOW") {
        level = "INSUFFICIENT_EVIDENCE";
        insufficientEvidenceCount++;
      } else if (mapping.coverageState === "NO_TARGET_PAGE") {
        level = "UNSERVED";
        unservedCount++;
      } else if (mapping.coverageState === "WEAK_MATCH" || mapping.answerCoverage === "NOT_COVERED") {
        level = "WEAK";
        weakCount++;
      } else if (mapping.coverageState === "PARTIAL_MATCH" || mapping.answerCoverage === "PARTIALLY_COVERED") {
        level = "PARTIAL";
        partialCount++;
      } else if (mapping.coverageState === "STRONG_MATCH" && mapping.answerCoverage === "COVERED") {
        level = "STRONG";
        strongCount++;
      } else {
        level = "ADEQUATE";
        adequateCount++;
      }

      const supportingFindings = findings.filter(
        (f) =>
          (f.affectedPrompts || []).some((p) => p.id === prompt.id) ||
          (mapping?.targetPageUrl && (f.affectedPages || []).some((p) => p.url === mapping.targetPageUrl))
      );

      promptDetails.push({
        promptId: prompt.id,
        promptText: prompt.prompt,
        intent: Array.isArray(prompt.intents) ? prompt.intents[0] : (prompt as any).intent || "COMMERCIAL",
        funnelStage: prompt.funnelStage || "CONSIDERATION",
        priority: prompt.monitoringTier === "TIER_1_CORE" ? "HIGH" : prompt.priorityScore && prompt.priorityScore > 75 ? "HIGH" : "MEDIUM",
        coverageLevel: level,
        targetPageUrl: mapping?.targetPageUrl || null,
        targetPageTitle: mapping?.targetPageUrl,
        mappingConfidence: mapping?.mappingConfidence || "MEDIUM",
        answerCoverage: mapping?.answerCoverage || "UNCLEAR",
        pageTargetingState: targetingState,
        evidenceStrength: level === "STRONG" ? "STRONG" : level === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT" : "MODERATE",
        supportingFindingsCount: supportingFindings.length,
        notes: mapping?.notes,
      });
    }

    const totalCanonicalPrompts = promptDetails.length;
    const measurablePrompts = totalCanonicalPrompts - insufficientEvidenceCount;
    const adequatelyServedCount = strongCount + adequateCount;

    // High priority segmentation
    const highPriorityPrompts = promptDetails.filter((p) => p.priority === "HIGH");
    const highPriorityMeasurable = highPriorityPrompts.filter((p) => p.coverageLevel !== "INSUFFICIENT_EVIDENCE").length;
    const highPriorityAdequate = highPriorityPrompts.filter(
      (p) => p.coverageLevel === "STRONG" || p.coverageLevel === "ADEQUATE"
    ).length;

    // 2. Compute Intent Breakdowns
    const intentMap = new Map<string, PromptMeasurementDetail[]>();
    for (const p of promptDetails) {
      const family = p.intent || "INFORMATIONAL";
      if (!intentMap.has(family)) intentMap.set(family, []);
      intentMap.get(family)!.push(p);
    }

    const intentBreakdowns: IntentCoverageRecord[] = [];
    for (const [family, list] of intentMap.entries()) {
      const served = list.filter((p) => p.coverageLevel === "STRONG" || p.coverageLevel === "ADEQUATE").length;
      const partial = list.filter((p) => p.coverageLevel === "PARTIAL").length;
      const weakOrUnserved = list.filter((p) => p.coverageLevel === "WEAK" || p.coverageLevel === "UNSERVED").length;
      const insufficient = list.filter((p) => p.coverageLevel === "INSUFFICIENT_EVIDENCE").length;
      const measurable = list.length - insufficient;

      intentBreakdowns.push({
        intentFamily: family,
        totalPrompts: list.length,
        adequatelyServed: served,
        partial,
        weakOrUnserved,
        insufficientEvidence: insufficient,
        coverageRatio: measurable > 0 ? Number((served / measurable).toFixed(4)) : 0,
        prompts: list,
      });
    }

    // 3. Compute Category Health Records (All 12 Categories)
    const allCategories: AIOptimizationCategory[] = [
      "ANSWER_COVERAGE",
      "PROMPT_INTENT_COVERAGE",
      "PAGE_TARGETING",
      "CONTENT_SPECIFICITY",
      "EVIDENCE_SUPPORT",
      "STRUCTURED_ENTITY_SIGNAL",
      "SOURCE_CITATION_READINESS",
      "ENTITY_CLARITY",
      "COMPETITOR_VISIBILITY_GAP",
      "KNOWLEDGE_CONSISTENCY",
      "CONTENT_AUTHORITY",
      "AI_DISCOVERABILITY",
    ];

    const categoryMeasurements: CategoryMeasurementRecord[] = [];

    for (const cat of allCategories) {
      const cap = AI_OPTIMIZATION_CATEGORY_CAPABILITIES[cat];
      const catFindings = findings.filter((f) => f.category === cat);
      const highImpactFindings = catFindings.filter((f) => f.priority === "HIGH_IMPACT");

      let healthState: CategoryHealthState = "HEALTHY";
      let explanation = `No high-severity gaps observed for ${cat.replace(/_/g, " ")}.`;

      if (cap.status === "PARTIAL_IMPLEMENTATION") {
        healthState = "LIMITED_EVIDENCE";
        explanation = `Evaluates observable deterministic on-site signals without fabricating synthetic domain scores.`;
      } else if (highImpactFindings.length > 0) {
        healthState = "NEEDS_ATTENTION";
        explanation = `${highImpactFindings.length} high-impact remediation finding(s) require action.`;
      } else if (catFindings.length > 0) {
        healthState = "NEEDS_ATTENTION";
        explanation = `${catFindings.length} actionable optimization gap(s) identified on site.`;
      } else {
        healthState = "STRONG";
        explanation = `Site content and structure fully satisfy ${cat.replace(/_/g, " ")} requirements.`;
      }

      categoryMeasurements.push({
        category: cat,
        capabilityStatus: cap.status as any,
        healthState,
        explanation,
        activeFindingCount: catFindings.length,
        highImpactFindingCount: highImpactFindings.length,
        evidenceStrength: catFindings.length > 0 ? catFindings[0].evidenceStrength : "STRONG",
      });
    }

    // 4. Compute Page Demand Measurements
    const pageDemandMap = new Map<string, PageDemandMeasurement>();
    for (const page of pages) {
      pageDemandMap.set(page.url, {
        url: page.url,
        title: page.title || null,
        mappedPromptCount: 0,
        adequatelyServedPromptCount: 0,
        primaryIntents: [],
        openFindingsCount: 0,
        contentSpecificityAdequate: true,
        evidenceSupportAdequate: true,
      });
    }

    for (const p of promptDetails) {
      if (p.targetPageUrl && pageDemandMap.has(p.targetPageUrl)) {
        const item = pageDemandMap.get(p.targetPageUrl)!;
        item.mappedPromptCount++;
        if (p.coverageLevel === "STRONG" || p.coverageLevel === "ADEQUATE") {
          item.adequatelyServedPromptCount++;
        }
        if (!item.primaryIntents.includes(p.intent)) {
          item.primaryIntents.push(p.intent);
        }
      }
    }

    for (const f of findings) {
      for (const p of f.affectedPages || []) {
        if (pageDemandMap.has(p.url)) {
          const item = pageDemandMap.get(p.url)!;
          item.openFindingsCount++;
          if (f.category === "CONTENT_SPECIFICITY") item.contentSpecificityAdequate = false;
          if (f.category === "EVIDENCE_SUPPORT") item.evidenceSupportAdequate = false;
        }
      }
    }

    const pageDemandSummaries = Array.from(pageDemandMap.values()).filter(
      (p) => p.mappedPromptCount > 0 || p.openFindingsCount > 0
    );

    // 5. Compute Finding Lifecycle & Remediation Progress
    const totalBaselineFindings = baselineFindings.length > 0 ? baselineFindings.length : findings.length;
    const verifiedFixed = baselineFindings.filter((f) => f.lifecycleStatus === "WEBSITE_FIX_VERIFIED").length;
    const partiallyFixed = baselineFindings.filter((f) => f.lifecycleStatus === "IN_PROGRESS").length;
    const openCount = findings.length;

    const findingLifecycle: FindingLifecycleMeasurement = {
      totalBaselineFindings,
      verifiedFixed,
      partiallyFixed,
      openFindings: openCount,
      reopenedFindings: 0,
      newFindings: 0,
      unverifiableFindings: 0,
      verifiedRemediationCompletionRatio:
        totalBaselineFindings > 0 ? Number((verifiedFixed / totalBaselineFindings).toFixed(4)) : 0,
    };

    // 6. Assemble Transparent Metric Records (All With Numerators & Denominators)
    const metrics: AIMeasurementSnapshot["metrics"] = {
      promptCoverage: {
        metricId: "ai_metric_prompt_coverage",
        label: "Canonical Prompt Coverage",
        description: "Proportion of canonical discovery queries adequately satisfied by on-site content.",
        numerator: adequatelyServedCount,
        denominator: measurablePrompts,
        value: measurablePrompts > 0 ? Number((adequatelyServedCount / measurablePrompts).toFixed(4)) : 0,
        unit: "PROMPTS",
        scope: "CANONICAL_PROMPT_UNIVERSE",
        evidenceSource: "PROMPT_PAGE_MAPPER_SEMANTIC_EVALUATION",
        measurementMethod: "Evaluates target mapping confidence, intent satisfaction, and answer structure.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
      highPriorityPromptCoverage: {
        metricId: "ai_metric_high_priority_coverage",
        label: "High-Priority Prompt Coverage",
        description: "Proportion of Tier-1 and high-priority discovery queries adequately satisfied.",
        numerator: highPriorityAdequate,
        denominator: highPriorityMeasurable,
        value: highPriorityMeasurable > 0 ? Number((highPriorityAdequate / highPriorityMeasurable).toFixed(4)) : 0,
        unit: "PROMPTS",
        scope: "CANONICAL_PROMPT_UNIVERSE",
        evidenceSource: "PROMPT_TIER_SEMANTIC_EVALUATION",
        measurementMethod: "Filtered subset of core tier-1 prompts.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
      pageTargetingClarity: {
        metricId: "ai_metric_page_targeting_clarity",
        label: "Page Targeting Clarity",
        description: "Proportion of canonical prompts with a clear, unambiguous primary destination URL.",
        numerator: clearPrimaryTargets,
        denominator: totalCanonicalPrompts,
        value: totalCanonicalPrompts > 0 ? Number((clearPrimaryTargets / totalCanonicalPrompts).toFixed(4)) : 0,
        unit: "PROMPTS",
        scope: "CANONICAL_PROMPT_UNIVERSE",
        evidenceSource: "PROMPT_TARGETING_CANDIDATE_DIVERGENCE",
        measurementMethod: "Calculates candidate score margin and cannibalization safety.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
      answerCoverageAdequacy: {
        metricId: "ai_metric_answer_coverage_adequacy",
        label: "Answer Coverage Adequacy",
        description: "Proportion of prompts where mapped pages directly provide self-contained answer blocks.",
        numerator: strongCount + adequateCount,
        denominator: measurablePrompts,
        value: measurablePrompts > 0 ? Number(((strongCount + adequateCount) / measurablePrompts).toFixed(4)) : 0,
        unit: "PROMPTS",
        scope: "CANONICAL_PROMPT_UNIVERSE",
        evidenceSource: "SEMANTIC_ANSWER_EXTRACTION",
        measurementMethod: "Scans opening paragraphs for service definitions and audience statements.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
      contentSpecificityCompliance: {
        metricId: "ai_metric_content_specificity_compliance",
        label: "Content Specificity Compliance",
        description: "Proportion of commercial landing pages meeting required technical and audience dimensions.",
        numerator: Math.max(0, pages.length - findings.filter((f) => f.category === "CONTENT_SPECIFICITY").length),
        denominator: pages.length,
        value: pages.length > 0 ? Number((Math.max(0, pages.length - findings.filter((f) => f.category === "CONTENT_SPECIFICITY").length) / pages.length).toFixed(4)) : 1,
        unit: "PAGES",
        scope: "ELIGIBLE_SEMANTIC_CORPUS",
        evidenceSource: "DIMENSIONAL_LEXICAL_AUDIT",
        measurementMethod: "Verifies presence of WHAT, WHO, PROBLEM, METHOD, OUTCOME, DIFFERENTIATOR.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
      evidenceSupportAnchoring: {
        metricId: "ai_metric_evidence_support_anchoring",
        label: "Evidence Support Anchoring",
        description: "Proportion of commercial pages whose quantitative claims are anchored by case study links.",
        numerator: Math.max(0, pages.length - findings.filter((f) => f.category === "EVIDENCE_SUPPORT").length),
        denominator: pages.length,
        value: pages.length > 0 ? Number((Math.max(0, pages.length - findings.filter((f) => f.category === "EVIDENCE_SUPPORT").length) / pages.length).toFixed(4)) : 1,
        unit: "PAGES",
        scope: "ELIGIBLE_SEMANTIC_CORPUS",
        evidenceSource: "CLAIM_CASE_STUDY_ATTRIBUTION",
        measurementMethod: "Evaluates unbacked numerical claims against on-site proof links.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
      remediationProgress: {
        metricId: "ai_metric_remediation_progress",
        label: "Verified Remediation Progress",
        description: "Proportion of baseline optimization findings verified as fixed on website.",
        numerator: verifiedFixed,
        denominator: totalBaselineFindings,
        value: totalBaselineFindings > 0 ? Number((verifiedFixed / totalBaselineFindings).toFixed(4)) : 0,
        unit: "FINDINGS",
        scope: "OPTIMIZATION_FINDINGS",
        evidenceSource: "REMEDIATION_VERIFIER_LEVEL_1",
        measurementMethod: "Re-checks on-page DOM and sitemap evidence.",
        evidenceStrength: "STRONG",
        providerDependency: "DETERMINISTIC_ON_SITE",
      },
    };

    // 7. Provider Observation Status
    const totalObs = observations.length;
    const mentionsObs = observations.filter((o) => o.brandMentioned).length;
    const citationsObs = observations.filter((o) => (o.citations || []).length > 0).length;

    const providerObservationStatus: AIMeasurementSnapshot["providerObservationStatus"] = {
      availabilityState: totalObs > 0 ? "OBSERVATIONS_RECORDED" : "PROVIDER_EVIDENCE_UNAVAILABLE",
      totalPromptsObserved: totalObs,
      brandMentionsObserved: mentionsObs,
      citationsObserved: citationsObs,
      note:
        totalObs === 0
          ? "Live search grounding is parked. Deterministic on-site AI readiness measurements remain fully operational."
          : `Recorded observations across ${totalObs} discovery query executions.`,
    };

    const draftSnapshot: Omit<AIMeasurementSnapshot, "fingerprint"> = {
      measurementId: `meas_snap_${nanoid(10)}`,
      projectId,
      auditRunId,
      optimizationSnapshotId: optimizationSnapshot.snapshotId,
      promptUniverseVersion: "v1.0",
      engineVersion: AI_MEASUREMENT_ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      metrics,
      promptCoverageSummary: {
        totalCanonicalPrompts,
        measurablePrompts,
        strongCount,
        adequateCount,
        partialCount,
        weakCount,
        unservedCount,
        insufficientEvidenceCount,
        adequatelyServedCount,
      },
      pageTargetingSummary: {
        totalEvaluated: totalCanonicalPrompts,
        clearPrimaryTargets,
        multipleCompetingTargets,
        weakPrimaryTargets,
        wrongPageTypeTargets,
        noTargetPrompts,
        insufficientEvidence: targetInsufficientEvidence,
      },
      promptDetails,
      intentBreakdowns,
      categoryMeasurements,
      pageDemandSummaries,
      findingLifecycle,
      providerObservationStatus,
      disclaimer:
        "AI Optimization measurements reflect deterministic on-site content readiness and prompt alignment without inventing probabilistic third-party composite scores.",
    };

    // Validate Invariants
    validateAIMeasurementInvariants(draftSnapshot as any);

    // Compute Fingerprint
    const fingerprint = computeAIMeasurementFingerprint(draftSnapshot);

    return {
      ...draftSnapshot,
      fingerprint,
    };
  }
}
