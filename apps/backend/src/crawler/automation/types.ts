/**
 * Phase 23: SEO Automation, Continuous Optimization & Autonomous-But-Safe Operations Types.
 * Fully hardened for contextual policies, adapter capabilities, safe mode confidence, and storage truths.
 */

export type AutonomyMode =
  | "MANUAL_ONLY"
  | "MONITOR_ONLY"
  | "RECOMMEND_ONLY"
  | "AUTO_VERIFY"
  | "SAFE_AUTO_EXECUTE"
  | "APPROVAL_REQUIRED_EXECUTE";

export type NotificationPolicy =
  | "NONE"
  | "CRITICAL_ONLY"
  | "MATERIAL_CHANGES"
  | "ALL_ACTIONABLE"
  | "DIGEST_ONLY"
  | "CUSTOM";

export type AutomationUnit =
  | "PROJECT"
  | "SITE"
  | "PROPERTY"
  | "URL"
  | "URL_COHORT"
  | "TEMPLATE"
  | "ACTION"
  | "EXPERIMENT"
  | "DATA_SOURCE";

export type AutomationTrigger =
  | "SCHEDULED"
  | "EVENT_DRIVEN"
  | "THRESHOLD_CROSSED"
  | "DEPENDENCY_COMPLETED"
  | "ACTION_DUE"
  | "VERIFICATION_DUE"
  | "DATA_REFRESH_AVAILABLE"
  | "MANUAL_TRIGGER";

export type DataFreshnessState =
  | "FRESH"
  | "ACCEPTABLE"
  | "STALE"
  | "VERY_STALE"
  | "UNAVAILABLE"
  | "PROVIDER_ERROR";

export type DataCompletenessState =
  | "COMPLETE"
  | "PARTIAL"
  | "UNKNOWN";

export type ProviderType =
  | "GSC"
  | "SERP"
  | "BACKLINKS"
  | "CRUX"
  | "PAGESPEED"
  | "INDEXATION_PROVIDER"
  | "SERVER_LOGS"
  | "ANALYTICS"
  | "BUSINESS_METRICS";

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "PARTIALLY_SUCCEEDED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED"
  | "RETRY_SCHEDULED"
  | "DEAD_LETTERED";

export type RetryClassification =
  | "RETRYABLE"
  | "NON_RETRYABLE"
  | "RETRY_AFTER_PROVIDER_WINDOW"
  | "MANUAL_INTERVENTION_REQUIRED";

export type CircuitBreakerState =
  | "CLOSED"
  | "OPEN"
  | "HALF_OPEN";

export type ChangeMateriality =
  | "NO_MATERIAL_CHANGE"
  | "MINOR_CHANGE"
  | "MATERIAL_CHANGE"
  | "CRITICAL_CHANGE";

export type AlertLifecycleState =
  | "NEW"
  | "ONGOING"
  | "WORSENED"
  | "IMPROVED"
  | "RESOLVED"
  | "REOPENED";

export type ActionOperationalState =
  | "NOT_STARTED"
  | "READY"
  | "BLOCKED"
  | "APPROVAL_REQUIRED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "IMPLEMENTED_PENDING_VERIFICATION"
  | "VERIFIED"
  | "VERIFICATION_FAILED"
  | "ROLLED_BACK"
  | "CANCELLED";

export type VerificationTimingState =
  | "IMMEDIATE_TECHNICAL_VERIFICATION"
  | "DELAYED_SEARCH_PROVIDER_VERIFICATION"
  | "VERIFICATION_WAITING_FOR_PROPAGATION"
  | "DATA_NOT_READY";

export type VerificationResult =
  | "VERIFIED_FIXED"
  | "STILL_PRESENT"
  | "PARTIALLY_FIXED"
  | "REGRESSED"
  | "UNVERIFIABLE"
  | "DATA_NOT_READY"
  | "VERIFICATION_WAITING_FOR_PROPAGATION";

export type ExecutionRiskClass =
  | "AUTO_SAFE"
  | "APPROVAL_REQUIRED"
  | "MANUAL_ONLY"
  | "PROHIBITED_AUTOMATION";

export type BlastRadius =
  | "SINGLE_ELEMENT"
  | "SINGLE_URL"
  | "URL_COHORT"
  | "TEMPLATE"
  | "SITEWIDE";

