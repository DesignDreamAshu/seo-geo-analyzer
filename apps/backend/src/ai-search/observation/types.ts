/**
 * Phase 28D: Live AI Visibility Observation & Multi-Engine Measurement Types.
 * Strictly isolated from traditional SEO diagnostic models and SEO health scores.
 */

import { IntentTaxonomy, FunnelStage, PromptSpecificity, PromptBrandedness, PromptType } from "../prompts/types";

export type AIProviderId =
  | "OPENAI"
  | "GEMINI"
  | "PERPLEXITY"
  | "ANTHROPIC"
  | "COPILOT"
  | "MANUAL_IMPORT";

export type ObservationSamplingMode = "QUICK" | "STANDARD" | "HIGH_CONFIDENCE";

export type ObservationStatus =
  | "SUCCESS"
  | "FAILED"
  | "PENDING"
  | "PROVIDER_ERROR"
  | "UNSUPPORTED"
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "AUTH_FAILED"
  | "GROUNDING_UNAVAILABLE";

export type ObservationRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type EntityAttributionState =
  | "CONFIRMED_ENTITY"
  | "PROBABLE_ENTITY"
  | "AMBIGUOUS_ENTITY"
  | "GENERIC_TERM"
  | "DIFFERENT_ENTITY"
  | "INSUFFICIENT_EVIDENCE";

export type GroundingExecutionState =
  | "GROUNDING_ACTIVE"
  | "GROUNDING_NOT_ACTIVE"
  | "CITATIONS_NOT_OBSERVED_GROUNDING_DISABLED"
  | "GROUNDING_UNSUPPORTED";

export interface EntityAttribution {
  state: EntityAttributionState;
  confidence: number; // 0.0 - 1.0 (heuristic/calibrated evidence weight)
  stringMentionDetected: boolean;
  entityMentionConfirmed: boolean;
  positiveSignals: string[];
  negativeSignals: string[];
  ambiguityReasons: string[];
  rationale: string;
}

export type MentionContextType =
  | "RECOMMENDED"
  | "NEUTRAL_MENTION"
  | "COMPARISON"
  | "NEGATIVE"
  | "UNKNOWN";

export type CitationDomainType =
  | "OWN_DOMAIN"
  | "COMPETITOR_DOMAIN"
  | "THIRD_PARTY_AUTHORITY"
  | "DIRECTORY"
  | "SOCIAL"
  | "COMMUNITY"
  | "NEWS"
  | "OTHER";

export interface ProviderCapability {
  providerId: AIProviderId;
  providerName: string;
  isConfigured: boolean;
  supportsApi: boolean;
  supportsWebGrounding: boolean;
  supportsCitations: boolean;
  supportsSourceUrls: boolean;
  supportsLocation: boolean;
  supportsLanguage: boolean;
  supportsModelSelection: boolean;
  defaultModel: string;
  availableModels: string[];
}

export interface BrandMention {
  canonicalEntity: string;
  matchedText: string;
  occurrenceIndex: number;
  characterOffset: number;
  paragraphIndex: number;
  contextSnippet: string;
  mentionType: MentionContextType;
  entityAttributionState: EntityAttributionState;
  isConfirmedEntity: boolean;
  recommendationOrder?: number | null; // e.g. 1st, 2nd, 3rd in list
  confidence: number;
}

export interface CompetitorMention {
  competitorName: string;
  canonicalEntity: string;
  matchedText: string;
  occurrenceIndex: number;
  characterOffset: number;
  contextSnippet: string;
  entityAttributionState?: EntityAttributionState;
  isConfirmedEntity?: boolean;
  recommendationOrder?: number | null;
  isKnownCompetitor: boolean;
  confidence: number;
}

export interface CitationObservation {
  sourceUrl: string;
  domain: string;
  title?: string | null;
  citationIndex: number;
  domainType: CitationDomainType;
  isOwnDomain: boolean;
  matchedBrandOffering?: string | null;
  attributionSnippet?: string | null;
}

