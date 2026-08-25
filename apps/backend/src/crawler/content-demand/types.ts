/**
 * Phase 12: Content & Search Demand Intelligence Types.
 * Hardened data contracts supporting durable cluster identity, version safety,
 * configurable demand scale policies, and business validation safeguards.
 */

import { GscDataQuality } from "../opportunity/types";
import { DemandScalePolicy } from "./config";

export type QueryIntent =
  | "INFORMATIONAL"
  | "COMMERCIAL_INVESTIGATION"
  | "TRANSACTIONAL"
  | "NAVIGATIONAL"
  | "LOCAL"
  | "COMPARISON"
  | "SUPPORT"
  | "BRANDED"
  | "MIXED"
  | "UNKNOWN";

export type LandingPageFit =
  | "STRONG_FIT"
  | "PARTIAL_FIT"
  | "WEAK_FIT"
  | "MISMATCH"
  | "UNKNOWN";

export type QueryPageStability =
  | "STABLE"
  | "MULTI_PAGE"
  | "SWITCHING"
  | "INSUFFICIENT_DATA"
  | "INCONCLUSIVE";

export type DemandCoverageState =
  | "WELL_SERVED"
  | "PARTIALLY_SERVED"
  | "WEAKLY_SERVED"
  | "UNSERVED_CANDIDATE"
  | "UNKNOWN";

export type ContentDecision =
  | "IMPROVE_EXISTING_PAGE"
  | "CREATE_NEW_PAGE_CANDIDATE"
  | "CONSOLIDATE_EXISTING_PAGES"
  | "INTERNAL_LINK_EXISTING_PAGE"
  | "NO_ACTION"
  | "MANUAL_REVIEW"
  | "VALIDATION_REQUIRED";

export type CannibalizationState =
  | "HEALTHY_MULTI_PAGE_VISIBILITY"
  | "CANNIBALIZATION_CANDIDATE"
  | "LIKELY_CANNIBALIZATION"
  | "QUERY_INTENT_SPLIT"
  | "INSUFFICIENT_DATA"
  | "TOPIC_OVERLAP_ONLY";

export type DemandTrendState =
  | "EMERGING_DEMAND"
  | "GROWING_DEMAND"
  | "STABLE_DEMAND"
  | "DECLINING_DEMAND"
  | "INSUFFICIENT_DATA";

export type BrandState =
  | "BRANDED"
  | "NON_BRANDED"
  | "AMBIGUOUS";

export type ClusterLifecycleState =
  | "CLUSTER_UNCHANGED"
  | "CLUSTER_MEMBERSHIP_CHANGED"
  | "CLUSTER_SPLIT"
  | "CLUSTER_MERGED"
  | "CLUSTER_SEMANTICS_CHANGED";

export type GscRetrievalStatus =
  | "QUERY_DATA_COMPLETE_TO_AVAILABLE_API_RESULT"
  | "PARTIAL_QUERY_DATA"
  | "RETRIEVAL_LIMIT_REACHED";

export interface NormalizedQueryRecord {
  queryId: string;
  rawQuery: string;
  normalizedQuery: string;
  semanticTokens: string[];
  clusterId?: string;
  intents: QueryIntent[];
  brandState: BrandState;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  landingPages: Array<{ url: string; impressions: number; clicks: number; position: number }>;
  periodRange?: string;
  dataQuality: GscDataQuality;
}

export interface QueryCluster {
  clusterId: string;
  semanticFingerprint: string;
  representativeLabel: string;
  rawQueries: string[];
  totalObservedImpressions: number;
  totalClicks: number;
  averageCtr: number;
  averagePosition: number;
  landingPages: string[];
  dominantLandingPage?: string;
  primaryIntent: QueryIntent;
  allIntents: QueryIntent[];
  intentConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  clusteringConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "MANUAL_REVIEW";
  clusteringAlgorithmVersion: string;
  lifecycleState: ClusterLifecycleState;
  brandState: BrandState;
  modifiers: string[];
  isQuestionDemand: boolean;
  isComparisonDemand: boolean;
  isCommercialDemand: boolean;
}

export interface ContentCoverageAssessment {
  clusterId: string;
  representativeLabel: string;
  observedImpressions: number;
  primaryIntent: QueryIntent;
  dominantLandingPage?: string;
  landingPageFit: LandingPageFit;
  landingPageFitConfidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  queryPageStability: QueryPageStability;
  coverageState: DemandCoverageState;
  decision: ContentDecision;
  decisionRationale: string;
  isBusinessRelevanceValidated: boolean;
  missingTopicAreas?: string[];
  existingCandidateUrls: string[];
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "MANUAL_REVIEW";
  technicalBlockers?: string[];
}

export interface CannibalizationAssessment {
  clusterId: string;
  representativeLabel: string;
  competingUrls: string[];
  state: CannibalizationState;
  intentSimilarity: "HIGH" | "MEDIUM" | "LOW";
  contentOverlap: "HIGH" | "MEDIUM" | "LOW";
  hasStableDominantUrl: boolean;
  dominantUrl?: string;
  confidence: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";
  remediationRecommendation: "REVIEW_INTENT_DIFFERENTIATION" | "INTERNAL_LINK_TARGET_REVIEW" | "CONSOLIDATION_CANDIDATE" | "NO_ACTION";
  remediationDetails: string;
  rationale: string;
  protectAgainstMergingNote?: string;
}

export interface DemandTrendAssessment {
  clusterId: string;
  representativeLabel: string;
  trendState: DemandTrendState;
  currentPeriodImpressions: number;
  comparisonPeriodImpressions?: number;
  percentageChange?: number;
  isLowVolumeSample: boolean;
  rationale: string;
}

export interface ContentDemandIntelligenceReport {
  reportId: string;
  projectId: string;
  generatedAt: string;
  periodRange: string;
  dataQuality: GscDataQuality;
  retrievalStatus: GscRetrievalStatus;
  policyUsed: DemandScalePolicy;
  summary: {
    totalEvaluatedQueries: number;
    totalClusters: number;
    brandedClustersCount: number;
    nonBrandedClustersCount: number;
    totalObservedImpressions: number;
    totalClicks: number;
    improveExistingCount: number;
    createNewCandidateCount: number;
    cannibalizationCandidatesCount: number;
    emergingDemandCount: number;
    decliningDemandCount: number;
    questionDemandCount: number;
  };
  queryClusters: QueryCluster[];
  coverageAssessments: ContentCoverageAssessment[];
  cannibalizationAssessments: CannibalizationAssessment[];
  trendAssessments: DemandTrendAssessment[];
  dataLimitations: string[];
}