export type SafeModeTriggerClass =
  | "TECHNICAL_CATASTROPHE"
  | "EXECUTION_ADAPTER_ANOMALY"
  | "MASS_UNEXPECTED_CHANGE"
  | "VERIFICATION_FAILURE_STORM"
  | "PROVIDER_CONFIDENCE_LOSS"
  | "MANUAL_TRIGGER";

export type SafeModeConfidence =
  | "SAFE_MODE_TRIGGER_CONFIRMED"
  | "SAFE_MODE_TRIGGER_PROBABLE"
  | "SAFE_MODE_TRIGGER_REVIEW"
  | "INSUFFICIENT_EVIDENCE";

export type SafeModeScope =
  | "NORMAL_OPERATION"
  | "PROJECT_MUTATIONS_PAUSED"
  | "ADAPTER_PAUSED"
  | "ACTION_CLASS_PAUSED"
  | "SITEWIDE_PAUSED"
  | "SAFE_MODE";

export type CanaryStatus =
  | "NOT_APPLICABLE"
  | "CANARY_RUNNING"
  | "CANARY_VERIFIED"
  | "CANARY_FAILED_STOPPED"
  | "FULL_ROLLOUT_COMPLETED";

export type AdapterCapability =
  | "READ"
  | "WRITE"
  | "DRY_RUN"
  | "VERSION_CHECK"
  | "ROLLBACK"
  | "ATOMIC_SINGLE_WRITE"
  | "ATOMIC_BATCH"
  | "PARTIAL_BATCH_RECOVERY"
  | "TEMPLATE_WRITE"
  | "PUBLISH_REQUIRED";

export type RollbackCapability =
  | "ROLLBACK_FULLY_SUPPORTED"
  | "ROLLBACK_BEST_EFFORT"
  | "ROLLBACK_MANUAL"
  | "ROLLBACK_UNAVAILABLE";

export type StorageGuarantee =
  | "RUNTIME_IMMUTABLE"
  | "APPEND_ONLY_APPLICATION_HISTORY"
  | "DURABLE_APPEND_ONLY_STORAGE"
  | "TAMPER_EVIDENT_LOG"
  | "EXTERNALLY_IMMUTABLE_STORAGE";

export type AtomicityState =
  | "ATOMIC"
  | "PARTIALLY_ATOMIC"
  | "NON_ATOMIC"
  | "UNKNOWN";

export type CostEstimationConfidence =
  | "ACTUAL"
  | "ESTIMATED"
  | "UNKNOWN"
  | "BUDGET_UNCONFIGURED";

export type ApprovalStatus =
  | "APPROVAL_ACTIVE"
  | "APPROVAL_REVOKED"
  | "APPROVAL_EXPIRED"
  | "APPROVAL_SCOPE_CHANGED";

export interface ProviderFreshnessRecord {
  provider: ProviderType;
  lastSuccessfulRefresh: string;
  dataLatencyHours: number;
  freshnessState: DataFreshnessState;
  completenessState: DataCompletenessState;
  quotaRemainingPercent: number;
  circuitState: CircuitBreakerState;
  failureCount: number;
  errorMessage?: string;
  policyUsed: string;
  thresholdUsedHours: number;
}

export interface AutomationJob {
  jobId: string;
  projectId: string;
  automationType: string;
  trigger: AutomationTrigger;
  unit: AutomationUnit;
  unitId?: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  status: JobStatus;
  idempotencyKey: string;
  dependsOnJobIds: string[];
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  retryClassification?: RetryClassification;
  policyVersion: string;
  inputSnapshotIds: string[];
  outputSnapshotIds: string[];
  errorMessage?: string;
  heartbeatAt?: string;
  progressPercent?: number;
  isStalled?: boolean;
  fencingToken: number;
  originalExecutionRef?: string;
}

export interface ApprovalRecord {
  approvalId: string;
  projectId: string;
  actionId: string;
  actionVersion: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  status: ApprovalStatus;
  approvedScope: BlastRadius;
  targetUrls: string[];
  mutationDigest: string;
  adapterName: string;
  policyVersion: string;
  policyUsed: string;
}

