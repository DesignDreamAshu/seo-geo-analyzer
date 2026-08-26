/**
 * Phase 28G: AI Visibility Optimization & Fix Intelligence Data Contracts.
 * Pure actionable optimization intelligence derived from AI readiness, prompt universe,
 * live multi-provider observations, entity attribution, and on-site content semantics.
 * Completely isolated from traditional SEO diagnostic models.
 */

export const AI_OPTIMIZATION_ENGINE_VERSION = "phase28h-advanced-content-intelligence";

export type AIOptimizationCategoryCapabilityStatus =
  | "FULLY_IMPLEMENTED"
  | "PARTIAL_IMPLEMENTATION"
  | "DERIVED_FROM_ANOTHER_EVALUATOR"
  | "RESERVED_FOR_FUTURE_EXPANSION"
  | "NOT_IMPLEMENTED";

export const AI_OPTIMIZATION_CATEGORY_CAPABILITIES: Record<
  AIOptimizationCategory,
  { status: AIOptimizationCategoryCapabilityStatus; evaluatorOrSource: string }
> = {
  ENTITY_CLARITY: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateEntityClarity" },
  ANSWER_COVERAGE: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateAnswerCoverage" },
  PROMPT_INTENT_COVERAGE: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluatePromptIntentCoverage" },
  PAGE_TARGETING: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluatePageTargeting" },
  STRUCTURED_ENTITY_SIGNAL: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateStructuredSignals" },
  KNOWLEDGE_CONSISTENCY: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateKnowledgeConsistency" },
  COMPETITOR_VISIBILITY_GAP: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateCompetitorGap" },
  SOURCE_CITATION_READINESS: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateSourceReadiness" },
  CONTENT_SPECIFICITY: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateContentSpecificity" },
  EVIDENCE_SUPPORT: { status: "FULLY_IMPLEMENTED", evaluatorOrSource: "evaluateEvidenceSupport" },
  CONTENT_AUTHORITY: { status: "PARTIAL_IMPLEMENTATION", evaluatorOrSource: "evaluateContentAuthority (Observable Expertise & Framework Signals)" },
  AI_DISCOVERABILITY: { status: "PARTIAL_IMPLEMENTATION", evaluatorOrSource: "evaluateAIDiscoverability (Deterministic AI Crawler Directives)" },
};

export type AIOptimizationCategory =
  | "ENTITY_CLARITY"
  | "ANSWER_COVERAGE"
  | "PROMPT_INTENT_COVERAGE"
  | "CONTENT_AUTHORITY"
  | "EVIDENCE_SUPPORT"
  | "SOURCE_CITATION_READINESS"
  | "COMPETITOR_VISIBILITY_GAP"
  | "PAGE_TARGETING"
  | "STRUCTURED_ENTITY_SIGNAL"
  | "KNOWLEDGE_CONSISTENCY"
  | "AI_DISCOVERABILITY"
  | "CONTENT_SPECIFICITY";

export type AIOptimizationType =
  | "DEFECT"       // Deterministic on-site error/issue blocking AI understanding
  | "GAP"          // Missing or weak information relative to target intent/prompt
  | "OPPORTUNITY"  // Potential enhancement supported by evidence
  | "OBSERVATION"; // Provider behavior worth noting without requiring website fix

export type AIOptimizationPriority = "HIGH_IMPACT" | "MEDIUM_IMPACT" | "LOW_IMPACT";

export type AIOptimizationConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AIEvidenceStrength = "STRONG" | "MODERATE" | "LIMITED" | "INSUFFICIENT";

export type AIOptimizationLifecycleStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WEBSITE_FIX_VERIFIED"
  | "AWAITING_PROVIDER_RECHECK"
  | "IMPROVEMENT_OBSERVED"
  | "NO_CHANGE_OBSERVED"
  | "REGRESSED"
  | "DISMISSED"
  | "NOT_APPLICABLE";

export type PromptPageCoverageState =
  | "STRONG_MATCH"
  | "PARTIAL_MATCH"
  | "WEAK_MATCH"
  | "NO_TARGET_PAGE"
  | "MULTIPLE_COMPETING_PAGES"
  | "INSUFFICIENT_EVIDENCE";

