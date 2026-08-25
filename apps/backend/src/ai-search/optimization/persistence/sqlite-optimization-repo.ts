/**
 * Phase 28G: SQLite AI Optimization Snapshot & Finding Repository.
 * Stores point-in-time optimization snapshots and tracks finding lifecycle progression.
 */

import { DatabaseSync } from "node:sqlite";
import { AIOptimizationSnapshot, AIOptimizationFinding, AIOptimizationLifecycleStatus } from "../types";

export class SqliteOptimizationRepository {
  constructor(private db: DatabaseSync) {
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_optimization_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        version TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        mappings_json TEXT NOT NULL,
        findings_json TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_optimization_findings (
        finding_id TEXT PRIMARY KEY,
        snapshot_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        code TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        priority TEXT NOT NULL,
        confidence TEXT NOT NULL,
        evidence_strength TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        lifecycle_status TEXT NOT NULL,
        finding_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_opt_snap_proj ON ai_optimization_snapshots(project_id, run_id);
      CREATE INDEX IF NOT EXISTS idx_ai_opt_find_snap ON ai_optimization_findings(snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_ai_opt_find_proj ON ai_optimization_findings(project_id, lifecycle_status);
    `);
  }

  public saveSnapshot(snapshot: AIOptimizationSnapshot): void {
    const snapStmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_optimization_snapshots (
        snapshot_id, project_id, run_id, generated_at, version,
        summary_json, mappings_json, findings_json, disclaimer, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    snapStmt.run(
      snapshot.snapshotId,
      snapshot.projectId,
      snapshot.runId,
      snapshot.generatedAt,
      snapshot.version,
      JSON.stringify(snapshot.summary),
      JSON.stringify(snapshot.mappings),
      JSON.stringify(snapshot.findings),
      snapshot.disclaimer,
      new Date().toISOString()
    );

    const findStmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_optimization_findings (
        finding_id, snapshot_id, project_id, code, category, type,
        priority, confidence, evidence_strength, title, summary,
        lifecycle_status, finding_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const f of snapshot.findings) {
      findStmt.run(
        f.id,
        snapshot.snapshotId,
        f.projectId,
        f.code,
        f.category,
        f.type,
        f.priority,
        f.confidence,
        f.evidenceStrength,
        f.title,
        f.summary,
        f.lifecycleStatus,
        JSON.stringify(f),
        f.createdAt,
        f.updatedAt
      );
    }
  }

  public getLatestSnapshot(projectId: string): AIOptimizationSnapshot | null {
    const row = this.db
      .prepare(`
        SELECT * FROM ai_optimization_snapshots
        WHERE project_id = ?
        ORDER BY generated_at DESC
        LIMIT 1
      `)
      .get(projectId) as any;

    if (!row) return null;

    return {
      snapshotId: row.snapshot_id,
      projectId: row.project_id,
      runId: row.run_id,
      generatedAt: row.generated_at,
      version: row.version,
      certificationStatus: "CERTIFIED",
      summary: JSON.parse(row.summary_json),
      mappings: JSON.parse(row.mappings_json),
      findings: JSON.parse(row.findings_json),
      disclaimer: row.disclaimer,
    };
  }

  public updateFindingLifecycle(findingId: string, status: AIOptimizationLifecycleStatus): void {
    this.db
      .prepare(`
        UPDATE ai_optimization_findings
        SET lifecycle_status = ?, updated_at = ?
        WHERE finding_id = ?
      `)
      .run(status, new Date().toISOString(), findingId);
  }
}
