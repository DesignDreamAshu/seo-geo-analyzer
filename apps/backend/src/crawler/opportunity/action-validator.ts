/**
 * Action State Machine & Validation Engine.
 * Manages valid status transitions, audit history, and crawl-verified resolution.
 */

import { ActionStatus, SeoActionItem } from "./types";
import { CrawlSnapshot } from "../monitoring/types";
import { buildStableFindingIdentity } from "../monitoring/finding-identity";

export class InvalidStateTransitionError extends Error {
  constructor(fromStatus: ActionStatus, toStatus: ActionStatus, reason: string) {
    super(`Invalid Action Status Transition from '${fromStatus}' to '${toStatus}': ${reason}`);
    this.name = "InvalidStateTransitionError";
  }
}

export function transitionActionStatus(
  action: SeoActionItem,
  toStatus: ActionStatus,
  note?: string,
  evidence?: { verifiedByRecrawl?: boolean }
): SeoActionItem {
  const fromStatus = action.actionStatus;

  // 1. Same Status No-Op
  if (fromStatus === toStatus) {
    return action;
  }

  // 2. State Machine Transition Rules
  if (toStatus === "VERIFIED_RESOLVED" && !evidence?.verifiedByRecrawl) {
    throw new InvalidStateTransitionError(
      fromStatus,
      toStatus,
      "Cannot transition directly to VERIFIED_RESOLVED without positive recrawl verification evidence."
    );
  }

  if (toStatus === "NO_LONGER_APPLICABLE" && (!note || note.trim().length === 0)) {
    throw new InvalidStateTransitionError(
      fromStatus,
      toStatus,
      "Transition to NO_LONGER_APPLICABLE requires an explicit reason or evidence note."
    );
  }

  const validTransitions: Record<ActionStatus, ActionStatus[]> = {
    OPEN: ["IN_PROGRESS", "BLOCKED", "DISMISSED", "NO_LONGER_APPLICABLE", "IMPLEMENTATION_MARKED_COMPLETE"],
    IN_PROGRESS: ["IMPLEMENTATION_MARKED_COMPLETE", "BLOCKED", "OPEN", "DISMISSED", "NO_LONGER_APPLICABLE"],
    BLOCKED: ["OPEN", "IN_PROGRESS", "DISMISSED", "NO_LONGER_APPLICABLE"],
    VALIDATION_REQUIRED: ["IMPLEMENTATION_MARKED_COMPLETE", "VERIFIED_RESOLVED", "VALIDATION_FAILED", "OPEN"],
    IMPLEMENTATION_MARKED_COMPLETE: ["VERIFIED_RESOLVED", "VALIDATION_FAILED", "IN_PROGRESS", "OPEN"],
    VERIFIED_RESOLVED: ["REOPENED" as any, "OPEN"], // If regression occurs in subsequent crawl
    VALIDATION_FAILED: ["IN_PROGRESS", "OPEN", "DISMISSED"],
    DISMISSED: ["OPEN"],
    NO_LONGER_APPLICABLE: ["OPEN"],
  };

  const allowed = validTransitions[fromStatus] || [];
  if (!allowed.includes(toStatus) && !(toStatus === "VERIFIED_RESOLVED" && evidence?.verifiedByRecrawl)) {
    throw new InvalidStateTransitionError(
      fromStatus,
      toStatus,
      `Transition not permitted by action lifecycle state machine.`
    );
  }

  return {
    ...action,
    actionStatus: toStatus,
    statusHistory: [
      ...action.statusHistory,
      {
        status: toStatus,
        timestamp: new Date().toISOString(),
        note: note || `Status transitioned from ${fromStatus} to ${toStatus}.`,
      },
    ],
  };
}

export function markActionCompleted(action: SeoActionItem, note?: string): SeoActionItem {
  return transitionActionStatus(action, "IMPLEMENTATION_MARKED_COMPLETE", note || "Implementation marked complete by user; pending crawl verification.");
}

export function validateActionAgainstRecrawl(
  action: SeoActionItem,
  latestCrawlSnapshot: CrawlSnapshot
): {
  validatedAction: SeoActionItem;
  resolutionConfirmed: boolean;
} {
  let allResolved = true;
  let anyEvaluated = false;

  const currentFindingKeys = new Set(latestCrawlSnapshot.findings.map((f) => buildStableFindingIdentity(f)));

  for (const url of action.affectedUrls) {
    const pageInSnapshot = latestCrawlSnapshot.pages[url] || latestCrawlSnapshot.pages[url.toLowerCase().replace(/\/$/, "")];
    if (pageInSnapshot) {
      anyEvaluated = true;
      for (const ruleCode of action.underlyingRuleCodes) {
        const findingKey = buildStableFindingIdentity({
          ruleCode,
          url,
          severity: action.technicalSeverity,
        });

        if (currentFindingKeys.has(findingKey)) {
          allResolved = false;
        }
      }
    }
  }

  let newStatus: ActionStatus = action.actionStatus;
  let note = "";

  if (anyEvaluated && allResolved) {
    newStatus = "VERIFIED_RESOLVED";
    note = "Crawl verification confirmed all affected URLs resolved.";
  } else if (anyEvaluated && !allResolved) {
    newStatus = "VALIDATION_FAILED";
    note = "Recrawl detected persisting diagnostic findings on evaluated pages.";
  } else {
    newStatus = "VALIDATION_REQUIRED";
    note = "Affected pages were not evaluated in latest crawl snapshot; verification pending.";
  }

  return {
    validatedAction: transitionActionStatus(
      action,
      newStatus,
      note,
      { verifiedByRecrawl: newStatus === "VERIFIED_RESOLVED" }
    ),
    resolutionConfirmed: newStatus === "VERIFIED_RESOLVED",
  };
}
