/**
 * Phase 28J: Competitor AI Intelligence & Competitive Benchmarking Data Contracts.
 * PROMPT × INTENT × PAGE × EVIDENCE competitive intelligence without fake scores.
 */

import { AIEvidenceStrength, AIOptimizationConfidence } from "../optimization/types";
import { CrawledPageContext } from "../optimization/mapper";

export const COMPETITIVE_ENGINE_VERSION = "phase28j-competitive-intelligence-v1";

export type CompetitorSource = "USER_CONFIGURED" | "DISCOVERED_CANDIDATE" | "PROVIDER_OBSERVED";
export type CompetitorStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface ProjectCompetitor {
  competitorId: string;
  projectId: string;
  domain: string;
  displayName: string;
  status: CompetitorStatus;
  source: CompetitorSource;
  discoveryReason?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitorCorpusSummary {
  competitorId: string;
  domain: string;
  discoveredResources: number;
  crawledResources: number;
  htmlPages: number;
  indexableHtml: number;
  aiEligiblePages: number;
  excludedPages: number;
  lastCrawledAt: string | null;
  freshness: "FRESH" | "ACCEPTABLE" | "STALE" | "UNKNOWN";
  coverageNote: string;
}

export type PromptCompetitiveState =
  | "CLIENT_ADVANTAGE"
  | "COMPETITOR_ADVANTAGE"
  | "ROUGH_PARITY"
  | "BOTH_WEAK"
  | "CLIENT_ONLY"
  | "COMPETITOR_ONLY"
  | "INSUFFICIENT_EVIDENCE";

export type PromptOwnership =
  | "CLIENT"
  | "COMPETITOR"
  | "PARITY"
  | "NO_CLEAR_OWNER"
  | "INSUFFICIENT_EVIDENCE";

export interface CompetitiveAdvantageEvidence {
  winner: "CLIENT" | "COMPETITOR" | "NEITHER";
  reasons: string[];
  dimensions: {
    intentSatisfaction: string;
    answerCoverage: string;
    contentSpecificity: string;
    evidenceSupport: string;
    targetingClarity: string;
    citationReadiness: string;
  };
}

export interface CompetitorPageMatch {
  competitorId: string;
  competitorName: string;
  competitorDomain: string;
  coverageState: string;
  bestPageUrl: string | null;
  bestPageTitle?: string | null;
  mappingConfidence: AIOptimizationConfidence;
  answerCoverage: string;
  evidenceSummary: string;
}

export interface PromptCompetitiveDetail {
  promptId: string;
  promptText: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  intent: string;
  clientState: string;
  clientBestPageUrl: string | null;
  clientMappingConfidence: AIOptimizationConfidence;
  competitorMatches: CompetitorPageMatch[];
  competitiveState: PromptCompetitiveState;
  ownership: PromptOwnership;
  winningCompetitorName?: string | null;
  advantageEvidence: CompetitiveAdvantageEvidence;
  opportunityId?: string | null;
}

export interface IntentCompetitiveSummary {
  intentFamily: string;
  totalComparablePrompts: number;
  clientAdvantages: number;
  competitorAdvantages: number;
  roughParity: number;
  bothWeak: number;
  insufficientEvidence: number;
}

export type OpportunityType =
  | "PROMPT_COVERAGE_GAP"
  | "INTENT_COVERAGE_GAP"
  | "ANSWER_DEPTH_GAP"
  | "PAGE_TARGETING_GAP"
  | "CONTENT_SPECIFICITY_GAP"
  | "EVIDENCE_SUPPORT_GAP"
  | "SOURCE_READINESS_GAP"
  | "ENTITY_POSITIONING_GAP";

export type OpportunityActionType =
  | "IMPROVE_EXISTING_PAGE"
  | "CREATE_SUPPORTING_CONTENT"
  | "CREATE_NEW_TARGET_PAGE"
  | "CONSOLIDATE_PAGES"
  | "DIFFERENTIATE_ORIGINAL_METHODOLOGY";

export interface CompetitiveOpportunity {
  opportunityId: string;
  type: OpportunityType;
  priority: "HIGH" | "MEDIUM" | "LOW";
  actionType: OpportunityActionType;
  title: string;
  clientTargetPageUrl: string | null;
  affectedPrompts: Array<{
    id: string;
    text: string;
    intent: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
  competitorReferences: Array<{
    competitorName: string;
    referenceUrl: string | null;
    observedAdvantage: string;
  }>;
  observedGap: string;
  strategicRationale: string;
  recommendedChange: string;
  copySafetyWarning: string;
  verificationMethod: string;
}

export interface ClientAdvantageRecord {
  advantageId: string;
  clientTargetPageUrl: string;
  clientPageTitle?: string | null;
  affectedPrompts: Array<{ id: string; text: string; intent: string }>;
  advantageType: string;
  whyClientWins: string;
  preservationGuidance: string;
}

export interface AICompetitiveBenchmarkSnapshot {
  snapshotId: string;
  projectId: string;
  clientMeasurementSnapshotId: string;
  promptUniverseVersion: string;
  optimizationEngineVersion: string;
  measurementEngineVersion: string;
  competitiveEngineVersion: string;
  comparability: "DIRECTLY_COMPARABLE" | "COMPARABLE_WITH_CAVEAT" | "NOT_COMPARABLE";
  comparabilityNote: string;
  fingerprint: string;
  generatedAt: string;
  competitors: ProjectCompetitor[];
  competitorCorpusSummaries: Record<string, CompetitorCorpusSummary>;
  summary: {
    totalPromptsCompared: number;
    clientAdvantagesCount: number;
    competitorAdvantagesCount: number;
    roughParityCount: number;
    bothWeakCount: number;
    highPriorityGapsCount: number;
    opportunitiesCount: number;
    clientAdvantagesRecordCount: number;
  };
  promptComparisons: PromptCompetitiveDetail[];
  intentComparisons: IntentCompetitiveSummary[];
  opportunities: CompetitiveOpportunity[];
  clientAdvantages: ClientAdvantageRecord[];
  providerObservationStatus: {
    availabilityState: "GROUNDING_ACTIVE" | "PROVIDER_EVIDENCE_UNAVAILABLE" | "OBSERVATIONS_RECORDED";
    totalObserved: number;
    note: string;
  };
  disclaimer: string;
}
