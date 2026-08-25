/**
 * Content Lifecycle Snapshot Storage & Historical Comparability Engine.
 * Enforces runtime immutability and validates policy/model version comparability.
 */

import { ContentLifecycleSnapshot, ContentLifecycleInventorySummary, ContentLifecycleAssessment } from "./types";
import { DEFAULT_CONTENT_LIFECYCLE_POLICY } from "./config";

export function createLifecycleSnapshot(params: {
  snapshotId: string;
  projectId: string;
  inventorySummary: ContentLifecycleInventorySummary;
  assessments: ContentLifecycleAssessment[];
  modelVersion?: string;
  policyVersion?: string;
  thresholdPolicyVersion?: string;
  primaryUrlPolicyVersion?: string;
  freshnessPolicyVersion?: string;
  measurementPolicyVersion?: string;
}): ContentLifecycleSnapshot {
  const snapshot: ContentLifecycleSnapshot = {
    snapshotId: params.snapshotId,
    projectId: params.projectId,
    capturedAt: new Date().toISOString(),
    modelVersion: params.modelVersion || DEFAULT_CONTENT_LIFECYCLE_POLICY.modelVersion,
    policyVersion: params.policyVersion || DEFAULT_CONTENT_LIFECYCLE_POLICY.policyVersion,
    thresholdPolicyVersion: params.thresholdPolicyVersion || "1.0.0",
    primaryUrlPolicyVersion: params.primaryUrlPolicyVersion || "1.0.0",
    freshnessPolicyVersion: params.freshnessPolicyVersion || "1.0.0",
    measurementPolicyVersion: params.measurementPolicyVersion || "1.0.0",
    totalUrlsCount: params.assessments.length,
    inventorySummary: params.inventorySummary,
    assessments: params.assessments,
    immutabilityGuarantee: "RUNTIME_IMMUTABLE",
  };

  // Enforce runtime immutability
  return Object.freeze(snapshot);
}

export function validateLifecycleSnapshotComparability(
  snap1: ContentLifecycleSnapshot,
  snap2: ContentLifecycleSnapshot
): { isComparable: boolean; reason?: string } {
  if (snap1.projectId !== snap2.projectId) {
    return { isComparable: false, reason: "PROJECT_MISMATCH" };
  }
  if (snap1.modelVersion !== snap2.modelVersion) {
    return { isComparable: false, reason: "LIFECYCLE_MODEL_VERSION_CHANGED" };
  }
  if (snap1.policyVersion !== snap2.policyVersion) {
    return { isComparable: false, reason: "LIFECYCLE_POLICY_CHANGED" };
  }
  if (snap1.primaryUrlPolicyVersion !== snap2.primaryUrlPolicyVersion) {
    return { isComparable: false, reason: "PRIMARY_URL_POLICY_CHANGED" };
  }
  return { isComparable: true };
}
