/**
 * Phase 28K: SQLite Persistence Repository for Client Reports.
 */

import { DatabaseSync } from "node:sqlite";
import { ClientReportSnapshot } from "../types";

export class SqliteClientReportRepository {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS client_report_snapshots (
        report_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        report_version TEXT NOT NULL,
        audience TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_client_reports_project ON client_report_snapshots(project_id);
      CREATE INDEX IF NOT EXISTS idx_client_reports_generated ON client_report_snapshots(generated_at);
    `);
  }

  public saveReportSnapshot(report: ClientReportSnapshot): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO client_report_snapshots (
          report_id, project_id, report_version, audience, fingerprint, generated_at, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        report.reportId,
        report.projectId,
        report.reportVersion,
        report.metadata.audience,
        report.fingerprint,
        report.generatedAt,
        JSON.stringify(report)
      );
  }

  public getLatestReportSnapshot(projectId: string): ClientReportSnapshot | null {
    const row = this.db
      .prepare(`
        SELECT payload_json FROM client_report_snapshots
        WHERE project_id = ?
        ORDER BY generated_at DESC
        LIMIT 1
      `)
      .get(projectId) as any;

    return row ? JSON.parse(row.payload_json) : null;
  }

  public getReportSnapshotById(reportId: string): ClientReportSnapshot | null {
    const row = this.db
      .prepare(`SELECT payload_json FROM client_report_snapshots WHERE report_id = ?`)
      .get(reportId) as any;

    return row ? JSON.parse(row.payload_json) : null;
  }

  public listReportHistory(projectId: string): { reportId: string; generatedAt: string; audience: string; score: number; fingerprint: string }[] {
    const rows = this.db
      .prepare(`
        SELECT report_id, generated_at, audience, fingerprint, payload_json
        FROM client_report_snapshots
        WHERE project_id = ?
        ORDER BY generated_at DESC
      `)
      .all(projectId) as any[];

    return rows.map((r) => {
      const parsed = JSON.parse(r.payload_json);
      return {
        reportId: r.report_id,
        generatedAt: r.generated_at,
        audience: r.audience,
        score: parsed.seoHealth?.currentScore || 0,
        fingerprint: r.fingerprint,
      };
    });
  }
}
