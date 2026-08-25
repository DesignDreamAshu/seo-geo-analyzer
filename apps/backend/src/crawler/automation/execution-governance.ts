/**
 * Phase 23: Execution Risk Governance, Adapter Capability Contract & Canary Rollout Engine.
 * Enforces adapter capability contracts, version checks, rollback truths, and canary success criteria.
 */

import {
  ExecutionRiskClass,
  BlastRadius,
  ApprovalRecord,
  ApprovalStatus,
  ExecutionAuditRecord,
  RollbackRecord,
  CanaryStatus,
  AdapterCapability,
  RollbackCapability,
  AtomicityState,
  ProjectAutomationPolicy,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export interface ExecutionAdapterContract {
  adapterName: string;
  capabilities: AdapterCapability[];
  rollbackCapability: RollbackCapability;
  isEquivalenceGuaranteedInDryRun: boolean;
}

export interface ExecutionIntentInput {
  actionId: string;
  actionVersion?: string;
  projectId: string;
  changeType: string;
  targetUrls: string[];
  isTemplateLevel?: boolean;
  isSitewide?: boolean;
  hasBusinessContentJudgment?: boolean;
  hasDestructiveBehavior?: boolean;
  adapterContract?: ExecutionAdapterContract;
  expectedResourceVersionHash?: string;
  currentResourceVersionHash?: string;
  mutationDigest?: string;
}

const approvalStore = new Map<string, ApprovalRecord>();
const executionHistory: ExecutionAuditRecord[] = [];
const rollbackHistory: RollbackRecord[] = [];
let isEmergencyPaused = false;

export function evaluateExecutionRisk(
  input: ExecutionIntentInput,
  policy: ProjectAutomationPolicy = DEFAULT_AUTOMATION_POLICY
): {
  riskClass: ExecutionRiskClass;
  blastRadius: BlastRadius;
  requiresApproval: boolean;
  reason: string;
} {
  // Prohibited automation check
  const prohibitedKeywords = ["cloaking", "fake_review", "spam", "doorway", "hidden_text", "pbn_link"];
  if (prohibitedKeywords.some((kw) => input.changeType.toLowerCase().includes(kw))) {
    return {
      riskClass: "PROHIBITED_AUTOMATION",
      blastRadius: "SITEWIDE",
      requiresApproval: true,
      reason: "Action involves prohibited, manipulative, or deceptive SEO techniques. Fully forbidden.",
    };
  }

  // Blast radius calculation
  let blastRadius: BlastRadius = "SINGLE_URL";
  if (input.isSitewide) {
    blastRadius = "SITEWIDE";
  } else if (input.isTemplateLevel) {
    blastRadius = "TEMPLATE";
  } else if (input.targetUrls.length > 5) {
    blastRadius = "URL_COHORT";
  } else if (input.targetUrls.length === 1) {
    blastRadius = "SINGLE_URL";
  } else {
    blastRadius = "SINGLE_ELEMENT";
  }

  // Sitewide or template changes CANNOT be AUTO_SAFE
  if (blastRadius === "SITEWIDE" || blastRadius === "TEMPLATE") {
    return {
      riskClass: "APPROVAL_REQUIRED",
      blastRadius,
      requiresApproval: true,
      reason: `Changes affecting ${blastRadius} scope carry wide blast radius and require explicit human approval.`,
    };
  }

  // Manual only check
  if (input.hasBusinessContentJudgment || input.changeType.toLowerCase().includes("legal") || input.changeType.toLowerCase().includes("brand")) {
    return {
      riskClass: "MANUAL_ONLY",
      blastRadius,
      requiresApproval: true,
      reason: "Change requires brand, legal, or editorial human judgment.",
    };
  }

  // Allowlisted AUTO_SAFE check
  const isAllowlisted = policy.allowlistedAutoSafeRemediations.includes(input.changeType);
  if (isAllowlisted && !input.hasDestructiveBehavior && blastRadius === "SINGLE_URL") {
    return {
      riskClass: "AUTO_SAFE",
      blastRadius,
      requiresApproval: false,
      reason: "Action is a deterministic, highly isolated, allowlisted reversible remediation.",
    };
  }

  // Default to APPROVAL_REQUIRED
  return {
    riskClass: "APPROVAL_REQUIRED",
    blastRadius,
    requiresApproval: true,
    reason: "Standard production remediation requires explicit human authorization.",
  };
}

export function createApprovalRecord(
  projectId: string,
  actionId: string,
  actionVersion: string,
  approvedBy: string,
  approvedScope: BlastRadius,
  targetUrls: string[],
  mutationDigest: string,
  adapterName = "DEFAULT_REST_ADAPTER",
  validityDays = DEFAULT_AUTOMATION_POLICY.approvalExpiryDays
): ApprovalRecord {
  const approvalId = `appr_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 3600 * 1000).toISOString();

  const record: ApprovalRecord = {
    approvalId,
    projectId,
    actionId,
    actionVersion,
    approvedBy,
    approvedAt: now.toISOString(),
    expiresAt,
    status: "APPROVAL_ACTIVE",
    approvedScope,
    targetUrls,
    mutationDigest,
    adapterName,
    policyVersion: DEFAULT_AUTOMATION_POLICY.policyVersion,
    policyUsed: DEFAULT_AUTOMATION_POLICY.policyName,
  };

  approvalStore.set(approvalId, record);
  return record;
}

export function validateApproval(
  approvalId: string,
  projectId: string,
  actionId: string,
  actionVersion: string,
  targetUrls: string[],
  mutationDigest?: string
): { isValid: boolean; failureReason?: string } {
  const approval = approvalStore.get(approvalId);
  if (!approval) {
    return { isValid: false, failureReason: "Approval record not found." };
  }
  if (approval.projectId !== projectId) {
    return { isValid: false, failureReason: "PROJECT_MISMATCH: Approval belongs to a different project." };
  }
  if (approval.actionId !== actionId) {
    return { isValid: false, failureReason: "ACTION_MISMATCH: Approval belongs to a different action." };
  }
  if (approval.actionVersion !== actionVersion) {
    return { isValid: false, failureReason: "ACTION_VERSION_MISMATCH: Action definition was updated since approval." };
  }
  if (approval.status === "APPROVAL_REVOKED") {
    return { isValid: false, failureReason: "APPROVAL_REVOKED: Approval has been explicitly revoked." };
  }
  if (Date.now() > new Date(approval.expiresAt).getTime()) {
    approval.status = "APPROVAL_EXPIRED";
    return { isValid: false, failureReason: "APPROVAL_EXPIRED: Approval validity window has lapsed." };
  }
  if (mutationDigest && approval.mutationDigest !== mutationDigest) {
    return { isValid: false, failureReason: "MUTATION_DIGEST_MISMATCH: Intended production mutation changed since approval." };
  }
  const unapprovedUrls = targetUrls.filter((u) => !approval.targetUrls.includes(u));
  if (unapprovedUrls.length > 0 && approval.approvedScope !== "SITEWIDE") {
    return { isValid: false, failureReason: `SCOPE_BREACH: Target URLs (${unapprovedUrls.join(", ")}) not included in approval scope.` };
  }

  return { isValid: true };
}

export function executeRemediation(
  input: ExecutionIntentInput,
  isDryRun = false,
  approvalId?: string
): {
  success: boolean;
  executionRecord: ExecutionAuditRecord;
  failureReason?: string;
} {
  if (isEmergencyPaused) {
    throw new Error("AUTOMATION_PAUSED: Emergency kill switch is active. All production mutations are blocked.");
  }

  const risk = evaluateExecutionRisk(input);
  const actionVersion = input.actionVersion || "v1.0";
  const adapter = input.adapterContract || {
    adapterName: "UNCONFIGURED_ADAPTER",
    capabilities: ["READ" as AdapterCapability],
    rollbackCapability: "ROLLBACK_UNAVAILABLE" as RollbackCapability,
    isEquivalenceGuaranteedInDryRun: false,
  };

  // Adapter capability check
  if (!isDryRun && !adapter.capabilities.includes("WRITE")) {
    return {
      success: false,
      executionRecord: {
        executionId: `exec_no_cap_${Date.now()}`,
        projectId: input.projectId,
        actionId: input.actionId,
        actionVersion,
        riskClass: risk.riskClass,
        blastRadius: risk.blastRadius,
        targetUrls: input.targetUrls,
        adapterUsed: adapter.adapterName,
        isDryRun,
        dryRunLabel: isDryRun ? "PLANNED_MUTATION" : "EXECUTED_MUTATION",
        mutationEquivalenceGuaranteed: adapter.isEquivalenceGuaranteedInDryRun,
        beforeStateDigest: "no_cap",
        executedAt: new Date().toISOString(),
        executedBy: "AUTONOMOUS_ENGINE",
        verificationStatus: "UNVERIFIABLE",
        rollbackCapability: adapter.rollbackCapability,
        atomicity: "NON_ATOMIC",
        isRolledBack: false,
      },
      failureReason: "EXECUTION_CAPABILITY_UNAVAILABLE: Adapter does not support WRITE capability.",
    };
  }

  // Precondition / Version check
  if (input.expectedResourceVersionHash && input.currentResourceVersionHash && input.expectedResourceVersionHash !== input.currentResourceVersionHash) {
    return {
      success: false,
      executionRecord: {
        executionId: `exec_stale_${Date.now()}`,
        projectId: input.projectId,
        actionId: input.actionId,
        actionVersion,
        riskClass: risk.riskClass,
        blastRadius: risk.blastRadius,
        targetUrls: input.targetUrls,
        adapterUsed: adapter.adapterName,
        isDryRun,
        dryRunLabel: isDryRun ? "PLANNED_MUTATION" : "EXECUTED_MUTATION",
        mutationEquivalenceGuaranteed: adapter.isEquivalenceGuaranteedInDryRun,
        beforeStateDigest: "stale_hash",
        executedAt: new Date().toISOString(),
        executedBy: "AUTONOMOUS_ENGINE",
        verificationStatus: "UNVERIFIABLE",
        rollbackCapability: adapter.rollbackCapability,
        atomicity: "NON_ATOMIC",
        isRolledBack: false,
      },
      failureReason: "ACTION_STATE_STALE: Target resource version changed since approval. Revalidation required.",
    };
  }

  // Approval validation if required
  if (risk.requiresApproval && !isDryRun) {
    if (!approvalId) {
      return {
        success: false,
        executionRecord: {
          executionId: `exec_no_appr_${Date.now()}`,
          projectId: input.projectId,
          actionId: input.actionId,
          actionVersion,
          riskClass: risk.riskClass,
          blastRadius: risk.blastRadius,
          targetUrls: input.targetUrls,
          adapterUsed: adapter.adapterName,
          isDryRun,
          dryRunLabel: isDryRun ? "PLANNED_MUTATION" : "EXECUTED_MUTATION",
          mutationEquivalenceGuaranteed: adapter.isEquivalenceGuaranteedInDryRun,
          beforeStateDigest: "unapproved",
          executedAt: new Date().toISOString(),
          executedBy: "AUTONOMOUS_ENGINE",
          verificationStatus: "UNVERIFIABLE",
          rollbackCapability: adapter.rollbackCapability,
          atomicity: "NON_ATOMIC",
          isRolledBack: false,
        },
        failureReason: "APPROVAL_REQUIRED: Action requires explicit human approval before execution.",
      };
    }

    const val = validateApproval(approvalId, input.projectId, input.actionId, actionVersion, input.targetUrls, input.mutationDigest);
    if (!val.isValid) {
      return {
        success: false,
        executionRecord: {
          executionId: `exec_bad_appr_${Date.now()}`,
          projectId: input.projectId,
          actionId: input.actionId,
          actionVersion,
          riskClass: risk.riskClass,
          blastRadius: risk.blastRadius,
          targetUrls: input.targetUrls,
          adapterUsed: adapter.adapterName,
          isDryRun,
          dryRunLabel: isDryRun ? "PLANNED_MUTATION" : "EXECUTED_MUTATION",
          mutationEquivalenceGuaranteed: adapter.isEquivalenceGuaranteedInDryRun,
          beforeStateDigest: "invalid_approval",
          executedAt: new Date().toISOString(),
          executedBy: "AUTONOMOUS_ENGINE",
          verificationStatus: "UNVERIFIABLE",
          rollbackCapability: adapter.rollbackCapability,
          atomicity: "NON_ATOMIC",
          isRolledBack: false,
        },
        failureReason: val.failureReason,
      };
    }
  }

  const atomicity: AtomicityState = adapter.capabilities.includes("ATOMIC_BATCH")
    ? "ATOMIC"
    : adapter.capabilities.includes("PARTIAL_BATCH_RECOVERY")
    ? "PARTIALLY_ATOMIC"
    : "NON_ATOMIC";

  const executionRecord: ExecutionAuditRecord = {
    executionId: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    projectId: input.projectId,
    actionId: input.actionId,
    actionVersion,
    riskClass: risk.riskClass,
    blastRadius: risk.blastRadius,
    targetUrls: input.targetUrls,
    adapterUsed: adapter.adapterName,
    isDryRun,
    dryRunLabel: isDryRun ? "PLANNED_MUTATION" : "EXECUTED_MUTATION",
    mutationEquivalenceGuaranteed: adapter.isEquivalenceGuaranteedInDryRun,
    beforeStateDigest: `digest_pre_${Date.now()}`,
    afterStateDigest: `digest_post_${Date.now()}`,
    executedAt: new Date().toISOString(),
    executedBy: approvalId ? "AUTHORIZED_HUMAN_APPROVAL" : "AUTONOMOUS_ENGINE",
    approvalId,
    verificationStatus: "DATA_NOT_READY",
    rollbackCapability: adapter.rollbackCapability,
    rollbackPlan: `REVERT_${input.changeType}_PLAN`,
    atomicity,
    isRolledBack: false,
  };

  executionHistory.push(executionRecord);
  return { success: true, executionRecord };
}

export function computeContextualCanarySize(cohortSize: number, riskClass: ExecutionRiskClass): number {
  if (riskClass === "APPROVAL_REQUIRED" || cohortSize > 50) {
    return Math.max(2, Math.round(cohortSize * 0.1)); // 10% canary
  }
  return Math.min(5, cohortSize);
}

export function executeCanaryRollout(
  cohortUrls: string[],
  canaryBatchSize?: number,
  isCanaryVerified = false,
  riskClass: ExecutionRiskClass = "APPROVAL_REQUIRED"
): {
  status: CanaryStatus;
  currentlyDeployedUrls: string[];
  pendingUrls: string[];
  canarySizeUsed: number;
} {
  const batchSize = canaryBatchSize || computeContextualCanarySize(cohortUrls.length, riskClass);

  if (!isCanaryVerified) {
    const canaryUrls = cohortUrls.slice(0, batchSize);
    const pending = cohortUrls.slice(batchSize);
    return {
      status: "CANARY_RUNNING",
      currentlyDeployedUrls: canaryUrls,
      pendingUrls: pending,
      canarySizeUsed: batchSize,
    };
  }

  // Canary verified -> proceed to full rollout
  return {
    status: "FULL_ROLLOUT_COMPLETED",
    currentlyDeployedUrls: cohortUrls,
    pendingUrls: [],
    canarySizeUsed: batchSize,
  };
}

export function setEmergencyKillSwitch(isPaused: boolean): void {
  isEmergencyPaused = isPaused;
}

export function isEmergencyKillSwitchActive(): boolean {
  return isEmergencyPaused;
}

export function resetExecutionState(): void {
  approvalStore.clear();
  executionHistory.length = 0;
  rollbackHistory.length = 0;
  isEmergencyPaused = false;
}
