/**
 * Phase 28G: AI Visibility Optimization & Fix Intelligence Master Engine.
 * Combines AI readiness, prompt universe, point-in-time observations, entity attribution,
 * and on-site content semantics into an evidence-backed optimization snapshot.
 * Strictly isolated from traditional SEO diagnostic rules.
 */

import { nanoid } from "nanoid";
import { ProjectKnowledgeProfile } from "../knowledge-profile/types";
import { PromptUniverseReport } from "../prompts/types";
import { AIObservation } from "../observation/types";
import { PromptPageMapper, CrawledPageContext } from "./mapper";
import { evaluateEntityClarity } from "./evaluators/entity-clarity";
import { evaluateAnswerCoverage } from "./evaluators/answer-coverage";
import { evaluatePromptIntentCoverage } from "./evaluators/prompt-intent-coverage";
import { evaluatePageTargeting } from "./evaluators/page-targeting";
import { evaluateContentSpecificity } from "./evaluators/content-specificity";
import { evaluateEvidenceSupport } from "./evaluators/evidence-support";
import { evaluateContentAuthority } from "./evaluators/content-authority";
import { evaluateAIDiscoverability } from "./evaluators/ai-discoverability";
import { evaluateStructuredSignals } from "./evaluators/structured-signals";
import { evaluateKnowledgeConsistency } from "./evaluators/knowledge-consistency";
import { evaluateCompetitorGap } from "./evaluators/competitor-gap";
import { evaluateSourceReadiness } from "./evaluators/source-readiness";
import {
  AIOptimizationSnapshot,
  AIOptimizationFinding,
  PromptPageMapping,
  AI_OPTIMIZATION_ENGINE_VERSION,
} from "./types";

export class AIOptimizationEngine {
  private mapper = new PromptPageMapper();

