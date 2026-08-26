/**
 * Phase 28B: AI Search Intelligence Types & Contracts
 * Completely isolated from traditional SEO diagnostic models.
 */

export type AISearchPillar = "TECHNICAL" | "AEO" | "GEO" | "ENTITY_LLM";

export type AIMeasurementClass =
  | "DETERMINISTIC"
  | "HEURISTIC"
  | "CONTEXTUAL"
  | "PROVIDER_REQUIRED"
  | "EXPERIMENTAL";

export type AIEvidenceLevel = "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "LEVEL_D" | "LEVEL_E";

export type AISeverity = "BLOCKER" | "WARNING" | "OPPORTUNITY" | "NOTICE" | "EXPERIMENTAL";

export interface AISearchFinding {
  id: string;
  dimensionId: string;
  pillar: AISearchPillar;
  measurementClass: AIMeasurementClass;
  evidenceLevel: AIEvidenceLevel;
  severity: AISeverity;
  title: string;
  description: string;
  recommendation: string;
  confidenceScore: number; // 0.0 - 1.0
  impactScore: number;     // 0 - 10
  isScoring: boolean;
  affectedUrl: string;
  affectedElement?: string | null;
  evidence: {
    observed: string;
    codeSnippet?: string | null;
    domSelector?: string | null;
    rawFact?: any;
    confidenceRationale?: string;
  };
  remediationBlueprint: {
    objective: string;
    actionSteps: string[];
    verificationMethod: string;
    disclaimer?: string;
  };
}

export type AICrawlerPurpose =
  | "SEARCH_RETRIEVAL"
  | "MODEL_TRAINING"
  | "USER_INITIATED_FETCH"
  | "GENERAL_INDEXING";

export type AICrawlerAccessState = "ALLOWED" | "BLOCKED" | "PARTIALLY_BLOCKED" | "UNKNOWN";

export interface AICrawlerStatus {
  agentName: string;
  owner: string;
  purpose: AICrawlerPurpose;
  accessState: AICrawlerAccessState;
  matchedDirective?: string | null;
  ruleSource?: string | null;
  isExplicit: boolean;
  affectedPaths: string[];
  docSourceVersion: string;
}

export interface LlmsTxtStatus {
  present: boolean;
  url: string;
  statusCode?: number;
  contentType?: string | null;
  isSyntacticallyValid: boolean;
  charLength?: number;
  sectionsFound: string[];
  notes: string;
}

export interface AEOQuestionEvaluation {
  url: string;
  headingText: string;
  headingTag: string;
  questionType: "EXPLICIT_QUESTION" | "IMPLICIT_QUESTION";
  hasDirectAnswer: boolean;
  directAnswerText?: string | null;
  directAnswerWordCount?: number;
  isSelfContained: boolean;
  selfContainmentConfidence: number;
  hasDefinitionPattern: boolean;
  hasSemanticList: boolean;
  hasDataTable: boolean;
  hasFaqStructure: boolean;
}

export interface GEOEvidenceEvaluation {
  url: string;
  quantitativeClaimsCount: number;
  attributedClaimsCount: number;
  unattributedClaimsCount: number;
  hasOriginalDataSignals: boolean;
  originalDataSignalTypes: string[];
  authorEntityDeclared: boolean;
  authorHasCredentials: boolean;
  hasModifiedFreshnessDate: boolean;
  datePublished?: string | null;
  dateModified?: string | null;
  isEvergreen: boolean;
  isStale: boolean;
}

export interface EntityGroundingEvaluation {
  url: string;
  hasOrganizationSchema: boolean;
  orgNameDeclared?: string | null;
  orgLegalNameDeclared?: string | null;
  orgUrlDeclared?: string | null;
  orgSameAsCount: number;
  sameAsUrls: string[];
  personEntitiesCount: number;
  personWorksForAligned: boolean;
  productOrServiceSchemaFound: boolean;
  productOrServiceType?: "Product" | "Service" | "None";
  hasContradictoryEntityNames: boolean;
  contradictionDetails?: string[];
  localEntityGroundingComplete: boolean;
}

export type EvaluationStatus =
  | "FULLY_EVALUATED"
  | "SUBSTANTIALLY_EVALUATED"
  | "PARTIALLY_EVALUATED"
  | "INSUFFICIENT_EVIDENCE";

export type EvaluatorStatus = "PASS" | "PARTIAL" | "FAIL" | "NOT_EVALUATED" | "NOT_APPLICABLE";

export interface EvaluatorResult {
  evaluatorId: string;
  evaluatorName: string;
  pillar: AISearchPillar;
  weight: number; // Sums to 100 within pillar
  aggregationLevel: "SITE_LEVEL" | "PAGE_LEVEL" | "PROMPT_LEVEL" | "ENTITY_LEVEL";
  status: EvaluatorStatus;
  score: number; // 0.0 to 1.0
  earnedPoints: number;
  maxPoints: number;
  rawObservation: string;
  threshold: string;
  recommendation?: string;
  evidence?: any;
}

export interface AIReadinessSubScore {
  score: number | null; // 0 - 100 or null if NOT_EVALUATED / INSUFFICIENT_EVIDENCE
  weight?: number;
  eligibleWeight?: number;
  evaluatedWeight?: number;
  evaluationCoverage?: number;
  evaluationStatus?: EvaluationStatus;
  evaluators?: EvaluatorResult[];
  passedChecks?: string[];
  partialChecks?: string[];
  failedChecks?: string[];
  recommendations?: string[];
  eligibleDimensions: number;
  evaluatedDimensions: number;
  passedDimensions: number;
  failedDimensions: number;
  advisoryCount: number;
  providerRequiredCount: number;
  notApplicableCount: number;
}

export interface AIReadinessScoreBreakdown {
  scoreModelVersion: string; // "v28c-2.1"
  overallScore?: number | null;
  overallCoverage?: number;
  overallStatus?: EvaluationStatus;
  technicalAccessibility: AIReadinessSubScore;
  aeoReadiness: AIReadinessSubScore;
  geoEvidenceReadiness: AIReadinessSubScore;
  entityGrounding: AIReadinessSubScore;
}

export interface AIObservabilityRecord {
  dimensionId: string;
  pillar: AISearchPillar;
  measurementClass: AIMeasurementClass;
  evidenceLevel: AIEvidenceLevel;
  eligibleCount: number;
  evaluatedCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  status: "PASSED" | "FAILED" | "SKIPPED" | "PROVIDER_REQUIRED";
}

export interface OnSiteAISearchReadinessReport {
  timestamp: string;
  methodologyVersion: string; // "v28b-1.0"
  system: "AI_SEARCH";
  summary: {
    totalPagesEvaluated: number;
    totalFindings: number;
    blockers: number;
    warnings: number;
    opportunities: number;
    notices: number;
    experimentals: number;
  };
  scores: AIReadinessScoreBreakdown;
  crawlerAccessibility: {
    agents: AICrawlerStatus[];
    llmsTxt: LlmsTxtStatus;
    rawVsRenderContentAccessible: boolean;
  };
  aeoEvaluations: AEOQuestionEvaluation[];
  geoEvaluations: GEOEvidenceEvaluation[];
  entityEvaluations: EntityGroundingEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
}
