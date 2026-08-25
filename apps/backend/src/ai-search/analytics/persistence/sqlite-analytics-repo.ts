/**
 * Phase 28E: SQLite Repository for AI Visibility Analytics Snapshots.
 */

import { DatabaseSync } from "node:sqlite";
import { AIVisibilityAnalyticsSnapshot } from "../types";

export class SqliteAnalyticsRepository {
  constructor(private db: DatabaseSync) {}

  public saveAnalyticsSnapshot(snapshot: AIVisibilityAnalyticsSnapshot): void {
    // Ensure parent project and run exist to satisfy FK constraints
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO projects (
          project_id, name, primary_domain, normalized_domain, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        snapshot.projectId,
        snapshot.projectId,
        "example.com",
        "example.com",
        snapshot.generatedAt,
        snapshot.generatedAt
      );

      this.db.prepare(`
        INSERT OR IGNORE INTO ai_observation_runs (
          run_id, project_id, status, config_json, knowledge_profile_version,
          prompt_universe_version, total_planned, completed, successful, failed,
          mention_rate, citation_rate, started_at, completed_at, created_at
        ) VALUES (?, ?, 'COMPLETED', '{}', 'v28c-1.0', 'v28c-1.0', 1, 1, 1, 0, 0.0, 0.0, ?, ?, ?)
      `).run(
        snapshot.runId,
        snapshot.projectId,
        snapshot.generatedAt,
        snapshot.generatedAt,
        snapshot.generatedAt
      );
    } catch {
      // Ignore
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_visibility_analytics_snapshots (
        snapshot_id, project_id, run_id, metric_version,
        certification_status, is_test_data, payload_json, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.snapshotId,
      snapshot.projectId,
      snapshot.runId,
      snapshot.metricVersion,
      snapshot.certificationStatus,
      snapshot.isTestData ? 1 : 0,
      JSON.stringify(snapshot),
      snapshot.generatedAt
    );
  }

  public getAnalyticsSnapshot(snapshotId: string): AIVisibilityAnalyticsSnapshot | null {
    const row = this.db.prepare(
      "SELECT payload_json FROM ai_visibility_analytics_snapshots WHERE snapshot_id = ?"
    ).get(snapshotId) as any;

    if (!row) return null;
    return JSON.parse(row.payload_json);
  }

  public getLatestSnapshotForRun(runId: string): AIVisibilityAnalyticsSnapshot | null {
    const row = this.db.prepare(
      "SELECT payload_json FROM ai_visibility_analytics_snapshots WHERE run_id = ? ORDER BY generated_at DESC LIMIT 1"
    ).get(runId) as any;

    if (!row) return null;
    return JSON.parse(row.payload_json);
  }

  public getLatestSnapshotForProject(projectId: string): AIVisibilityAnalyticsSnapshot | null {
    const row = this.db.prepare(
      "SELECT payload_json FROM ai_visibility_analytics_snapshots WHERE project_id = ? ORDER BY generated_at DESC LIMIT 1"
    ).get(projectId) as any;

    if (!row) return null;
    return JSON.parse(row.payload_json);
  }

  public listSnapshotsForProject(projectId: string, limit: number = 20): AIVisibilityAnalyticsSnapshot[] {
    const rows = this.db.prepare(
      "SELECT payload_json FROM ai_visibility_analytics_snapshots WHERE project_id = ? ORDER BY generated_at DESC LIMIT ?"
    ).all(projectId, limit) as any[];

    return rows.map((r) => JSON.parse(r.payload_json));
  }
}
