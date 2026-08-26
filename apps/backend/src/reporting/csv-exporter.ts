/**
 * Phase 28K: CSV Exporter for Remediation Action Items.
 * Generates RFC 4180 compliant CSV exports with proper escaping and formatting.
 */

import { ActionItem } from "../workflow/types";

export class RemediationCsvExporter {
  public static exportActionItemsToCsv(items: ActionItem[]): string {
    const headers = [
      "Action ID",
      "Source",
      "Category",
      "Priority",
      "Status",
      "Title",
      "Affected URLs",
      "Affected Prompts",
      "Total Occurrences",
      "Resolved Occurrences",
      "Remaining Occurrences",
      "Assignee",
      "Due Date",
      "Blocker Reason",
      "Recommendation",
      "Verification Method",
      "Last Verified At",
      "Created At",
      "Updated At",
    ];

    const rows: string[] = [];
    rows.push(headers.map((h) => this.escapeCsvValue(h)).join(","));

    for (const item of items) {
      const row = [
        item.actionItemId,
        item.sourceType,
        item.category,
        item.effectivePriority,
        item.status,
        item.title,
        item.affectedUrls.join("; "),
        item.affectedPrompts.join("; "),
        String(item.totalOccurrences),
        String(item.resolvedOccurrences),
        String(item.remainingOccurrences),
        item.assigneeName || "",
        item.dueDate || "",
        item.blockerReason ? `${item.blockerReason}: ${item.blockerDetail || ""}` : "",
        item.recommendation,
        item.verificationMethod,
        item.lastVerifiedAt || "",
        item.createdAt,
        item.updatedAt,
      ];

      rows.push(row.map((val) => this.escapeCsvValue(val)).join(","));
    }

    return rows.join("\r\n");
  }

  private static escapeCsvValue(val: string): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
