/**
 * Phase 28C: Prompt Discovery, Intent Taxonomy & Clustering Types.
 * Strictly isolated from traditional SEO diagnostic models.
 */

export type PromptBrandedness = "BRANDED" | "SEMI_BRANDED" | "UNBRANDED";

export type PromptType =
  | "CATEGORY_DISCOVERY"
  | "BRAND_DISCOVERY"
  | "SERVICE_DISCOVERY"
  | "PROBLEM_SOLUTION"
  | "COMPARISON"
  | "COMPETITOR_COMPARISON"
  | "RECOMMENDATION"
  | "BEST_VENDOR"
  | "ALTERNATIVES"
  | "EXPERTISE_VALIDATION"
  | "INDUSTRY_SPECIFIC"
  | "LOCATION_SPECIFIC"
  | "HOW_TO"
  | "DEFINITIONAL"
  | "DECISION_SUPPORT"
  | "IMPLEMENTATION_GUIDANCE"
  | "USE_CASE"
  | "BRAND_SPECIFIC";

export type IntentTaxonomy =
  | "INFORMATIONAL"
  | "DEFINITIONAL"
  | "HOW_TO"
  | "PROBLEM_SOLVING"
  | "COMPARISON"
  | "ALTERNATIVE"
  | "RECOMMENDATION"
  | "BEST_OF"
  | "COMMERCIAL_INVESTIGATION"
  | "VENDOR_DISCOVERY"
  | "PURCHASE_SELECTION"
  | "LOCAL"
  | "NAVIGATIONAL"
  | "VALIDATION"
  | "IMPLEMENTATION"
  | "TROUBLESHOOTING";

export type FunnelStage = "AWARENESS" | "CONSIDERATION" | "DECISION" | "IMPLEMENTATION";

export type PromptSpecificity = "BROAD" | "MID" | "SPECIFIC" | "LONG_CONTEXT";

export type MonitoringTier = "TIER_1_CORE" | "TIER_2_EXPANDED" | "TIER_3_EXPERIMENTAL";

export type PromptCandidateSource =
  | "OBSERVED_GSC_QUERY"
  | "OBSERVED_KEYWORD"
  | "OBSERVED_WEBSITE_QUESTION"
  | "SERP_DISCOVERED"
  | "DERIVED_FROM_EVIDENCE"
  | "USER_DEFINED";

export interface PromptEvidenceTrace {
  derivedFromOfferingId?: string;
  derivedFromOfferingName?: string;
  derivedFromTopicId?: string;
  derivedFromTopicName?: string;
  derivedFromAudienceId?: string;
  derivedFromAudienceName?: string;
  derivedFromIndustryId?: string;
  derivedFromIndustryName?: string;
  derivedFromCompetitorName?: string;
  sourceSignal: PromptCandidateSource;
  evidenceSnippet?: string;
  reason: string;
}

export interface PromptCandidate {
  id: string; // Stable deterministic hash
  prompt: string;
  promptType: PromptType;
  brandedness: PromptBrandedness;
  intents: IntentTaxonomy[];
  funnelStage: FunnelStage;
  specificity: PromptSpecificity;
  clusterId: string;
  monitoringTier: MonitoringTier;
  isRepresentative: boolean;
  isPinned: boolean;
  isExcluded: boolean;
  isManual: boolean;
  priorityScore: number; // 0 - 100
  confidenceScore: number; // 0.0 - 1.0
  evidenceTrace: PromptEvidenceTrace;
  locale: {
    country: string;
    language: string;
    market?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PromptCluster {
  id: string; // Stable hash/slug
  name: string;
  pillar: string; // Offering / Topic / Intent focus
  intentFamily: IntentTaxonomy;
  promptsCount: number;
  representativePromptId: string;
  monitoringTier: MonitoringTier;
  samplePrompts: string[];
}

export interface PromptHealthMetrics {
  totalCandidates: number;
  deduplicatedCount: number;
  representativeCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  pinnedCount: number;
  excludedCount: number;
  manualCount: number;
  clustersCount: number;
  coreOfferingCoverage: {
    covered: number;
    total: number;
    ratio: number;
  };
  coreTopicCoverage: {
    covered: number;
    total: number;
    ratio: number;
  };
  commercialIntentCoverage: {
    covered: number;
    total: number;
    ratio: number;
  };
  coverageGaps: Array<{
    category: "OFFERING" | "TOPIC" | "INTENT" | "AUDIENCE";
    name: string;
    remedy: string;
  }>;
}

export interface PromptUniverseReport {
  projectId: string;
  domain: string;
  generatedAt: string;
  methodologyVersion: string;
  health: PromptHealthMetrics;
  clusters: PromptCluster[];
  monitoringSet: PromptCandidate[];
  allCandidates: PromptCandidate[];
}