export type AnswerCoverageLevel =
  | "COVERED"
  | "PARTIALLY_COVERED"
  | "NOT_COVERED"
  | "UNCLEAR";

export interface CandidatePageMatch {
  url: string;
  score: number; // 0 - 100
  title?: string | null;
  matchReasons: string[];
}

export interface PromptPageMapping {
  promptId: string;
  promptText: string;
  intent: string;
  funnelStage: string;
  brandedness: string;
  targetPageUrl: string | null;
  candidatePages: CandidatePageMatch[];
  mappingConfidence: AIOptimizationConfidence;
  coverageState: PromptPageCoverageState;
  answerCoverage: AnswerCoverageLevel;
  answerCoverageEvidence: {
    whatIsProvided?: string | null;
    targetAudienceMentioned: boolean;
    businessProblemSolved: boolean;
    missingElements: string[];
    extractedSnippet?: string | null;
  };
  notes?: string;
}

export interface AIOptimizationEvidence {
  sourceSignal: string;
  providerObservations?: Array<{
    observationId: string;
    providerId: string;
    model: string;
    promptText: string;
    attributionState?: string;
    rawSnippet?: string;
    stringMentionDetected?: boolean;
    confirmedBrandMention?: boolean;
  }>;
  websiteEvidence?: {
    url: string;
    pageTitle?: string | null;
    element?: string | null;
    snippet?: string | null;
    observedFact?: any;
  };
  competitorEvidence?: Array<{
    competitorName: string;
    observedInPrompt: string;
    sourceSnippet?: string;
  }>;
  groundingStatus?: "GROUNDING_ACTIVE" | "PROVIDER_EVIDENCE_UNAVAILABLE" | "NOT_REQUESTED";
  groundingDetails?: string;
}

export interface AIOptimizationRootCause {
  hypothesis: string;
  contributingFactors: string[];
  isDeterministic: boolean;
  rationale: string;
}

export interface AIOptimizationRecommendation {
  objective: string;
  whatShouldChange: string;
  whereToChange: string;
  actionSteps: string[];
  exampleBefore?: string;
  exampleAfter?: string;
  cautions: string[];
}

export interface AIOptimizationVerificationMethod {
  level1WebsiteVerification: {
    method: string;
    targetCheck: string;
    expectedEvidence: string;
  };
  level2ProviderVerification: {
    method: string;
    targetPromptIds: string[];
    expectedOutcome: string;
  };
}

export interface AIOptimizationFinding {
  id: string; // Unique stable identifier (e.g. opt_xxx)
  projectId: string;
  runId: string;

  code: string;
  category: AIOptimizationCategory;
  type: AIOptimizationType;
  priority: AIOptimizationPriority;
  confidence: AIOptimizationConfidence;
  evidenceStrength: AIEvidenceStrength;

  title: string;
  summary: string;
  whyItMatters: string;

  problem: {
    observed: string;
    explanation: string;
  };

  evidence: AIOptimizationEvidence;
  rootCause: AIOptimizationRootCause;

  affectedPrompts: Array<{
    id: string;
    prompt: string;
    intent: string;
    funnelStage: string;
    brandedness: string;
  }>;
  affectedPages: Array<{
    url: string;
    title?: string | null;
    matchType?: string;
  }>;
  affectedEntities: string[];
  affectedProviders: string[];

  supportingCategories?: AIOptimizationCategory[];
  supportingSignals?: string[];

  recommendation: AIOptimizationRecommendation;
  verificationMethod: AIOptimizationVerificationMethod;

  lifecycleStatus: AIOptimizationLifecycleStatus;
  noGuaranteeDisclaimer: string;

  createdAt: string;
  updatedAt: string;
}

export interface AIOptimizationSnapshot {
  snapshotId: string;
  projectId: string;
  runId: string;
  generatedAt: string;
  version: string;
  certificationStatus: "PENDING" | "CERTIFIED" | "FAILED";
  summary: {
    totalFindings: number;
    highImpactCount: number;
    mediumImpactCount: number;
    lowImpactCount: number;
    defectsCount: number;
    gapsCount: number;
    opportunitiesCount: number;
    observationsCount: number;
    affectedPromptsCount: number;
    affectedPagesCount: number;
    groundingAvailabilityState: string;
  };
  mappings: PromptPageMapping[];
  findings: AIOptimizationFinding[];
  disclaimer: string;
}
