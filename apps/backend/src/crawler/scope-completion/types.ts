import type { DiagnosticIssue, CrawledPageData } from "../types";
import type { SeoFixIntelligence, FixGroup } from "../fix-intelligence/types";

export type ScopeItemStatus =
  | "PASS"
  | "FAIL"
  | "PARTIAL"
  | "REVIEW_REQUIRED"
  | "NOT_EVALUATED"
  | "NOT_APPLICABLE";

export type ScopeTier =
  | "CORE_COMMITTED_BASIC"
  | "INCLUDED_QUICK_TECHNICAL"
  | "COMPLIMENTARY_ADVANCED"
  | "ADVANCED_RECOMMENDATION";

export type EvaluationMode =
  | "AUTOMATIC"
  | "HYBRID"
  | "MANUAL";

export type MappingType =
  | "FULL"
  | "PARTIAL"
  | "MANUAL"
  | "DETECTION_GAP";

export type DetectionGapAction =
  | "KEEP_MANUAL"
  | "ADD_SMALL_RULE_LATER"
  | "NOT_WORTH_AUTOMATING"
  | "EXTERNAL_DATA";

export type DetectionCapability =
  | "FULLY_MACHINE_VERIFIABLE"
  | "PARTIALLY_MACHINE_VERIFIABLE"
  | "MANUAL_QA"
  | "CURRENT_DETECTION_GAP"
  | "NOT_APPLICABLE";

export interface DetectionGapInfo {
  gapId: string;
  requirementTitle: string;
  scopeTier: ScopeTier;
  currentCapability: DetectionCapability;
  reasonIncomplete: string;
  importanceToCommitment: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: DetectionGapAction;
}

export interface SeoScopeItem {
  id: string;
  title: string;
  description: string;
  tier: ScopeTier;
  mappedRuleCodes: string[];
  mappingType: MappingType;
  evaluation: EvaluationMode;
  requiredForCompletion: boolean;
  weight?: number; // Defaults to 1.0
  notes?: string;
  detectionGap?: DetectionGapInfo;
  manualChecklistId?: string;
}

export interface ScopePreset {
  presetId: string;
  presetName: string;
  version: string;
  targetClient: string;
  description: string;
  items: SeoScopeItem[];
}

export interface ScopeItemResult {
  item: SeoScopeItem;
  status: ScopeItemStatus;
  sourceIssueIds: string[];
  affectedOccurrences: number; // Raw count of affected DOM elements/instances
  affectedCount: number; // Unique affected pages count
  affectedUrls: string[]; // Normalized list of unique affected URLs
  findings: DiagnosticIssue[];
  fixIntelligence: SeoFixIntelligence[];
  fixGroups: FixGroup[];
  estimatedChangesRemaining: number;
  explanation: string;
  manualReviewReason?: string;
  remediationWeight: number;
}

export interface ScopeTierSummary {
  tier: ScopeTier;
  totalItems: number;
  passedCount: number;
  failedCount: number;
  partialCount: number;
  reviewRequiredCount: number;
  notEvaluatedCount: number;
  notApplicableCount: number;
  detectionGapsCount: number;
  knownImplementationCompletionPercent: number;
  verifiedCompletionPercent: number;
  uniqueAffectedUrls: string[]; // Mathematical true union of affected URLs
  totalIssueOccurrences: number; // Total raw elements/instances
  uniqueRootCauseGroups: number;
  knownActualChangesRemaining: number;
  unknownChangesPendingReview: number;
}

export interface ManualQaChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tier: ScopeTier;
  status: "PENDING" | "APPROVED" | "FAILED" | "NOT_APPLICABLE";
  estimatedReviewEffort: string;
  estimatedChanges: number | "UNKNOWN";
  notes?: string;
  reviewer?: string;
  reviewedAt?: string;
}

export type DirectLinkVerificationStatus =
  | "SOURCE_PAGE_ACTIVE_LINK_VALID"
  | "SOURCE_PAGE_ACTIVE_LINK_BROKEN"
  | "SOURCE_PAGE_ACTIVE_LINK_NOT_PRESENT"
  | "SOURCE_PAGE_REDIRECTED"
  | "SOURCE_PAGE_404"
  | "SOURCE_PAGE_INCONCLUSIVE"
  | "CRAWL_DISCOVERY_GAP";

