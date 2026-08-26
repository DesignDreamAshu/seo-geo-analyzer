/**
 * Phase 28K: SQLite Persistence Repository for Remediation Action Items & Workflow State.
 */

import { DatabaseSync } from "node:sqlite";
import { ActionItem, ActionItemStatus, ActionItemPriority, BlockerReason } from "../types";

export class SqliteWorkflowRepository {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_action_items (
        action_item_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        system_priority TEXT NOT NULL,
        user_priority TEXT,
        effective_priority TEXT NOT NULL,
        priority_reason TEXT NOT NULL,
        status TEXT NOT NULL,
        user_set_status TEXT,
        system_verified_status TEXT,
        category TEXT NOT NULL,
        client_safe_label TEXT NOT NULL,
        affected_urls_json TEXT NOT NULL,
        affected_prompts_json TEXT NOT NULL,
        total_occurrences INTEGER NOT NULL,
        resolved_occurrences INTEGER NOT NULL,
        remaining_occurrences INTEGER NOT NULL,
        occurrences_json TEXT NOT NULL,
        what_is_wrong TEXT NOT NULL,
        why_it_matters TEXT NOT NULL,
        where_it_occurs TEXT NOT NULL,
        what_to_change TEXT NOT NULL,
        how_to_change TEXT NOT NULL,
        how_to_verify TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        assignee_name TEXT,
        due_date TEXT,
        blocker_reason TEXT,
        blocker_detail TEXT,
        notes_json TEXT NOT NULL,
        history_json TEXT NOT NULL,
        source_snapshot_ref_json TEXT NOT NULL,
        last_verification_evidence_json TEXT,
        last_verified_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_action_items_project ON workflow_action_items(project_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_action_items_status ON workflow_action_items(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_action_items_priority ON workflow_action_items(effective_priority);
    `);
  }

  public getActionItems(projectId: string): ActionItem[] {
    const rows = this.db
      .prepare(`SELECT * FROM workflow_action_items WHERE project_id = ? ORDER BY updated_at DESC`)
      .all(projectId) as any[];

    return rows.map((r) => this.mapRowToActionItem(r));
  }

  public getActionItemById(actionItemId: string): ActionItem | null {
    const row = this.db
      .prepare(`SELECT * FROM workflow_action_items WHERE action_item_id = ?`)
      .get(actionItemId) as any;

    return row ? this.mapRowToActionItem(row) : null;
  }

  public saveActionItem(item: ActionItem): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO workflow_action_items (
          action_item_id, project_id, source_type, source_id, title, summary,
          system_priority, user_priority, effective_priority, priority_reason,
          status, user_set_status, system_verified_status, category, client_safe_label,
          affected_urls_json, affected_prompts_json, total_occurrences, resolved_occurrences,
          remaining_occurrences, occurrences_json, what_is_wrong, why_it_matters, where_it_occurs,
          what_to_change, how_to_change, how_to_verify, recommendation, assignee_name, due_date,
          blocker_reason, blocker_detail, notes_json, history_json, source_snapshot_ref_json,
          last_verification_evidence_json, last_verified_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `)
      .run(
        item.actionItemId,
        item.projectId,
        item.sourceType,
        item.sourceId,
        item.title,
        item.summary,
        item.systemPriority,
        item.userPriority,
        item.effectivePriority,
        item.priorityReason,
        item.status,
        item.userSetStatus,
        item.systemVerifiedStatus,
        item.category,
        item.clientSafeLabel,
        JSON.stringify(item.affectedUrls),
        JSON.stringify(item.affectedPrompts),
        item.totalOccurrences,
        item.resolvedOccurrences,
        item.remainingOccurrences,
        JSON.stringify(item.occurrences),
        item.whatIsWrong,
        item.whyItMatters,
        item.whereItOccurs,
        item.whatToChange,
        item.howToChange,
        item.howToVerify,
        item.recommendation,
        item.assigneeName,
        item.dueDate,
        item.blockerReason,
        item.blockerDetail,
        JSON.stringify(item.notes),
        JSON.stringify(item.history),
        JSON.stringify(item.sourceSnapshotRef),
        item.lastVerificationEvidence ? JSON.stringify(item.lastVerificationEvidence) : null,
        item.lastVerifiedAt,
        item.createdAt,
        item.updatedAt
      );
  }

  public saveActionItems(items: ActionItem[]): void {
    for (const item of items) {
      this.saveActionItem(item);
    }
  }

  private mapRowToActionItem(row: any): ActionItem {
    return {
      actionItemId: row.action_item_id,
      projectId: row.project_id,
      sourceType: row.source_type as any,
      sourceId: row.source_id,
      title: row.title,
      summary: row.summary,
      systemPriority: row.system_priority as ActionItemPriority,
      userPriority: row.user_priority as ActionItemPriority | null,
      effectivePriority: row.effective_priority as ActionItemPriority,
      priorityReason: row.priority_reason,
      status: row.status as ActionItemStatus,
      userSetStatus: row.user_set_status as ActionItemStatus | null,
      systemVerifiedStatus: row.system_verified_status as ActionItemStatus | null,
      category: row.category,
      clientSafeLabel: row.client_safe_label,
      affectedUrls: JSON.parse(row.affected_urls_json || "[]"),
      affectedPrompts: JSON.parse(row.affected_prompts_json || "[]"),
      totalOccurrences: row.total_occurrences,
      resolvedOccurrences: row.resolved_occurrences,
      remainingOccurrences: row.remaining_occurrences,
      occurrences: JSON.parse(row.occurrences_json || "[]"),
      whatIsWrong: row.what_is_wrong,
      whyItMatters: row.why_it_matters,
      whereItOccurs: row.where_it_occurs,
      whatToChange: row.what_to_change,
      howToChange: row.how_to_change,
      howToVerify: row.how_to_verify,
      recommendation: row.recommendation,
      verificationMethod: row.how_to_verify || "LIVE_VERIFICATION",
      assigneeName: row.assignee_name,
      dueDate: row.due_date,
      blockerReason: row.blocker_reason as BlockerReason | null,
      blockerDetail: row.blocker_detail,
      notes: JSON.parse(row.notes_json || "[]"),
      history: JSON.parse(row.history_json || "[]"),
      sourceSnapshotRef: JSON.parse(row.source_snapshot_ref_json || "{}"),
      lastVerificationEvidence: row.last_verification_evidence_json
        ? JSON.parse(row.last_verification_evidence_json)
        : null,
      lastVerifiedAt: row.last_verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
