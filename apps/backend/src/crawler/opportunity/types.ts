/**
 * Phase 11: Hardened SEO Opportunity & Action Planning Types.
 */

export type SiteTrafficScale = "DEFAULT" | "B2B_NICHE" | "HIGH_VOLUME_PUBLISHER";

export interface TrafficPolicySelection {
  selectedPolicy: SiteTrafficScale;
  selectionSource: "PROJECT_CONFIGURED" | "DEFAULT_FALLBACK";
  thresholdsUsed: {
    highSearchDemandImpressions: number;
    moderateSearchDemandImpressions: number;
    lowVolumeSampleThreshold: number;
    quickWinMinImpressionsForSinglePage: number;
  };
}

export type OpportunityType =
  | "TECHNICAL_FIX"
  | "REGRESSION_FIX"
  | "INDEXABILITY_FIX"
  | "INTERNAL_LINKING_OPPORTUNITY"
  | "CTR_OPPORTUNITY"
  | "POSITION_OPPORTUNITY"
  | "DECLINING_PAGE_RECOVERY"
  | "CONTENT_REFRESH_OPPORTUNITY"
  | "CONTENT_STRUCTURE_OPPORTUNITY"
  | "PERFORMANCE_OPPORTUNITY"
  | "GEO_AEO_OPPORTUNITY"
  | "SYSTEMIC_TEMPLATE_FIX"
  | "MANUAL_REVIEW"
  | "VALIDATION_REQUIRED";

export type ActionPriority =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "REVIEW";

export type ImplementationEffort =
  | "TRIVIAL"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "UNKNOWN";

export type ActionOwner =
  | "Developer"
  | "SEO"
  | "Content"
  | "CMS Editor"
  | "Designer"
  | "Analytics"
  | "Client"
  | "Manual Review";

export type TimelineBucket =
  | "DO_NOW"
  | "DO_NEXT"
  | "LATER_OPTIMIZE";

export type ActionStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "VALIDATION_REQUIRED"
  | "IMPLEMENTATION_MARKED_COMPLETE"
  | "VERIFIED_RESOLVED"
  | "VALIDATION_FAILED"
  | "DISMISSED"
  | "NO_LONGER_APPLICABLE";

export type PageImportanceStatus =
  | "PAGE_IMPORTANCE_CONFIGURED"
  | "PAGE_IMPORTANCE_NOT_CONFIGURED";

export type GscDataQuality =
  | "FRESH_COMPLETE"
  | "STALE"
  | "PARTIAL_PERIOD"
  | "NOT_AVAILABLE"
  | "LOW_VOLUME_SAMPLE";

export type RecommendationNature =
  | "DETERMINISTIC_FIX"
  | "CONTENT_RECOMMENDATION"
  | "REVIEW_RECOMMENDED";

export interface GscSearchExposure {
  totalImpressions: number;
  totalClicks: number;
  averageCtr: number;
  averagePosition: number;
  topQueries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
  evaluatedPeriodRange?: string; // e.g. "2026-07-20 to 2026-08-18"
  dataQuality: GscDataQuality;
  freshnessDate?: string;
}

export interface SeoActionItem {
  actionId: string;
  projectId: string;
  type: OpportunityType;
  title: string;
  description: string;
  nature: RecommendationNature;
  underlyingRuleCodes: string[]; // From 95 certified production rules
  monitoringSignals: string[];
  sourceSignals: string[];
  affectedUrls: string[];
  representativeUrls: string[];
  affectedUrlsCount: number;
  estimatedRealEdits: number;
  technicalSeverity: "critical" | "high" | "medium" | "low" | "info";
  actionPriority: ActionPriority;
  whyThisPriority: string[];
  effort: ImplementationEffort;
  effortRationale: string;
  primaryOwner: ActionOwner;
  secondaryOwners: ActionOwner[];
  owners: ActionOwner[];
  ownerRoutingConfidence: "CONFIRMED_OWNER" | "PRIMARY_AND_SECONDARY" | "INFERRED_DEFAULT";
  pageImportanceStatus: PageImportanceStatus;
  isWatchlistedPage?: boolean;
  gscExposure?: GscSearchExposure;
  isQuickWin: boolean;
  quickWinRationale?: string;
  timelineBucket: TimelineBucket;
  blockedByActionIds: string[];
  blockingActionIds: string[];
  rootCauseGroup?: string;
  rootCauseConfidence?: "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "HEURISTIC";
  whereToFix: string;
  recommendedAction: string;
  caution?: string;
  verificationInstructions: string;
  actionStatus: ActionStatus;
  statusHistory: Array<{ status: ActionStatus; timestamp: string; note?: string }>;
}

export interface TeamWorkQueue {
  owner: ActionOwner;
  actionCount: number;
  criticalCount: number;
  highCount: number;
  actions: SeoActionItem[];
}

export interface OpportunityPlanSummary {
  totalActions: number;
  doNowCount: number;
  doNextCount: number;
  laterOptimizeCount: number;
  criticalCount: number;
  highCount: number;
  quickWinsCount: number;
  systemicFixesCount: number;
  blockedCount: number;
  estimatedRealEditsTotal: number;
  totalAffectedUrlsTotal: number;
  totalSearchExposureImpressions: number;
}

export interface SeoOpportunityPlan {
  planId: string;
  projectId: string;
  generatedAt: string;
  trafficPolicy: TrafficPolicySelection;
  summary: OpportunityPlanSummary;
  eightyTwentySummary: {
    topActionCount: number;
    estimatedEdits: number;
    affectedUrls: number;
    gscImpressionsCovered: number;
    addressedRawFindings: number;
  };
  doNowActions: SeoActionItem[];
  doNextActions: SeoActionItem[];
  laterOptimizeActions: SeoActionItem[];
  quickWins: SeoActionItem[];
  systemicFixes: SeoActionItem[];
  teamQueues: Record<ActionOwner, TeamWorkQueue>;
  allActions: SeoActionItem[];
}