export interface SpecificLinkVerificationResult {
  requestedSourceUrl: string;
  targetUrl: string;
  anchorText: string;
  status: DirectLinkVerificationStatus;
  httpStatus?: number;
  finalUrl?: string;
  pageTitle?: string;
  targetAnchorFound: boolean;
  rawHref?: string;
  resolvedDestination?: string;
  evidence: string;
  notes: string;
}

export interface FastCompletionQueueItem {
  rank: number;
  scopeTier: ScopeTier;
  scopeItemId: string;
  scopeItemTitle: string;
  issueTitle: string;
  ruleCode: string;
  seoPriority: "critical" | "high" | "medium" | "low" | "informational";
  affectedOccurrences: number; // e.g. 112 images
  affectedCount: number; // e.g. 56 pages
  affectedUrls: string[];
  likelySharedCause?: string;
  likelyFixLocation: string;
  locationCertainty: "CONFIRMED" | "LIKELY" | "UNKNOWN";
  evidenceForLocation: string;
  estimatedActualChanges: number | "UNKNOWN_PENDING_REVIEW";
  effort: "quick" | "small" | "medium" | "large" | "editorial_review";
  safety: "SAFE" | "REVIEW_REQUIRED" | "HIGH_RISK";
  isManualReview: boolean;
  guaranteedTechnicalProgress?: {
    beforePercent: number;
    afterPercent: number;
    deltaPercent: number;
  };
  conditionalManualProgress?: {
    currentVerifiedPercent: number;
    potentialVerifiedPercentIfApproved: number;
    conditionalDeltaPercent: number;
  };
  fixInstructions: string[];
  verificationCriteria: string[];
}

export interface ClientSafeSummary {
  targetClient: string;
  generatedAt: string;
  overallScopeStatus: "COMPLETE" | "INCOMPLETE";
  coreBasicSeo: {
    knownImplementationPercent: number;
    verifiedCompletionPercent: number;
    confirmedPassCount: number;
    confirmedFailCount: number;
    pendingManualCount: number;
    detectionGapsCount: number;
    affectedUniquePages: number;
    knownChangesRemaining: number;
  };
  quickTechnical: {
    knownImplementationPercent: number;
    verifiedCompletionPercent: number;
    confirmedPassCount: number;
    confirmedFailCount: number;
    pendingManualGapsCount: number;
    affectedUniquePages: number;
    knownChangesRemaining: number;
  };
  complimentaryAdvanced: {
    knownImplementationPercent: number;
    confirmedPassCount: number;
    confirmedFailCount: number;
    affectedUniquePages: number;
    knownChangesRemaining: number;
  };
  overallAgreedWork: {
    knownImplementationPercent: number;
    verifiedCompletionPercent: number;
    uniqueAffectedUrls: number;
    totalIssueOccurrences: number;
    systemicRootCauses: number;
    estimatedKnownChanges: number;
    manualReviewsRemaining: number;
  };
  remainingWorkBreakdown: {
    category: string;
    affectedCount: number;
    summaryText: string;
  }[];
}

export interface ScopeEvaluationResult {
  runId: string;
  generatedAt: string;
  targetSite: string;
  preset: {
    presetId: string;
    presetName: string;
    version: string;
  };
  gateStatus: "BOT_BASIC_SEO_COMPLETE" | "BOT_BASIC_SEO_INCOMPLETE";
  metrics: {
    coreKnownImplementationPercent: number;
    coreVerifiedPercent: number;
    quickTechKnownImplementationPercent: number;
    quickTechVerifiedPercent: number;
    complimentaryKnownImplementationPercent: number;
    overallAgreedWorkImplementationPercent: number;
    overallAgreedWorkVerifiedPercent: number;
    manualReviewCoveragePercent: number;
    detectionCoveragePercent: number;
    coreUniqueAffectedUrls: number;
    quickTechUniqueAffectedUrls: number;
    complimentaryUniqueAffectedUrls: number;
    overallAgreedWorkUniqueAffectedUrls: number;
    totalIssueOccurrences: number;
    totalUniqueRootCauseGroups: number;
    estimatedKnownActualChanges: number;
    manualReviewsRemaining: number;
  };
  tierSummaries: Record<ScopeTier, ScopeTierSummary>;
  itemResults: ScopeItemResult[];
  manualQaChecklist: ManualQaChecklistItem[];
  specificLinkVerifications: SpecificLinkVerificationResult[];
  fastCompletionQueue: FastCompletionQueueItem[];
  detectionGaps: DetectionGapInfo[];
  clientSafeSummary: ClientSafeSummary;
}
