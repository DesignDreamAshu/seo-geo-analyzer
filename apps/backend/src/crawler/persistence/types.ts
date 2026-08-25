/**
 * Phase 24: Project Persistence, Audit History & Change Intelligence Types.
 * Defines repository abstractions, entity models, comparison structures, and storage contracts.
 */

export type StorageProviderType = "SQLITE" | "SUPABASE";

export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type AuditRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type AuditTriggerType =
  | "MANUAL"
  | "SCHEDULED"
  | "VERIFICATION"
  | "AUTOMATION"
  | "API";

export type FindingComparisonState =
  | "NEW"
  | "UNCHANGED"
  | "FIXED"
  | "REOPENED"
  | "CHANGED"
  | "SEVERITY_INCREASED"
  | "SEVERITY_DECREASED"
  | "NEWLY_EVALUATED"
  | "UNCOMPARABLE_BASELINE"
  | "UNCOMPARABLE_RULE_NOT_EVALUATED"
  | "UNCOMPARABLE_PAGE_UNAVAILABLE"
  | "UNCOMPARABLE_PAGE_NOT_EVALUATED"
  | "NOT_APPLICABLE"
  | "UNCOMPARABLE";

export type PageComparisonState =
  | "PAGE_NEW"
  | "PAGE_PRESENT"
  | "PAGE_REMOVED"
  | "PAGE_REDIRECTED"
  | "PAGE_CHANGED"
  | "PAGE_UNCOMPARABLE";

export type PageDisappearanceReason =
  | "INTENTIONALLY_REDIRECTED"
  | "INTENTIONALLY_REMOVED"
  | "NOT_FOUND_UNEXPECTEDLY"
  | "CRAWL_MISSED"
  | "CRAWL_FAILED"
  | "OUT_OF_SCOPE"
  | "UNKNOWN";

export type DatabaseHealthState =
  | "CONNECTED"
  | "READ_ONLY"
  | "LOCKED"
  | "CORRUPT"
  | "ERROR";

export interface ProjectEntity {
  projectId: string;
  name: string;
  primaryDomain: string;
  normalizedDomain: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  defaultCountry?: string;
  defaultDevice?: "MOBILE" | "DESKTOP";
  notes?: string;
  latestAuditRunId?: string;
  metadata?: Record<string, any>;
}

export interface RuleEvaluationContext {
  productionRuleCount: number;
  ruleInventoryVersion: string;
  evaluatedRuleIds: string[];
  disabledRuleIds?: string[];
  manualReviewRuleIds?: string[];
  policyDigest?: string;
}

export interface AuditRunConfigurationSnapshot {
  crawlSettings: {
    maxPages?: number;
    maxDepth?: number;
    userAgent?: string;
    respectRobotsTxt?: boolean;
    allowedDomains?: string[];
    includePatterns?: string[];
    excludePatterns?: string[];
    renderingMode?: "HTML_ONLY" | "PLAYWRIGHT_RENDERED";
  };
  countryContext?: string;
  deviceContext?: "MOBILE" | "DESKTOP";
  ruleInventoryVersion: string;
  productionRuleCount: number;
  crawlerVersion: string;
  policyVersions: Record<string, string>;
  ruleEvaluationContext?: RuleEvaluationContext;
  providerSettings?: Record<string, any>;
  experimentContext?: {
    experimentId: string;
    variant: "CONTROL" | "TREATMENT";
  };
  migrationContext?: {
    migrationId: string;
    phase: string;
  };
  verificationContext?: {
    actionId: string;
    sourceAuditRunId?: string;
  };
}

export interface AuditRunEntity {
  auditRunId: string;
  projectId: string;
  sequenceNumber: number; // Project-local sequence (Audit #1, Audit #2)
  startedAt: string;
  completedAt?: string;
  status: AuditRunStatus;
  trigger: AuditTriggerType;
  crawlerVersion: string;
  ruleInventoryVersion: string;
  productionRuleCount: number;
  policyVersions: string; // JSON string
  configurationSnapshot: AuditRunConfigurationSnapshot;
  createdAt: string;
  summaryStats?: {
    pagesCrawled: number;
    pagesIndexable: number;
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    informationalFindings: number;
    seoScore?: number;
  };
}

export interface AuditPageEntity {
  auditPageId: string;
  auditRunId: string;
  projectId: string;
  normalizedUrl: string;
  originalUrl: string;
  finalUrl: string;
  statusCode: number;
  indexability: "INDEXABLE" | "NON_INDEXABLE";
  canonicalUrl?: string;
  title?: string;
  metaDescription?: string;
  h1Summary?: string;
  contentHash?: string;
  templateIdentity?: string;
  crawlDepth: number;
  redirectChain?: string[];
  responseMetadata?: Record<string, any>;
  createdAt: string;
}

export interface AuditFindingEntity {
  auditFindingId: string;
  auditRunId: string;
  projectId: string;
  auditPageId?: string;
  ruleId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  findingState: "OPEN" | "FIXED" | "SUPPRESSED";
  message: string;
  evidence: Record<string, any>;
  normalizedUrl: string;
  findingFingerprint: string;
  targetResource?: string;
  createdAt: string;
}

export interface AuditMetricEntity {
  metricId: string;
  auditRunId: string;
  projectId: string;
  pagesCrawled: number;
  pagesIndexable: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  informationalCount: number;
  seoScore?: number;
  categoryScores?: Record<string, number>;
  createdAt: string;
}

export interface FindingDiffItem {
  findingFingerprint: string;
  ruleId: string;
  normalizedUrl: string;
  previousSeverity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  currentSeverity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  comparisonState: FindingComparisonState;
  previousEvidence?: Record<string, any>;
  currentEvidence?: Record<string, any>;
  changeReason?: string;
  firstSeenAuditRunId: string;
  lastSeenAuditRunId: string;
  reopenCount: number;
}

