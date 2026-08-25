/**
 * Hardened Quick-Win Evaluator.
 * Strictly enforces defensible quick-win classification:
 * Low/Trivial Effort + High Expected Leverage + Confirmed Deterministic Nature + Unblocked.
 */

import { SeoActionItem } from "./types";

export function evaluateQuickWin(action: SeoActionItem): {
  isQuickWin: boolean;
  quickWinRationale?: string;
} {
  // 1. Disqualify Low Priority, Heuristic, Advisory, or Manual Review Actions
  if (action.actionPriority === "LOW" || action.actionPriority === "REVIEW") {
    return { isQuickWin: false };
  }

  if (action.nature === "CONTENT_RECOMMENDATION" || action.nature === "REVIEW_RECOMMENDED") {
    return { isQuickWin: false }; // Advisory / heuristic suggestions cannot be quick wins!
  }

  // 2. Disqualify High, Medium, or Unknown Effort Actions
  if (action.effort === "HIGH" || action.effort === "UNKNOWN" || action.effort === "MEDIUM") {
    return { isQuickWin: false };
  }

  // 3. Disqualify Blocked Actions
  if (action.actionStatus === "BLOCKED" || action.blockedByActionIds.length > 0) {
    return { isQuickWin: false };
  }

  // 4. Must Have Meaningful Leverage
  const hasHighDemand = (action.gscExposure?.totalImpressions || 0) >= 800;
  const isHighLeverageSystemic = action.type === "SYSTEMIC_TEMPLATE_FIX" && action.affectedUrlsCount >= 5;
  const isHighPrioritySingle = (action.actionPriority === "HIGH" || action.actionPriority === "CRITICAL") && (action.effort === "TRIVIAL" || action.effort === "LOW");

  if (hasHighDemand || isHighLeverageSystemic || isHighPrioritySingle) {
    let rationale = `Low effort (${action.effort.toLowerCase()}) with high leverage (${action.actionPriority.toLowerCase()} priority).`;
    if (isHighLeverageSystemic) {
      rationale = `High-leverage systemic fix: ~${action.estimatedRealEdits} template edit resolves ${action.affectedUrlsCount} affected pages.`;
    } else if (hasHighDemand) {
      rationale = `Low effort adjustment affecting ${action.gscExposure?.totalImpressions.toLocaleString()} evaluated GSC impressions.`;
    }

    return {
      isQuickWin: true,
      quickWinRationale: rationale,
    };
  }

  return { isQuickWin: false };
}
