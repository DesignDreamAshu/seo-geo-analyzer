/**
 * Phase 28B + Phase 28C: Main AI Search Intelligence Engine Orchestrator
 * Runs on-site readiness (28B) and Knowledge Profile + Prompt Discovery (28C) in complete isolation from SEO models.
 */

import type { CrawledPageData } from "../crawler/types";
import type {
  OnSiteAISearchReadinessReport,
  AISearchFinding,
  AIObservabilityRecord,
} from "./types";
import { evaluateAICrawlerAccessibility } from "./technical/crawler-accessibility";
import { evaluateAEOAnswerReadiness } from "./aeo/answer-readiness";
import { evaluateGEOEvidenceReadiness } from "./geo/evidence-readiness";
import { evaluateEntityGrounding } from "./entity/entity-grounding";
import { computeAIReadinessScores } from "./scoring/readiness-scoring";

// Phase 28C Imports
import { ProjectKnowledgeProfile } from "./knowledge-profile/types";
import { PromptUniverseReport } from "./prompts/types";
import { extractProjectKnowledgeProfile } from "./knowledge-profile/extractor";
import { globalKnowledgeGovernance } from "./knowledge-profile/governance";
import { discoverQuestions } from "./prompts/question-discovery";
import { generatePromptCandidates } from "./prompts/prompt-generator";
import { deduplicateAndClusterPrompts } from "./prompts/deduplication";
import { selectMonitoringPrompts } from "./prompts/priority-selector";

export interface RunAISearchReadinessOptions {
  robotsTxtContent?: string | null;
  llmsTxtContent?: string | null;
}

export function evaluateOnSiteAISearchReadiness(
  crawledPages: CrawledPageData[],
  options: RunAISearchReadinessOptions = {}
): OnSiteAISearchReadinessReport {
  const allFindings: AISearchFinding[] = [];
  const allObservability: AIObservabilityRecord[] = [];

  // 1. Engine A: Technical Crawler Accessibility
  const technicalRes = evaluateAICrawlerAccessibility(
    options.robotsTxtContent || null,
    options.llmsTxtContent || null,
    crawledPages
  );
  allFindings.push(...technicalRes.findings);
  allObservability.push(...technicalRes.observability);

  // 2. Engine B: AEO Answer Readiness
  const aeoRes = evaluateAEOAnswerReadiness(crawledPages);
  allFindings.push(...aeoRes.findings);
  allObservability.push(...aeoRes.observability);

  // 3. Engine C: GEO Source & Evidence Readiness
  const geoRes = evaluateGEOEvidenceReadiness(crawledPages);
  allFindings.push(...geoRes.findings);
  allObservability.push(...geoRes.observability);

  // 4. Engine D: Entity Grounding & LLM Comprehension
  const entityRes = evaluateEntityGrounding(crawledPages);
  allFindings.push(...entityRes.findings);
  allObservability.push(...entityRes.observability);

  // 5. Compute Transparent 4-Pillar Scores
  const scores = computeAIReadinessScores(allObservability);

  // Summary counts
  let blockers = 0;
  let warnings = 0;
  let opportunities = 0;
  let notices = 0;
  let experimentals = 0;

  for (const f of allFindings) {
    if (f.severity === "BLOCKER") blockers++;
    else if (f.severity === "WARNING") warnings++;
    else if (f.severity === "OPPORTUNITY") opportunities++;
    else if (f.severity === "NOTICE") notices++;
    else if (f.severity === "EXPERIMENTAL") experimentals++;
  }

  return {
    timestamp: new Date().toISOString(),
    methodologyVersion: "v28b-1.0",
    system: "AI_SEARCH",
    summary: {
      totalPagesEvaluated: crawledPages.length,
      totalFindings: allFindings.length,
      blockers,
      warnings,
      opportunities,
      notices,
      experimentals,
    },
    scores,
    crawlerAccessibility: {
      agents: technicalRes.statuses,
      llmsTxt: technicalRes.llmsTxtStatus,
      rawVsRenderContentAccessible: technicalRes.rawVsRenderAccessible,
    },
    aeoEvaluations: aeoRes.evaluations,
    geoEvaluations: geoRes.evaluations,
    entityEvaluations: entityRes.evaluations,
    findings: allFindings,
    observability: allObservability,
  };
}

/**
 * Phase 28C: Generates Knowledge Profile and Clustered Prompt Universe from Crawl Evidence.
 */
export function generateProjectKnowledgeAndPromptUniverse(
  projectId: string,
  domain: string,
  crawledPages: CrawledPageData[]
): {
  profile: ProjectKnowledgeProfile;
  promptUniverse: PromptUniverseReport;
} {
  // 1. Extract raw Knowledge Profile from crawl
  const rawProfile = extractProjectKnowledgeProfile(projectId, domain, crawledPages);

  // 2. Apply persistent user governance overrides
  const profile = globalKnowledgeGovernance.applyOverrides(rawProfile);

  // 3. Discover authentic questions
  const discoveredQuestions = discoverQuestions(crawledPages, profile);

  // 4. Generate prompt candidates across all 18 prompt types
  const rawCandidates = generatePromptCandidates(profile, discoveredQuestions);

  // 5. Deduplicate and cluster candidates with stable cluster IDs
  const { deduplicatedCandidates, clusters } = deduplicateAndClusterPrompts(rawCandidates);

  // 6. Select monitoring set & compute health metrics
  const { allCandidates, monitoringSet, health } = selectMonitoringPrompts(
    deduplicatedCandidates,
    clusters,
    profile
  );

  const promptUniverse: PromptUniverseReport = {
    projectId,
    domain,
    generatedAt: new Date().toISOString(),
    methodologyVersion: "v28c-1.0",
    health,
    clusters,
    monitoringSet,
    allCandidates,
  };

  return {
    profile,
    promptUniverse,
  };
}

export * from "./types";
export * from "./knowledge-profile/types";
export * from "./prompts/types";
export * from "./observation/types";
export * from "./observation/engine";
export * from "./observation/extractor";
export * from "./analytics/types";
export * from "./analytics/engine";
export * from "./analytics/trend-engine";
export * from "./citations/types";
export * from "./citations/canonicalizer";
export * from "./citations/classifier";
export * from "./citations/engine";
export * from "./optimization/types";
export * from "./optimization/mapper";
export * from "./optimization/engine";
export * from "./optimization/verifier";
export * from "./optimization/persistence/sqlite-optimization-repo";
export { globalKnowledgeGovernance } from "./knowledge-profile/governance";

import { AIOptimizationEngine } from "./optimization/engine";
export const globalAIOptimizationEngine = new AIOptimizationEngine();
