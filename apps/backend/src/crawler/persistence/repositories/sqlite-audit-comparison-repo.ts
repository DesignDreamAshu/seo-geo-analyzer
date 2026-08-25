/**
 * Phase 24: SQLite Audit Comparison Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { AuditComparisonRepository, AuditComparisonResult } from "../types";

export class SQLiteAuditComparisonRepository implements AuditComparisonRepository {
  constructor(private db: DatabaseSync) {}

  async saveComparison(comp: AuditComparisonResult): Promise<AuditComparisonResult> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audit_comparisons (
        comparison_id, project_id, baseline_audit_run_id, current_audit_run_id,
        baseline_sequence_number, current_sequence_number, computed_at,
        previous_issue_count, current_issue_count, fixed_count, new_count,
        unchanged_count, reopened_count, changed_count, severity_increased_count,
        severity_decreased_count, uncomparable_count, page_changes_json,
        rule_summaries_json, finding_diffs_json, metric_changes_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      comp.comparisonId,
      comp.projectId,
      comp.baselineAuditRunId,
      comp.currentAuditRunId,
      comp.baselineSequenceNumber,
      comp.currentSequenceNumber,
      comp.computedAt,
      comp.previousIssueCount,
      comp.currentIssueCount,
      comp.fixedCount,
      comp.newCount,
      comp.unchangedCount,
      comp.reopenedCount,
      comp.changedCount,
      comp.severityIncreasedCount,
      comp.severityDecreasedCount,
      comp.uncomparableCount,
      JSON.stringify(comp.pageChanges),
      JSON.stringify(comp.ruleSummaries),
      JSON.stringify(comp.findingDiffs),
      JSON.stringify(comp.metricChanges)
    );

    return comp;
  }

  async getComparison(baselineAuditRunId: string, currentAuditRunId: string): Promise<AuditComparisonResult | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_comparisons
      WHERE baseline_audit_run_id = ? AND current_audit_run_id = ?
      LIMIT 1
    `);
    const row = stmt.get(baselineAuditRunId, currentAuditRunId) as any;
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  async listComparisonsForProject(projectId: string, limit = 20): Promise<AuditComparisonResult[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_comparisons
      WHERE project_id = ?
      ORDER BY computed_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(projectId, limit) as any[];
    return rows.map(this.mapRowToEntity);
  }

  private mapRowToEntity(row: any): AuditComparisonResult {
    return {
      comparisonId: row.comparison_id,
      projectId: row.project_id,
      baselineAuditRunId: row.baseline_audit_run_id,
      currentAuditRunId: row.current_audit_run_id,
      baselineSequenceNumber: row.baseline_sequence_number,
      currentSequenceNumber: row.current_sequence_number,
      computedAt: row.computed_at,
      comparisonEngineVersion: "1.2.0",
      previousIssueCount: row.previous_issue_count,
      currentIssueCount: row.current_issue_count,
      fixedCount: row.fixed_count,
      newCount: row.new_count,
      unchangedCount: row.unchanged_count,
      reopenedCount: row.reopened_count,
      changedCount: row.changed_count,
      severityIncreasedCount: row.severity_increased_count,
      severityDecreasedCount: row.severity_decreased_count,
      uncomparableCount: row.uncomparable_count,
      pageChanges: JSON.parse(row.page_changes_json),
      ruleSummaries: JSON.parse(row.rule_summaries_json),
      findingDiffs: JSON.parse(row.finding_diffs_json),
      metricChanges: JSON.parse(row.metric_changes_json),
    };
  }
}