export interface ExecutionAuditRecord {
  executionId: string;
  projectId: string;
  actionId: string;
  actionVersion: string;
  riskClass: ExecutionRiskClass;
  blastRadius: BlastRadius;
  targetUrls: string[];
  adapterUsed: string;
  isDryRun: boolean;
  dryRunLabel: "PLANNED_MUTATION" | "EXECUTED_MUTATION";
  mutationEquivalenceGuaranteed: boolean;
  beforeStateDigest: string;
  afterStateDigest?: string;
  executedAt: string;
  executedBy: string;
  approvalId?: string;
  verificationStatus: VerificationResult;
  rollbackCapability: RollbackCapability;
  rollbackPlan?: string;
  isRolledBack: boolean;
  atomicity: AtomicityState;
  partialResults?: {
    succeededUrls: string[];
    failedUrls: string[];
  };
}

export interface RollbackRecord {
  rollbackId: string;
  projectId: string;
  executionId: string;
  actionId: string;
  initiatedBy: string;
  initiatedAt: string;
  reason: string;
  rollbackCapability: RollbackCapability;
  isSuccessful: boolean;
  verifiedAt?: string;
  verificationResult: VerificationResult;
}

export interface AutomationAlert {
  alertId: string;
  fingerprint: string;
  projectId: string;
  actionId?: string;
  issueCode: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  operationalUrgency: "HIGH" | "MEDIUM" | "LOW";
  lifecycleState: AlertLifecycleState;
  materiality: ChangeMateriality;
  affectedUrls: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  cooldownExpiresAt: string;
  isSuppressed: boolean;
  escalationReason?: string;
  assignedOwner?: string;
  policyUsed: string;
}

export interface OperationalHealthSummary {
  projectId: string;
  schedulerHealth: "HEALTHY" | "DEGRADED" | "CRITICAL";
  providerHealth: Record<ProviderType, { freshness: DataFreshnessState; completeness: DataCompletenessState }>;
  queueHealth: {
    queuedJobsCount: number;
    runningJobsCount: number;
    failedJobsCount: number;
    deadLetteredJobsCount: number;
  };
  automationCoverage: {
    automatedWorkflowsCount: number;
    monitoredWorkflowsCount: number;
    manualWorkflowsCount: number;
    blockedWorkflowsCount: number;
  };
  verificationBacklogCount: number;
  approvalBacklogCount: number;
  budgetStatus: {
    dailyCostSpent: number;
    dailyBudgetLimit?: number;
    costConfidence: CostEstimationConfidence;
    isBudgetExhausted: boolean;
  };
  safeModeState: SafeModeScope;
  safeModeConfidence?: SafeModeConfidence;
  safeModeTriggerClass?: SafeModeTriggerClass;
  safeModeReason?: string;
  storageGuarantee: StorageGuarantee;
  lastEvaluatedAt: string;
  policyVersion: string;
}

export interface ProjectAutomationPolicy {
  policyVersion: string;
  policyName: string;
  autonomyMode: AutonomyMode;
  notificationPolicy: NotificationPolicy;
  providerFreshnessHours: Record<ProviderType, { freshMax: number; acceptableMax: number; staleMax: number }>;
  scheduleFrequencies: {
    technicalCrawlDays: number;
    gscRefreshHours: number;
    serpRefreshDays: number;
    backlinkRefreshDays: number;
    cwvRefreshDays: number;
    indexationRefreshDays: number;
    actionVerificationHours: number;
    contentLifecycleDays: number;
  };
  allowlistedAutoSafeRemediations: string[];
  maxDailyBudgetUsd?: number;
  alertCooldownHours: number;
  approvalExpiryDays: number;
  maxRetryAttempts: number;
  circuitBreakerThresholds: Record<ProviderType, { failureThreshold: number; recoveryTimeMinutes: number }>;
  safeModeThresholds: {
    massUrlDisappearancePercentage: number;
    massUrlDisappearanceMinCount: number;
    mass404Percentage: number;
    mass404MinCount: number;
    consecutiveExecutionFailures: number;
  };
}

export interface AutomationSnapshot {
  snapshotId: string;
  projectId: string;
  createdAt: string;
  healthSummary: OperationalHealthSummary;
  activeJobs: AutomationJob[];
  pendingApprovals: ApprovalRecord[];
  verificationBacklog: { actionId: string; implementedAt: string; targetUrls: string[] }[];
  activeAlerts: AutomationAlert[];
  policyVersion: string;
  storageGuarantee: StorageGuarantee;
  immutabilityStatement: "RUNTIME_IMMUTABLE_FREEZE";
}
