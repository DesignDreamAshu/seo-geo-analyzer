/**
 * Phase 10: SEO Monitoring, Regression Detection & Change Intelligence Types.
 * Strictly separates temporal state transitions and monitoring signals from underlying production SEO rules.
 */

import { PageClassType, RenderMode } from "../types";
import { PageGscMetrics } from "../gsc/types";
import { GeoAeoAuditResult } from "../ai-search/types";

// Baseline Status: Operational vs Architecture-Ready
export type OperationalBaselineType =
  | "PREVIOUS_SUCCESSFUL"
  | "LAST_VERIFIED"
  | "USER_PINNED";

export type ArchitectureReadyBaselineType =
  | "LAST_DEPLOYMENT"
  | "ROLLING_BASELINE"
  | "NONE";

export type BaselineType = OperationalBaselineType | ArchitectureReadyBaselineType;

export type ComparabilityStatus =
  | "COMPARABLE"
  | "PARTIALLY_COMPARABLE"
  | "NOT_COMPARABLE"
  | "MANUAL_REVIEW";

export type FindingLifecycleState =
  | "NEW"
  | "PERSISTING"
  | "RESOLVED"
  | "REOPENED"
  | "CHANGED"
  | "NEWLY_DETECTABLE"
  | "NOT_EVALUATED"
  | "BASELINE_UNAVAILABLE";

export type UrlLifecycleState =
  | "NEW_URL"
  | "EXISTING_URL"
  | "NO_LONGER_DISCOVERED"
  | "SITEMAP_REMOVED"
  | "ORPHAN_CANDIDATE"
  | "POSSIBLY_REMOVED"
  | "REMOVED_CONFIRMED"
  | "REDIRECTED_CONFIRMED"
  | "STATUS_CHANGED"
  | "CANONICAL_CHANGED"
  | "INDEXABILITY_CHANGED"
  | "NOT_EVALUATED";

export type RegressionPriority =
  | "CRITICAL_REGRESSION"
  | "HIGH_REGRESSION"
  | "MEDIUM_REGRESSION"
  | "LOW_REGRESSION"
  | "INFORMATIONAL_CHANGE";

export type AlertTier =
  | "ALERT_IMMEDIATE"
  | "ALERT_DIGEST"
  | "REPORT_ONLY"
  | "IGNORE_NOISE";

export type RuleSemanticStatus =
  | "RULE_UNCHANGED"
  | "RULE_NEW"
  | "RULE_SEMANTICS_CHANGED"
  | "RULE_REMOVED";

export type RootCauseConfidence =
  | "HIGH_CONFIDENCE"
  | "MEDIUM_CONFIDENCE"
  | "HEURISTIC";

export interface SnapshotDiagnosticFinding {
  ruleCode: string; // MUST be one of the 95 certified production rules
  monitoringSignalCode?: string; // e.g. "OG_IMAGE_BECAME_MISSING", "CANONICAL_TARGET_CHANGED"
  url: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  evidence?: string;
  message?: string;
  targetElementSelector?: string;
  targetResourceUrl?: string;
  targetHref?: string;
  ruleSemanticVersion?: string; // e.g. "1.0.0"
  remediationBlueprint?: {
    summary?: string;
    targetElementSelector?: string;
  };
}

export interface SnapshotPageRecord {
  url?: string;
  normalizedUrl?: string;
  statusCode: number;
  isIndexable?: boolean;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  canonicalUrl?: string | null;
  ogImage?: string | null;
  ogImageFetchState?: string | null;
  schemaTypes?: string[];
  contentWordCount?: number;
  contentHash?: string;
  primaryClass?: PageClassType;
  inSitemap?: boolean;
  discoveredVia?: "sitemap" | "internal_link" | "seed" | "direct_probe";
  renderMode?: RenderMode;
  performanceScore?: number | null;
  lcpMs?: number | null;
  clsScore?: number | null;
  gscData?: PageGscMetrics | null;
  geoAeoResult?: GeoAeoAuditResult | null;
  labConfig?: {
    device: "mobile" | "desktop";
    throttling: string;
    viewport: string;
  };
}

export interface CrawlSnapshot {
  snapshotId: string;
  projectId: string;
  rootDomain: string;
  originUrl: string;
  startedAt?: string;
  completedAt?: string;
  crawlerVersion?: string;
  ruleSetVersion?: string;
  ruleSignatures?: Record<string, string>; // ruleCode -> ruleSemanticVersion
  productionRuleCount?: number;
  configurationFingerprint?: string;
  crawlScope?: "full_site" | "subpath" | "sample";
  isComplete: boolean;
  totalUrlsDiscovered?: number;
  totalUrlsEvaluated?: number;
  totalUrlsExcluded?: number;
  pages: Record<string, SnapshotPageRecord>;
  findings: SnapshotDiagnosticFinding[];
  robotsTxtContent?: string | null;
  sitemapUrls?: string[];
  isFinalized?: boolean;
  deploymentMetadata?: {
    deploymentId?: string;
    releaseId?: string;
    commitSha?: string;
    environment?: string;
    deployedAt?: string;
  };
}