  public computeOptimizationSnapshot(
    projectId: string,
    runId: string,
    profile: ProjectKnowledgeProfile,
    promptUniverse: PromptUniverseReport,
    observations: AIObservation[] = [],
    pages: CrawledPageContext[] = [],
    robotsTxtContent?: string | null
  ): AIOptimizationSnapshot {
    const prompts = promptUniverse.allCandidates || promptUniverse.monitoringSet || (promptUniverse as any).prompts || [];

    // 1. Map all canonical prompts to crawled pages
    const mappings = this.mapper.mapPromptsToPages(prompts, pages, profile);

    // 2. Execute all specialized evaluators
    const rawFindings: AIOptimizationFinding[] = [];

    // Evaluator 1: Entity Clarity & Disambiguation
    rawFindings.push(...evaluateEntityClarity(projectId, runId, observations, pages, profile));

    // Evaluator 2: Answer Coverage
    rawFindings.push(...evaluateAnswerCoverage(projectId, runId, mappings, profile));

    // Evaluator 3: Prompt Intent Coverage
    rawFindings.push(...evaluatePromptIntentCoverage(projectId, runId, mappings, profile));

    // Evaluator 4: Page Targeting & Competition
    rawFindings.push(...evaluatePageTargeting(projectId, runId, mappings, profile));

    // Evaluator 5: Content Specificity
    rawFindings.push(...evaluateContentSpecificity(projectId, runId, pages, mappings, profile));

    // Evaluator 6: Evidence Support
    rawFindings.push(...evaluateEvidenceSupport(projectId, runId, pages, profile));

    // Evaluator 7: Content Authority (Observable Expertise)
    rawFindings.push(...evaluateContentAuthority(projectId, runId, pages, profile));

    // Evaluator 8: AI Discoverability (Deterministic Crawl Directives)
    rawFindings.push(...evaluateAIDiscoverability(projectId, runId, robotsTxtContent, profile));

    // Evaluator 9: Structured Entity Signals
    rawFindings.push(...evaluateStructuredSignals(projectId, runId, pages, profile));

    // Evaluator 10: Knowledge Consistency
    rawFindings.push(...evaluateKnowledgeConsistency(projectId, runId, pages, profile));

    // Evaluator 11: Competitor Visibility Gaps
    rawFindings.push(...evaluateCompetitorGap(projectId, runId, observations, mappings, profile));

    // Evaluator 12: Source Citation Readiness
    rawFindings.push(...evaluateSourceReadiness(projectId, runId, observations, pages, profile));

    // 3. Deduplication and Conflict Prevention
    const deduplicatedFindings = this.deduplicateAndResolveConflicts(rawFindings, mappings);

    // 4. Summarize metrics
    let highImpact = 0;
    let mediumImpact = 0;
    let lowImpact = 0;
    let defects = 0;
    let gaps = 0;
    let opportunities = 0;
    let obsCount = 0;
    const affectedPromptIds = new Set<string>();
    const affectedPageUrls = new Set<string>();

    for (const f of deduplicatedFindings) {
      if (f.priority === "HIGH_IMPACT") highImpact++;
      else if (f.priority === "MEDIUM_IMPACT") mediumImpact++;
      else lowImpact++;

      if (f.type === "DEFECT") defects++;
      else if (f.type === "GAP") gaps++;
      else if (f.type === "OPPORTUNITY") opportunities++;
      else obsCount++;

      for (const p of f.affectedPrompts || []) affectedPromptIds.add(p.id);
      for (const p of f.affectedPages || []) affectedPageUrls.add(p.url);
    }

    const groundingUnavailable = observations.some(
      (o) => o.groundingState === "GROUNDING_NOT_ACTIVE" || o.groundingState === "CITATIONS_NOT_OBSERVED_GROUNDING_DISABLED"
    );

    return {
      snapshotId: `opt_snap_${nanoid(10)}`,
      projectId,
      runId,
      generatedAt: new Date().toISOString(),
      version: AI_OPTIMIZATION_ENGINE_VERSION,
      certificationStatus: "CERTIFIED",
      summary: {
        totalFindings: deduplicatedFindings.length,
        highImpactCount: highImpact,
        mediumImpactCount: mediumImpact,
        lowImpactCount: lowImpact,
        defectsCount: defects,
        gapsCount: gaps,
        opportunitiesCount: opportunities,
        observationsCount: obsCount,
        affectedPromptsCount: affectedPromptIds.size,
        affectedPagesCount: affectedPageUrls.size,
        groundingAvailabilityState: groundingUnavailable ? "GROUNDING_UNAVAILABLE_ON_PROVIDER" : "GROUNDING_ACTIVE",
      },
      mappings,
      findings: deduplicatedFindings,
      disclaimer:
        "AI engine outputs are probabilistic and externally controlled. Dream SEO findings provide evidence-backed optimization guidance without guaranteeing third-party AI search rankings.",
    };
  }

  private deduplicateAndResolveConflicts(
    findings: AIOptimizationFinding[],
    mappings: PromptPageMapping[]
  ): AIOptimizationFinding[] {
    const findingMap = new Map<string, AIOptimizationFinding>();

    for (const f of findings) {
      // Conflict check: Do not recommend creating a new page if an existing page is already mapped as STRONG_MATCH
      if (f.code === "AI_OPT_PROMPT_NO_TARGET_PAGE") {
        const remainingPrompts = f.affectedPrompts.filter((p) => {
          const mapping = mappings.find((m) => m.promptId === p.id);
          return mapping && mapping.coverageState === "NO_TARGET_PAGE";
        });

        if (remainingPrompts.length === 0) continue; // Resolved: No true unmapped prompts left
        f.affectedPrompts = remainingPrompts;
      }

      if (!findingMap.has(f.id)) {
        findingMap.set(f.id, f);
      } else {
        // Merge affected prompts and pages
        const existing = findingMap.get(f.id)!;
        const promptSet = new Set(existing.affectedPrompts.map((p) => p.id));
        for (const p of f.affectedPrompts) {
          if (!promptSet.has(p.id)) {
            existing.affectedPrompts.push(p);
            promptSet.add(p.id);
          }
        }

        const pageSet = new Set(existing.affectedPages.map((p) => p.url));
        for (const p of f.affectedPages) {
          if (!pageSet.has(p.url)) {
            existing.affectedPages.push(p);
            pageSet.add(p.url);
          }
        }
      }
    }

    return Array.from(findingMap.values());
  }
}