export interface AIProviderResponse {
  providerId: AIProviderId;
  model: string;
  configuredModel?: string;
  requestedModel?: string;
  providerConfirmedModel?: string | null;
  rawText: string;
  normalizedText: string;
  citations: CitationObservation[];
  responseHash: string;
  latencyMs: number;
  statusCode?: number;
  isGroundingActive: boolean;
  requestedGrounding?: boolean;
  groundingState?: GroundingExecutionState;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  observedAt: string;
}

export interface AIObservation {
  observationId: string;
  runId: string;
  projectId: string;
  promptId: string;
  clusterId: string;
  promptText: string;
  promptType: PromptType;
  intent: IntentTaxonomy;
  funnelStage: FunnelStage;
  specificity: PromptSpecificity;
  brandedness: PromptBrandedness;
  providerId: AIProviderId;
  model: string;
  configuredModel?: string;
  requestedModel?: string;
  providerConfirmedModel?: string | null;
  runNumber: number; // e.g. 1, 2, 3 in stochastic repeats
  totalRunsPlanned: number;
  status: ObservationStatus;
  failureReason?: string | null;
  rawResponse?: string | null;
  normalizedResponse?: string | null;
  responseHash?: string | null;
  stringMentionDetected?: boolean;
  entityAttribution?: EntityAttribution;
  requestedGrounding?: boolean;
  groundingState?: GroundingExecutionState;
  fallbackUsed?: boolean;
  fallbackReason?: string | null;
  brandMentioned: boolean;
  brandMentionCount: number;
  brandRecommendationOrder?: number | null;
  brandMentions: BrandMention[];
  competitorsMentioned: CompetitorMention[];
  citations: CitationObservation[];
  ownDomainCited: boolean;
  ownDomainCitationCount: number;
  extractorVersion: string;
  observedAt: string;
}

export interface PromptObservationSummary {
  promptId: string;
  promptText: string;
  clusterId: string;
  clusterName: string;
  brandedness: PromptBrandedness;
  promptType: PromptType;
  intent: IntentTaxonomy;
  funnelStage: FunnelStage;
  totalObservationsPlanned: number;
  successfulObservations: number;
  failedObservations: number;
  brandMentionCount: number;
  brandMentionRate: number; // 0.0 - 1.0
  averageRecommendationOrder?: number | null;
  ownDomainCitationCount: number;
  ownDomainCitationRate: number; // 0.0 - 1.0
  topObservedCompetitors: Array<{ name: string; frequency: number }>;
  topCitedDomains: Array<{ domain: string; frequency: number; isOwnDomain: boolean }>;
  providerBreakdown: Record<string, {
    runs: number;
    mentions: number;
    mentionRate: number;
    citations: number;
    citationRate: number;
  }>;
  latestObservationAt: string;
}

export interface ObservationRunConfig {
  projectId: string;
  promptTier: "TIER_1" | "TIER_2" | "TIER_3" | "SELECTED_PROMPTS";
  selectedPromptIds?: string[];
  selectedClusterIds?: string[];
  providers: AIProviderId[];
  samplingMode: ObservationSamplingMode;
  runsPerPrompt: number; // 1, 3, or 5
  country: string;
  language: string;
}

export interface ObservationRunSummary {
  runId: string;
  projectId: string;
  status: ObservationRunStatus;
  startedAt: string;
  completedAt?: string | null;
  config: ObservationRunConfig;
  knowledgeProfileVersion: string;
  promptUniverseVersion: string;
  totalPlannedObservations: number;
  completedObservations: number;
  successfulObservations: number;
  failedObservations: number;
  overallBrandMentionRate: number;
  unbrandedBrandMentionRate: number;
  brandedBrandMentionRate: number;
  ownDomainCitationRate: number;
  activeProviders: AIProviderId[];
  promptSummaries: PromptObservationSummary[];
}

export const AI_OBSERVATION_EXTRACTOR_VERSION = "v28d1-entity-attribution-2.0";
