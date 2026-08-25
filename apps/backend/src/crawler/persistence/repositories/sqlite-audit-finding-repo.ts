/**
 * Phase 24: SQLite Audit Finding Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { AuditFindingEntity, AuditFindingRepository } from "../types";

export class SQLiteAuditFindingRepository implements AuditFindingRepository {
  constructor(private db: DatabaseSync) {}

  async batchInsertFindings(findings: AuditFindingEntity[]): Promise<void> {
    if (findings.length === 0) return;

    this.db.exec("BEGIN TRANSACTION;");
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_findings (
          audit_finding_id, audit_run_id, project_id, audit_page_id,
          rule_id, severity, finding_state, message, evidence_json,
          normalized_url, finding_fingerprint, target_resource, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const f of findings) {
        stmt.run(
          f.auditFindingId,
          f.auditRunId,
          f.projectId,
          f.auditPageId || null,
          f.ruleId,
          f.severity,
          f.findingState,
          f.message,
          JSON.stringify(f.evidence),
          f.normalizedUrl,
          f.findingFingerprint,
          f.targetResource || null,
          f.createdAt || new Date().toISOString()
        );
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  async getFindingsForAuditRun(auditRunId: string, limit = 5000, offset = 0): Promise<AuditFindingEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_findings
      WHERE audit_run_id = ?
      ORDER BY severity ASC, rule_id ASC, normalized_url ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(auditRunId, limit, offset) as any[];
    return rows.map(this.mapRowToEntity);
  }

  async getFindingByFingerprint(auditRunId: string, findingFingerprint: string): Promise<AuditFindingEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_findings
      WHERE audit_run_id = ? AND finding_fingerprint = ?
      LIMIT 1
    `);
    const row = stmt.get(auditRunId, findingFingerprint) as any;
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  async getFindingHistory(projectId: string, findingFingerprint: string): Promise<AuditFindingEntity[]> {
    const stmt = this.db.prepare(`
      SELECT f.* FROM audit_findings f
      JOIN audit_runs r ON f.audit_run_id = r.audit_run_id
      WHERE f.project_id = ? AND f.finding_fingerprint = ?
      ORDER BY r.sequence_number ASC
    `);
    const rows = stmt.all(projectId, findingFingerprint) as any[];
    return rows.map(this.mapRowToEntity);
  }

  async listHistoricalFindingsForFingerprints(projectId: string, fingerprints: string[]): Promise<AuditFindingEntity[]> {
    if (fingerprints.length === 0) return [];

    // Chunking to avoid sqlite parameter limits
    const results: AuditFindingEntity[] = [];
    const chunkSize = 100;

    for (let i = 0; i < fingerprints.length; i += chunkSize) {
      const chunk = fingerprints.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const stmt = this.db.prepare(`
        SELECT f.* FROM audit_findings f
        JOIN audit_runs r ON f.audit_run_id = r.audit_run_id
        WHERE f.project_id = ? AND f.finding_fingerprint IN (${placeholders})
        ORDER BY r.sequence_number ASC
      `);
      const rows = stmt.all(projectId, ...chunk) as any[];
      results.push(...rows.map(this.mapRowToEntity));
    }

    return results;
  }

  private mapRowToEntity(row: any): AuditFindingEntity {
    return {
      auditFindingId: row.audit_finding_id,
      auditRunId: row.audit_run_id,
      projectId: row.project_id,
      auditPageId: row.audit_page_id || undefined,
      ruleId: row.rule_id,
      severity: row.severity,
      findingState: row.finding_state,
      message: row.message,
      evidence: JSON.parse(row.evidence_json),
      normalizedUrl: row.normalized_url,
      findingFingerprint: row.finding_fingerprint,
      targetResource: row.target_resource || undefined,
      createdAt: row.created_at,
    };
  }
}