export interface RuleComparisonSummary {
  ruleId: string;
  previousAffectedPagesCount: number;
  currentAffectedPagesCount: number;
  difference: number;
  fixedCount: number;
  newCount: number;
  unchangedCount: number;
  reopenedCount: number;
  changedCount: number;
  uncomparableCount?: number;
}

export interface PageDiffItem {
  normalizedUrl: string;
  originalUrl: string;
  previousStatusCode?: number;
  currentStatusCode?: number;
  comparisonState: PageComparisonState;
  disappearanceReason?: PageDisappearanceReason;
  details?: string;
}

export interface ScoreDriverItem {
  ruleId: string;
  ruleTitle: string;
  penaltyDelta: number;
  scoreImpact: number;
  previousPenalty: number;
  currentPenalty: number;
  explanation: string;
}

export interface AuditComparisonResult {
  comparisonId: string;
  projectId: string;
  baselineAuditRunId: string;
  currentAuditRunId: string;
  baselineSequenceNumber: number;
  currentSequenceNumber: number;
  computedAt: string;
  comparisonEngineVersion: string;
  previousIssueCount: number;
  currentIssueCount: number;
  fixedCount: number;
  newCount: number;
  unchangedCount: number;
  reopenedCount: number;
  changedCount: number;
  severityIncreasedCount: number;
  severityDecreasedCount: number;
  uncomparableCount: number;
  pageChanges: PageDiffItem[];
  ruleSummaries: RuleComparisonSummary[];
  findingDiffs: FindingDiffItem[];
  metricChanges: {
    pagesCrawledDelta: number;
    scoreDelta?: number;
    scoreDrivers?: ScoreDriverItem[];
  };
  coverageQuality?: "FULLY_COMPARABLE" | "PARTIALLY_COMPARABLE" | "INSUFFICIENT_COVERAGE";
  coverageWarning?: string;
  scoreComparisonNotice?: string;
}

export interface AuditSnapshotEntity {
  snapshotId: string;
  auditRunId: string;
  projectId: string;
  createdAt: string;
  payloadJson: string;
  immutabilityStatement: "RUNTIME_IMMUTABLE_FREEZE";
}

// ----------------------------------------------------
// REPOSITORY INTERFACES (Storage Abstraction)
// ----------------------------------------------------

export interface ProjectRepository {
  createProject(project: Omit<ProjectEntity, "createdAt" | "updatedAt">): Promise<ProjectEntity>;
  getProjectById(projectId: string): Promise<ProjectEntity | null>;
  getProjectByDomain(normalizedDomain: string): Promise<ProjectEntity | null>;
  listProjects(status?: ProjectStatus, limit?: number, offset?: number): Promise<ProjectEntity[]>;
  updateProject(projectId: string, updates: Partial<ProjectEntity>): Promise<ProjectEntity>;
  archiveProject(projectId: string): Promise<boolean>;
}

export interface AuditRunRepository {
  createAuditRun(run: Omit<AuditRunEntity, "createdAt">): Promise<AuditRunEntity>;
  getAuditRunById(auditRunId: string): Promise<AuditRunEntity | null>;
  getLatestAuditRunForProject(projectId: string): Promise<AuditRunEntity | null>;
  listAuditRunsForProject(projectId: string, limit?: number, offset?: number): Promise<AuditRunEntity[]>;
  updateAuditRunStatus(
    auditRunId: string,
    status: AuditRunStatus,
    completedAt?: string,
    summaryStats?: AuditRunEntity["summaryStats"]
  ): Promise<AuditRunEntity>;
  getNextSequenceNumber(projectId: string): Promise<number>;
}

export interface AuditPageRepository {
  batchInsertPages(pages: AuditPageEntity[]): Promise<void>;
  getPagesForAuditRun(auditRunId: string, limit?: number, offset?: number): Promise<AuditPageEntity[]>;
  getPageByUrl(auditRunId: string, normalizedUrl: string): Promise<AuditPageEntity | null>;
  getPageHistory(projectId: string, normalizedUrl: string): Promise<AuditPageEntity[]>;
}

export interface AuditFindingRepository {
  batchInsertFindings(findings: AuditFindingEntity[]): Promise<void>;
  getFindingsForAuditRun(auditRunId: string, limit?: number, offset?: number): Promise<AuditFindingEntity[]>;
  getFindingByFingerprint(auditRunId: string, findingFingerprint: string): Promise<AuditFindingEntity | null>;
  getFindingHistory(projectId: string, findingFingerprint: string): Promise<AuditFindingEntity[]>;
  listHistoricalFindingsForFingerprints(projectId: string, fingerprints: string[]): Promise<AuditFindingEntity[]>;
}

export interface AuditMetricRepository {
  saveMetrics(metrics: AuditMetricEntity): Promise<AuditMetricEntity>;
  getMetricsForAuditRun(auditRunId: string): Promise<AuditMetricEntity | null>;
  getMetricHistory(projectId: string, limit?: number): Promise<AuditMetricEntity[]>;
}

export interface AuditComparisonRepository {
  saveComparison(comparison: AuditComparisonResult): Promise<AuditComparisonResult>;
  getComparison(baselineAuditRunId: string, currentAuditRunId: string): Promise<AuditComparisonResult | null>;
  listComparisonsForProject(projectId: string, limit?: number): Promise<AuditComparisonResult[]>;
}

export interface AuditSnapshotRepository {
  saveSnapshot(snapshot: AuditSnapshotEntity): Promise<AuditSnapshotEntity>;
  getSnapshot(auditRunId: string): Promise<AuditSnapshotEntity | null>;
}
