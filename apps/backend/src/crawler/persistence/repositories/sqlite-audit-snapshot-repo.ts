/**
 * Phase 24: SQLite Audit Snapshot Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { AuditSnapshotEntity, AuditSnapshotRepository } from "../types";

export class SQLiteAuditSnapshotRepository implements AuditSnapshotRepository {
  constructor(private db: DatabaseSync) {}

  async saveSnapshot(snap: AuditSnapshotEntity): Promise<AuditSnapshotEntity> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audit_snapshots (
        snapshot_id, audit_run_id, project_id, payload_json,
        immutability_statement, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snap.snapshotId,
      snap.auditRunId,
      snap.projectId,
      snap.payloadJson,
      snap.immutabilityStatement || "RUNTIME_IMMUTABLE_FREEZE",
      snap.createdAt || new Date().toISOString()
    );

    return snap;
  }

  async getSnapshot(auditRunId: string): Promise<AuditSnapshotEntity | null> {
    const stmt = this.db.prepare("SELECT * FROM audit_snapshots WHERE audit_run_id = ?");
    const row = stmt.get(auditRunId) as any;
    if (!row) return null;

    return {
      snapshotId: row.snapshot_id,
      auditRunId: row.audit_run_id,
      projectId: row.project_id,
      payloadJson: row.payload_json,
      immutabilityStatement: row.immutability_statement as "RUNTIME_IMMUTABLE_FREEZE",
      createdAt: row.created_at,
    };
  }
}
