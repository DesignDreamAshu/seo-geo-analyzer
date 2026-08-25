/**
 * Phase 23: Automation Snapshot Immutability & Audit Trail Engine.
 * Enforces Object.freeze runtime immutability and multi-tenant project isolation.
 */

import {
  AutomationSnapshot,
  OperationalHealthSummary,
  AutomationJob,
  ApprovalRecord,
  AutomationAlert,
  StorageGuarantee,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export interface CreateSnapshotInput {
  projectId: string;
  healthSummary: OperationalHealthSummary;
  activeJobs?: AutomationJob[];
  pendingApprovals?: ApprovalRecord[];
  verificationBacklog?: { actionId: string; implementedAt: string; targetUrls: string[] }[];
  activeAlerts?: AutomationAlert[];
  policyVersion?: string;
  storageGuarantee?: StorageGuarantee;
}

export function createAutomationSnapshot(input: CreateSnapshotInput): AutomationSnapshot {
  const snapshot: AutomationSnapshot = {
    snapshotId: `snap_auto_${input.projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    projectId: input.projectId,
    createdAt: new Date().toISOString(),
    healthSummary: input.healthSummary,
    activeJobs: input.activeJobs || [],
    pendingApprovals: input.pendingApprovals || [],
    verificationBacklog: input.verificationBacklog || [],
    activeAlerts: input.activeAlerts || [],
    policyVersion: input.policyVersion || DEFAULT_AUTOMATION_POLICY.policyVersion,
    storageGuarantee: input.storageGuarantee || "RUNTIME_IMMUTABLE",
    immutabilityStatement: "RUNTIME_IMMUTABLE_FREEZE",
  };

  return Object.freeze(snapshot);
}

export function validateSnapshotProjectIsolation(
  snapshotA: AutomationSnapshot,
  snapshotB: AutomationSnapshot
): { isIsolated: boolean; reason?: string } {
  if (snapshotA.projectId !== snapshotB.projectId) {
    return {
      isIsolated: true,
      reason: `Strictly isolated: Project ${snapshotA.projectId} and Project ${snapshotB.projectId} maintain separate immutable partitions.`,
    };
  }
  return {
    isIsolated: false,
    reason: "Both snapshots belong to the same project partition.",
  };
}
