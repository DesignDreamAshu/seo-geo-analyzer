/**
 * Phase 28K: Mathematical & Workflow Invariant Validator.
 * Strictly verifies accounting integrity, denominator bounds, occurrence conservation,
 * and score arithmetic across action items and client reports.
 */

import { ActionItem, WorkflowQueueSummary } from "./types";
import { ClientReportSnapshot } from "../reporting/types";

export function validateWorkflowInvariants(items: ActionItem[], summary: WorkflowQueueSummary): void {
  // 1. Total Action Items Conservation
  const countedTotal =
    summary.openCount +
    summary.inProgressCount +
    summary.readyToVerifyCount +
    summary.verifiedFixedCount +
    summary.partiallyFixedCount +
    summary.blockedCount +
    summary.wontFixCount;

  if (countedTotal !== items.length) {
    throw new Error(
      `[WORKFLOW INVARIANT ERROR] Sum of workflow states (${countedTotal}) does not match total action items (${items.length})!`
    );
  }

  // 2. Occurrence Conservation & Non-Negative Bounds
  for (const item of items) {
    if (item.resolvedOccurrences < 0 || item.remainingOccurrences < 0) {
      throw new Error(
        `[WORKFLOW INVARIANT ERROR] Negative occurrence count in action item ${item.actionItemId}!`
      );
    }

    if (item.resolvedOccurrences + item.remainingOccurrences !== item.totalOccurrences) {
      throw new Error(
        `[WORKFLOW INVARIANT ERROR] Occurrence conservation violated for ${item.actionItemId}: resolved (${item.resolvedOccurrences}) + remaining (${item.remainingOccurrences}) != total (${item.totalOccurrences})!`
      );
    }
  }

  // 3. Source Traceability Invariant
  for (const item of items) {
    if (!item.actionItemId || !item.projectId || !item.sourceId || !item.sourceType) {
      throw new Error(
        `[WORKFLOW INVARIANT ERROR] Action item missing mandatory traceability fields: ${JSON.stringify(item)}`
      );
    }
  }
}

export function validateReportInvariants(report: ClientReportSnapshot): void {
  // 1. Score Delta Arithmetic Check
  if (report.seoHealth.previousScore !== null && report.seoHealth.scoreDelta !== null) {
    const expectedDelta = Number((report.seoHealth.currentScore - report.seoHealth.previousScore).toFixed(1));
    if (Math.abs(report.seoHealth.scoreDelta - expectedDelta) > 0.01) {
      throw new Error(
        `[REPORT INVARIANT ERROR] Score delta arithmetic mismatch: reported ${report.seoHealth.scoreDelta}, calculated ${expectedDelta}!`
      );
    }
  }

  // 2. Remediation Progress Invariant
  const sumProgress =
    report.remediationProgress.openCount +
    report.remediationProgress.inProgressCount +
    report.remediationProgress.readyToVerifyCount +
    report.remediationProgress.verifiedFixedCount +
    report.remediationProgress.partiallyFixedCount +
    report.remediationProgress.blockedCount +
    report.remediationProgress.wontFixCount;

  if (sumProgress !== report.remediationProgress.totalActionItems) {
    throw new Error(
      `[REPORT INVARIANT ERROR] Report remediation progress sum (${sumProgress}) does not match total (${report.remediationProgress.totalActionItems})!`
    );
  }
}
