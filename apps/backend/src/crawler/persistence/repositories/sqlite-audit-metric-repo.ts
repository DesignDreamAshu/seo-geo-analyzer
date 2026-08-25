/**
 * Phase 24: SQLite Audit Metric Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { AuditMetricEntity, AuditMetricRepository } from "../types";

export class SQLiteAuditMetricRepository implements AuditMetricRepository {
  constructor(private db: DatabaseSync) {}

  async saveMetrics(metrics: AuditMetricEntity): Promise<AuditMetricEntity> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audit_metrics (
        metric_id, audit_run_id, project_id, pages_crawled, pages_indexable,
        total_findings, critical_count, high_count, medium_count, low_count,
        informational_count, seo_score, category_scores_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metrics.metricId,
      metrics.auditRunId,
      metrics.projectId,
      metrics.pagesCrawled,
      metrics.pagesIndexable,
      metrics.totalFindings,
      metrics.criticalCount,
      metrics.highCount,
      metrics.mediumCount,
      metrics.lowCount,
      metrics.informationalCount,
      metrics.seoScore || null,
      metrics.categoryScores ? JSON.stringify(metrics.categoryScores) : null,
      metrics.createdAt || new Date().toISOString()
    );

    return metrics;
  }

  async getMetricsForAuditRun(auditRunId: string): Promise<AuditMetricEntity | null> {
    const stmt = this.db.prepare("SELECT * FROM audit_metrics WHERE audit_run_id = ?");
    const row = stmt.get(auditRunId) as any;
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  async getMetricHistory(projectId: string, limit = 50): Promise<AuditMetricEntity[]> {
    const stmt = this.db.prepare(`
      SELECT m.* FROM audit_metrics m
      JOIN audit_runs r ON m.audit_run_id = r.audit_run_id
      WHERE m.project_id = ?
      ORDER BY r.sequence_number ASC
      LIMIT ?
    `);
    const rows = stmt.all(projectId, limit) as any[];
    return rows.map(this.mapRowToEntity);
  }

  private mapRowToEntity(row: any): AuditMetricEntity {
    return {
      metricId: row.metric_id,
      auditRunId: row.audit_run_id,
      projectId: row.project_id,
      pagesCrawled: row.pages_crawled,
      pagesIndexable: row.pages_indexable,
      totalFindings: row.total_findings,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      informationalCount: row.informational_count,
      seoScore: row.seo_score !== null ? row.seo_score : undefined,
      categoryScores: row.category_scores_json ? JSON.parse(row.category_scores_json) : undefined,
      createdAt: row.created_at,
    };
  }
}