export interface ComparabilityCheck {
  name: string;
  satisfied: boolean;
  details: string;
}

export interface ComparabilityReport {
  status: ComparabilityStatus;
  isComparable: boolean;
  checks: ComparabilityCheck[];
  reasons: string[];
  limitations: string[];
}

export interface FindingChangeRecord {
  stableFindingKey: string;
  ruleCode: string;
  monitoringSignalCode: string;
  url: string;
  lifecycle: FindingLifecycleState;
  technicalSeverity: "critical" | "high" | "medium" | "low" | "info";
  regressionPriority: RegressionPriority;
  firstSeenSnapshotId: string;
  lastSeenSnapshotId: string;
  recurrenceCount: number;
  previousEvidence: string | null;
  currentEvidence: string | null;
  remediationSummary: string;
  rootCauseGroup?: string;
  templateScope?: string;
  gscImpactSummary?: string;
}

export interface SystemicRegressionGroup {
  groupId: string;
  ruleCode: string;
  monitoringSignalCode: string;
  title: string;
  rootCauseHypothesis: string;
  rootCauseConfidence: RootCauseConfidence;
  groupingEvidence: {
    affectedUrlsCount: number;
    routePattern: string;
    sharedStructuralSignal: string;
  };
  templateOrRoutePattern: string;
  affectedUrls: string[];
  affectedUrlsCount: number;
  estimatedRealEdits: number;
  regressionPriority: RegressionPriority;
  firstObservedSnapshotId: string;
  remediationGuidance: string;
  whereToFix: string;
  verificationInstructions: string;
}

export interface DirectUrlProbe {
  url: string;
  statusCode: number;
  redirectTarget?: string | null;
}

export interface PageChangeRecord {
  url: string;
  lifecycle: UrlLifecycleState;
  statusCodeChange?: { previous: number; current: number };
  indexabilityChange?: { previous: boolean; current: boolean };
  titleChange?: { previous: string | null; current: string | null };
  h1Change?: { previous: string | null; current: string | null };
  canonicalChange?: { previous: string | null; current: string | null };
  ogImageChange?: { previous: string | null; current: string | null; fetchStateChange?: string };
  schemaTypesChange?: { added: string[]; removed: string[] };
  contentLossDetected?: boolean;
  performanceRegression?: {
    metric: "LCP" | "CLS" | "INP" | "SCORE";
    previous: number | string;
    current: number | string;
    type: "FIELD_REGRESSION" | "LAB_REGRESSION" | "PERFORMANCE_COMPARISON_INCONCLUSIVE";
  };
  gscTrendCorrelation?: {
    query?: string;
    clicksDelta?: number;
    impressionsDelta?: number;
    correlationNote: string;
  };
  geoAeoChanges?: {
    crawlerAccessChanges?: string[];
    answerCandidateChange?: string;
    entityConsistencyChange?: string;
    isTrainingPolicyChangeOnly?: boolean;
  };
}

export interface ChangeBurstReport {
  isChangeBurst: boolean;
  totalNewFindings: number;
  burstThreshold: number;
  burstStatus: "NORMAL_VARIATION" | "CHANGE_BURST_REVIEW" | "SUPPRESSED_CRAWL_INCOMPLETE" | "NEW_RULESET_BURST";
  probableCauses: string[];
}

export interface MonitoringAuditResult {
  currentSnapshotId: string;
  baselineSnapshotId: string | null;
  baselineType: BaselineType;
  baselineSupportStatus: "OPERATIONAL" | "ARCHITECTURE_READY";
  comparedAt: string;
  comparability: ComparabilityReport;
  summary: {
    totalUrlsCurrent: number;
    totalUrlsBaseline: number;
    totalNewRegressions: number;
    totalChangedFindings: number;
    totalReopenedRegressions: number;
    totalPersistingFindings: number;
    totalResolvedFindings: number;
    totalNewlyDetectable: number;
    totalSystemicGroups: number;
    criticalAlertsCount: number;
  };
  systemicRegressions: SystemicRegressionGroup[];
  findingChanges: FindingChangeRecord[];
  pageChanges: PageChangeRecord[];
  changeBurst: ChangeBurstReport;
  alertTier: AlertTier;
  alertSummary: string[];
}
