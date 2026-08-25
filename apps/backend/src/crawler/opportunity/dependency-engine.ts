/**
 * Action Dependency & Blocking Engine.
 * Ensures downstream growth and content optimizations are blocked until upstream indexability
 * and critical technical defects are resolved. Includes cycle detection and self-dependency guards.
 */

import { SeoActionItem } from "./types";

export function resolveActionDependencies(actions: SeoActionItem[]): SeoActionItem[] {
  // 1. Identify Critical Blocking Actions by Affected URLs (Exclude already resolved actions)
  const blockingActionMap = new Map<string, string[]>(); // normalizedUrl -> actionIds

  for (const action of actions) {
    if (action.actionStatus === "VERIFIED_RESOLVED" || action.actionStatus === "DISMISSED") {
      continue; // Resolved/dismissed actions do not block downstream tasks
    }

    const isBlockingType =
      action.type === "INDEXABILITY_FIX" ||
      action.underlyingRuleCodes.some((code) =>
        code.includes("NOINDEX") ||
        code.includes("STATUS_4XX") ||
        code.includes("ROBOTS_DISALLOWED") ||
        code.includes("CANONICAL_CONFLICT")
      );

    if (isBlockingType) {
      for (const url of action.affectedUrls) {
        const norm = url.toLowerCase().replace(/\/$/, "");
        const list = blockingActionMap.get(norm) || [];
        list.push(action.actionId);
        blockingActionMap.set(norm, list);
      }
    }
  }

  // 2. Link Blocked Actions with Cycle and Self-Dependency Guards
  return actions.map((action) => {
    // Actions that depend on clean indexability
    const isDependentType =
      action.type === "CTR_OPPORTUNITY" ||
      action.type === "INTERNAL_LINKING_OPPORTUNITY" ||
      action.type === "CONTENT_REFRESH_OPPORTUNITY" ||
      action.type === "CONTENT_STRUCTURE_OPPORTUNITY" ||
      action.type === "GEO_AEO_OPPORTUNITY";

    if (isDependentType && action.actionStatus !== "VERIFIED_RESOLVED") {
      const blockers = new Set<string>();
      for (const url of action.affectedUrls) {
        const norm = url.toLowerCase().replace(/\/$/, "");
        const actionBlockers = blockingActionMap.get(norm);
        if (actionBlockers) {
          for (const bId of actionBlockers) {
            if (bId !== action.actionId) {
              // Self-dependency guard
              blockers.add(bId);
            }
          }
        }
      }

      // Filter out circular dependencies if any action blocks each other
      const safeBlockers = Array.from(blockers).filter((bId) => {
        const blockerAction = actions.find((a) => a.actionId === bId);
        if (!blockerAction) return false;
        // Cycle check: If blocker is already blocked by this action, break the cycle
        if (blockerAction.blockedByActionIds && blockerAction.blockedByActionIds.includes(action.actionId)) {
          return false; // Break circular dependency
        }
        return true;
      });

      if (safeBlockers.length > 0) {
        return {
          ...action,
          blockedByActionIds: safeBlockers,
          actionStatus: action.actionStatus === "OPEN" ? "BLOCKED" : action.actionStatus,
          caution: `Blocked by upstream indexability/canonical resolution (${safeBlockers.join(", ")}). Verify page indexability before proceeding.`,
        };
      } else if (action.actionStatus === "BLOCKED") {
        // Upstream blocker was resolved -> unblock!
        return {
          ...action,
          blockedByActionIds: [],
          actionStatus: "OPEN",
          caution: undefined,
        };
      }
    }

    return action;
  });
}
