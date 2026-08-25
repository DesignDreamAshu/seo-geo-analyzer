/**
 * Phase 23: Action Verification & Regression Reopening Engine.
 * Enforces Phase 11 canonical action authority, immediate vs delayed verification, and propagation safety.
 */

import {
  ActionOperationalState,
  VerificationResult,
  VerificationTimingState,
} from "./types";

export interface CanonicalActionContext {
  actionId: string;
  projectId: string;
  title: string;
  category: string;
  affectedUrls: string[];
  operationalState: ActionOperationalState;
  implementedAt?: string;
  verifiedAt?: string;
  verificationResult?: VerificationResult;
  verificationTiming?: VerificationTimingState;
  reopenCount: number;
  verificationHistory: {
    verifiedAt: string;
    result: VerificationResult;
    timing: VerificationTimingState;
    evidenceNotes: string;
    verifiedBy: "AUTOMATED_ENGINE" | "MANUAL_REVIEW";
  }[];
}

const actionStore = new Map<string, CanonicalActionContext>();

export function registerOrUpdateCanonicalAction(
  projectId: string,
  actionId: string,
  title: string,
  category: string,
  affectedUrls: string[]
): CanonicalActionContext {
  const key = `${projectId}::${actionId}`;
  let act = actionStore.get(key);

  if (!act) {
    act = {
      actionId,
      projectId,
      title,
      category,
      affectedUrls,
      operationalState: "NOT_STARTED",
      reopenCount: 0,
      verificationHistory: [],
    };
    actionStore.set(key, act);
  } else {
    act.affectedUrls = affectedUrls;
  }
  return act;
}

export function markActionImplementedPendingVerification(
  projectId: string,
  actionId: string,
  verificationTiming: VerificationTimingState = "IMMEDIATE_TECHNICAL_VERIFICATION"
): CanonicalActionContext {
  const key = `${projectId}::${actionId}`;
  const act = actionStore.get(key);
  if (!act) {
    throw new Error(`Cannot mark non-existent action ${actionId} as implemented.`);
  }

  // Critical Invariant: Marking implemented does NOT mark verified or resolved
  act.operationalState = "IMPLEMENTED_PENDING_VERIFICATION";
  act.implementedAt = new Date().toISOString();
  act.verificationTiming = verificationTiming;
  return act;
}

export interface VerificationEvidenceInput {
  actionId: string;
  projectId: string;
  isCrawlFindingPresent: boolean;
  isWaitingForCdnPropagation?: boolean;
  isTransientProbeFailure?: boolean;
  verificationTiming?: VerificationTimingState;
  evidenceNotes: string;
  verifiedBy?: "AUTOMATED_ENGINE" | "MANUAL_REVIEW";
}

export function verifyActionRemediation(input: VerificationEvidenceInput): {
  action: CanonicalActionContext;
  verificationResult: VerificationResult;
  isRegressionReopened: boolean;
} {
  const key = `${input.projectId}::${input.actionId}`;
  const act = actionStore.get(key);
  if (!act) {
    throw new Error(`Cannot verify non-existent action ${input.actionId}.`);
  }

  const now = new Date().toISOString();
  const timing = input.verificationTiming || act.verificationTiming || "IMMEDIATE_TECHNICAL_VERIFICATION";
  let result: VerificationResult = "UNVERIFIABLE";
  let isRegressionReopened = false;

  if (input.isWaitingForCdnPropagation) {
    result = "VERIFICATION_WAITING_FOR_PROPAGATION";
    act.operationalState = "IMPLEMENTED_PENDING_VERIFICATION";
  } else if (input.isTransientProbeFailure) {
    // Transient network/probe timeout -> Do not mark remediation failed
    result = "DATA_NOT_READY";
    act.operationalState = "IMPLEMENTED_PENDING_VERIFICATION";
  } else if (input.isCrawlFindingPresent) {
    if (act.operationalState === "VERIFIED") {
      // Previously verified fix has returned -> Reopen original action
      result = "REGRESSED";
      act.operationalState = "READY";
      act.reopenCount += 1;
      isRegressionReopened = true;
    } else {
      result = "STILL_PRESENT";
      act.operationalState = "VERIFICATION_FAILED";
    }
  } else {
    // Finding is absent in fresh crawl evidence
    result = "VERIFIED_FIXED";
    act.operationalState = "VERIFIED";
    act.verifiedAt = now;
  }

  act.verificationResult = result;
  act.verificationHistory.push({
    verifiedAt: now,
    result,
    timing,
    evidenceNotes: input.evidenceNotes,
    verifiedBy: input.verifiedBy || "AUTOMATED_ENGINE",
  });

  return {
    action: act,
    verificationResult: result,
    isRegressionReopened,
  };
}

export function getVerificationBacklog(projectId: string): CanonicalActionContext[] {
  return Array.from(actionStore.values()).filter(
    (a) => a.projectId === projectId && a.operationalState === "IMPLEMENTED_PENDING_VERIFICATION"
  );
}

export function resetActionStore(projectId?: string): void {
  if (projectId) {
    for (const [key, act] of actionStore.entries()) {
      if (act.projectId === projectId) actionStore.delete(key);
    }
  } else {
    actionStore.clear();
  }
}
