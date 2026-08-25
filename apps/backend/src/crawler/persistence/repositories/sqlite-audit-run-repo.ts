/**
 * Phase 24: SQLite Audit Run Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { AuditRunEntity, AuditRunRepository, AuditRunStatus, AuditTriggerType } from "../types";

export class SQLiteAuditRunRepository implements AuditRunRepository {
  constructor(private db: DatabaseSync) {}

  async createAuditRun(auditRun: Omit<AuditRunEntity, "createdAt">): Promise<AuditRunEntity> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO audit_runs (
        audit_run_id, project_id, sequence_number, started_at, completed_at,
        status, trigger_type, crawler_version, rule_inventory_version,
        production_rule_count, policy_versions_json, configuration_snapshot_json,
        summary_stats_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      auditRun.auditRunId,
      auditRun.projectId,
      auditRun.sequenceNumber,
      auditRun.startedAt,
      auditRun.completedAt || null,
      auditRun.status,
      auditRun.trigger,
      auditRun.crawlerVersion,
      auditRun.ruleInventoryVersion,
      auditRun.productionRuleCount,
      typeof auditRun.policyVersions === "string" ? auditRun.policyVersions : JSON.stringify(auditRun.policyVersions),
      JSON.stringify(auditRun.configurationSnapshot),
      auditRun.summaryStats ? JSON.stringify(auditRun.summaryStats) : null,
      now
    );

    return {
      ...auditRun,
      createdAt: now,
    };
  }

  async updateAuditRunStatus(
    auditRunId: string,
    status: AuditRunStatus,
    completedAt?: string,
    stats?: AuditRunEntity["summaryStats"]
  ): Promise<AuditRunEntity> {
    const existing = await this.getAuditRunById(auditRunId);
    if (!existing) {
      throw new Error(`Audit run ${auditRunId} not found.`);
    }

    const completed = completedAt || (status === "COMPLETED" ? new Date().toISOString() : existing.completedAt);
    const summaryStats = stats || existing.summaryStats;

    const stmt = this.db.prepare(`
      UPDATE audit_runs SET
        status = ?,
        completed_at = ?,
        summary_stats_json = ?
      WHERE audit_run_id = ?
    `);

    stmt.run(
      status,
      completed || null,
      summaryStats ? JSON.stringify(summaryStats) : null,
      auditRunId
    );

    // If completed, update project's latestAuditRunId
    if (status === "COMPLETED") {
      const updateProject = this.db.prepare(`
        UPDATE projects SET latest_audit_run_id = ?, updated_at = ? WHERE project_id = ?
      `);
      updateProject.run(auditRunId, new Date().toISOString(), existing.projectId);
    }

    return {
      ...existing,
      status,
      completedAt: completed,
      summaryStats,
    };
  }

  async getAuditRunById(auditRunId: string): Promise<AuditRunEntity | null> {
    const stmt = this.db.prepare("SELECT * FROM audit_runs WHERE audit_run_id = ?");
    const row = stmt.get(auditRunId) as any;
    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  async getLatestAuditRunForProject(projectId: string): Promise<AuditRunEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_runs
      WHERE project_id = ?
      ORDER BY sequence_number DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId) as any;
    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  async getLatestCompletedAuditRun(projectId: string): Promise<AuditRunEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_runs
      WHERE project_id = ? AND status = 'COMPLETED'
      ORDER BY sequence_number DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId) as any;
    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  async listAuditRunsForProject(projectId: string, limit = 50, offset = 0): Promise<AuditRunEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_runs
      WHERE project_id = ?
      ORDER BY sequence_number DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(projectId, limit, offset) as any[];
    return rows.map(this.mapRowToEntity);
  }

  async getNextSequenceNumber(projectId: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT MAX(sequence_number) as max_seq FROM audit_runs WHERE project_id = ?
    `);
    const row = stmt.get(projectId) as any;
    return (row?.max_seq || 0) + 1;
  }

  async countAuditRunsForProject(projectId: string): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as total FROM audit_runs WHERE project_id = ?");
    const row = stmt.get(projectId) as any;
    return row?.total || 0;
  }

  private mapRowToEntity(row: any): AuditRunEntity {
    return {
      auditRunId: row.audit_run_id,
      projectId: row.project_id,
      sequenceNumber: row.sequence_number,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      status: row.status as AuditRunStatus,
      trigger: row.trigger_type as AuditTriggerType,
      crawlerVersion: row.crawler_version,
      ruleInventoryVersion: row.rule_inventory_version,
      productionRuleCount: row.production_rule_count,
      policyVersions: row.policy_versions_json,
      configurationSnapshot: JSON.parse(row.configuration_snapshot_json),
      summaryStats: row.summary_stats_json ? JSON.parse(row.summary_stats_json) : undefined,
      createdAt: row.created_at,
    };
  }
}
