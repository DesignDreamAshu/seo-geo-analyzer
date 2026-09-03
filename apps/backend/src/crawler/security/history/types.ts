/**
 * Security S7: History, Persistence, Lifecycle, Comparison & Verification Types.
 */

import type {
  SecurityAuditViewModel,
  SecurityPosture,
  SecurityCategoryPosture,
  SecurityAuditCapabilities,
  SanitizedSecurityTxtFact,
} from "../scoring/score-types";
import type { SecurityFinding } from "../rule-types";

export type SecurityFindingLifecycleState =
  | "NEW"
  | "PERSISTING"
  | "RESOLVED"
  | "REOPENED"
  | "UNABLE_TO_CONFIRM_RESOLUTION";

export type SecurityComparisonCoverageState =
  | "FULLY_COMPARABLE"
  | "PARTIALLY_COMPARABLE"
  | "NOT_COMPARABLE";

export type SecurityVerificationMethod =
  | "RE_FETCH_HTTPS"
  | "RE_CRAWL_PAGE"
  | "SAFE_PROBE"
  | "DNS_QUERY"
  | "TLS_HANDSHAKE"
  | "MANUAL_ONLY";

export type SecurityVerificationResultState =
  | "RESOLVED"
  | "PARTIALLY_RESOLVED"
  | "STILL_PRESENT"
  | "UNABLE_TO_VERIFY";

export interface SecurityAuditSnapshotEntity {
  snapshotId: string;
  auditRunId: string;
  projectId: string;
  domain: string;
  startedAt: string;
  completedAt?: string | null;

  securitySchemaVersion: string;
  ruleCatalogVersion: string;
  scorePolicyVersion: string;
  remediationContractVersion: string;

  score: number;
  postureBand: SecurityPosture;

  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  informationalCount: number;
  manualAreasCount: number;

  testsExecuted: number;
  passedControls: number;
  totalRulesRegistered: number;

  requestedCrawlLimit?: number | null;
  discoveredPageCount?: number | null;
  actualCrawledPageCount?: number | null;
  isPartialAudit: boolean;

  payload: SecurityAuditViewModel;
  createdAt: string;
}

export interface SecurityVerificationEventEntity {
  eventId: string;
  projectId: string;
  sourceAuditId: string;
  findingId: string;
  ruleId: string;
  targetUrl?: string | null;
  startedAt: string;
  completedAt: string;
  method: SecurityVerificationMethod;
  scope: string;
  result: SecurityVerificationResultState;
  evidenceSummary: string;
  errorMessage?: string | null;
  createdAt: string;
}

export interface HistoricalFindingLifecycleItem {
  findingId: string;
  ruleId: string;
  title: string;
  category: string;
  severity: string;
  scope: string;
  targetResource?: string | null;
  lifecycleState: SecurityFindingLifecycleState;
  baselineFinding?: SecurityFinding | null;
  currentFinding?: SecurityFinding | null;
  resolutionReason?: string | null;
  reopenReason?: string | null;
  unableToConfirmReason?: string | null;
}

export interface SecurityCategoryComparisonItem {
  category: string;
  displayName: string;
  baselineHealth: SecurityCategoryPosture;
  currentHealth: SecurityCategoryPosture;
  healthChanged: boolean;
  isImprovement: boolean;
  isRegression: boolean;
  baselineFindingsCount: number;
  currentFindingsCount: number;
}

export interface SecurityCapabilityComparisonItem {
  capabilityKey: string;
  displayName: string;
  baselineStatus: string;
  currentStatus: string;
  statusChanged: boolean;
  explanation: string;
}

export interface ThirdPartyComparisonItem {
  origin: string;
  domain: string;
  status: "ADDED" | "REMOVED" | "PERSISTING";
  category?: string;
  scriptCount: number;
}

export interface SecurityComparisonViewModel {
  projectId: string;
  baselineAuditRunId: string;
  currentAuditRunId: string;
  baselineDate: string;
  currentDate: string;
  computedAt: string;

  comparability: {
    status: SecurityComparisonCoverageState;
    reason: string;
    isScopeReduced: boolean;
    baselinePagesCrawled: number;
    currentPagesCrawled: number;
    baselineRequestedCeiling?: number | null;
    currentRequestedCeiling?: number | null;
  };

  scoreComparison: {
    baselineScore: number;
    currentScore: number;
    scoreDelta: number | null;
    scorePolicyCompatible: boolean;
    scorePolicyMismatchNote?: string | null;
    baselinePosture: SecurityPosture;
    currentPosture: SecurityPosture;
  };

  severityDiff: {
    critical: { baseline: number; current: number; delta: number };
    high: { baseline: number; current: number; delta: number };
    medium: { baseline: number; current: number; delta: number };
    low: { baseline: number; current: number; delta: number };
    informational: { baseline: number; current: number; delta: number };
  };

  lifecycleSummary: {
    totalNew: number;
    totalPersisting: number;
    totalResolved: number;
    totalReopened: number;
    totalUnableToConfirm: number;
  };

  lifecycleFindings: HistoricalFindingLifecycleItem[];
  categoryComparisons: SecurityCategoryComparisonItem[];
  capabilityComparisons: SecurityCapabilityComparisonItem[];
  thirdPartyComparisons: ThirdPartyComparisonItem[];
}

export interface SecurityTimelineItem {
  snapshotId: string;
  auditRunId: string;
  projectId: string;
  completedAt: string;
  score: number;
  postureBand: SecurityPosture;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  testsExecuted: number;
  passedControls: number;
  actualCrawledPageCount?: number | null;
  isPartialAudit: boolean;
  scoreDeltaFromPrevious?: number | null;
  lifecycleFromPrevious?: {
    newCount: number;
    persistingCount: number;
    resolvedCount: number;
    reopenedCount: number;
  } | null;
}

export interface SecurityHistoryTimelineResponse {
  projectId: string;
  domain: string;
  isBaselineOnly: boolean;
  totalSecurityAudits: number;
  latestScore: number;
  latestPosture: SecurityPosture;
  previousScore?: number | null;
  scoreDelta?: number | null;
  historyTimeline: SecurityTimelineItem[];
  latestSnapshot?: SecurityAuditViewModel | null;
}
