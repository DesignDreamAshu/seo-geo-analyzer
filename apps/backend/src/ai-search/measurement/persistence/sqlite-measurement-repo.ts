/**
 * Phase 28I: SQLite Measurement & Benchmarking Repository.
 * Persists immutable AI measurement snapshots and historical comparisons.
 */

import { DatabaseSync } from "node:sqlite";
import { AIMeasurementSnapshot, AIMeasurementComparison } from "../types";

export class SqliteMeasurementRepository {
  constructor(private db: DatabaseSync) {
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_measurement_snapshots (
        measurement_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        audit_run_id TEXT NOT NULL,
        optimization_snapshot_id TEXT NOT NULL,
        engine_version TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        prompt_summary_json TEXT NOT NULL,
        page_targeting_summary_json TEXT NOT NULL,
        prompt_details_json TEXT NOT NULL,
        intent_breakdowns_json TEXT NOT NULL,
        category_measurements_json TEXT NOT NULL,
        page_demands_json TEXT NOT NULL,
        finding_lifecycle_json TEXT NOT NULL,
        provider_status_json TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_measurement_comparisons (
        comparison_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        baseline_snapshot_id TEXT NOT NULL,
        current_snapshot_id TEXT NOT NULL,
        compatibility TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        metric_deltas_json TEXT NOT NULL,
        prompt_transitions_json TEXT NOT NULL,
        remediation_drivers_json TEXT NOT NULL,
        regressions_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_meas_proj ON ai_measurement_snapshots(project_id, generated_at);
      CREATE INDEX IF NOT EXISTS idx_ai_cmp_proj ON ai_measurement_comparisons(project_id, created_at);
    `);
  }

  public saveMeasurementSnapshot(snapshot: AIMeasurementSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_measurement_snapshots (
        measurement_id, project_id, audit_run_id, optimization_snapshot_id,
        engine_version, fingerprint, metrics_json, prompt_summary_json,
        page_targeting_summary_json, prompt_details_json, intent_breakdowns_json,
        category_measurements_json, page_demands_json, finding_lifecycle_json,
        provider_status_json, disclaimer, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.measurementId,
      snapshot.projectId,
      snapshot.auditRunId,
      snapshot.optimizationSnapshotId,
      snapshot.engineVersion,
      snapshot.fingerprint,
      JSON.stringify(snapshot.metrics),
      JSON.stringify(snapshot.promptCoverageSummary),
      JSON.stringify(snapshot.pageTargetingSummary),
      JSON.stringify(snapshot.promptDetails),
      JSON.stringify(snapshot.intentBreakdowns),
      JSON.stringify(snapshot.categoryMeasurements),
      JSON.stringify(snapshot.pageDemandSummaries),
      JSON.stringify(snapshot.findingLifecycle),
      JSON.stringify(snapshot.providerObservationStatus),
      snapshot.disclaimer,
      snapshot.generatedAt,
      new Date().toISOString()
    );
  }

  public getLatestMeasurementSnapshot(projectId: string): AIMeasurementSnapshot | null {
    const row = this.db
      .prepare(`
        SELECT * FROM ai_measurement_snapshots
        WHERE project_id = ?
        ORDER BY generated_at DESC
        LIMIT 1
      `)
      .get(projectId) as any;

    if (!row) return null;

    return {
      measurementId: row.measurement_id,
      projectId: row.project_id,
      auditRunId: row.audit_run_id,
      optimizationSnapshotId: row.optimization_snapshot_id,
      promptUniverseVersion: "v1.0",
      engineVersion: row.engine_version,
      fingerprint: row.fingerprint,
      generatedAt: row.generated_at,
      metrics: JSON.parse(row.metrics_json),
      promptCoverageSummary: JSON.parse(row.prompt_summary_json),
      pageTargetingSummary: JSON.parse(row.page_targeting_summary_json),
      promptDetails: JSON.parse(row.prompt_details_json),
      intentBreakdowns: JSON.parse(row.intent_breakdowns_json),
      categoryMeasurements: JSON.parse(row.category_measurements_json),
      pageDemandSummaries: JSON.parse(row.page_demands_json),
      findingLifecycle: JSON.parse(row.finding_lifecycle_json),
      providerObservationStatus: JSON.parse(row.provider_status_json),
      disclaimer: row.disclaimer,
    };
  }

  public getMeasurementHistory(projectId: string, limit = 10): AIMeasurementSnapshot[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM ai_measurement_snapshots
        WHERE project_id = ?
        ORDER BY generated_at DESC
        LIMIT ?
      `)
      .all(projectId, limit) as any[];

    return rows.map((row) => ({
      measurementId: row.measurement_id,
      projectId: row.project_id,
      auditRunId: row.audit_run_id,
      optimizationSnapshotId: row.optimization_snapshot_id,
      promptUniverseVersion: "v1.0",
      engineVersion: row.engine_version,
      fingerprint: row.fingerprint,
      generatedAt: row.generated_at,
      metrics: JSON.parse(row.metrics_json),
      promptCoverageSummary: JSON.parse(row.prompt_summary_json),
      pageTargetingSummary: JSON.parse(row.page_targeting_summary_json),
      promptDetails: JSON.parse(row.prompt_details_json),
      intentBreakdowns: JSON.parse(row.intent_breakdowns_json),
      categoryMeasurements: JSON.parse(row.category_measurements_json),
      pageDemandSummaries: JSON.parse(row.page_demands_json),
      findingLifecycle: JSON.parse(row.finding_lifecycle_json),
      providerObservationStatus: JSON.parse(row.provider_status_json),
      disclaimer: row.disclaimer,
    }));
  }

  public saveComparison(comparison: AIMeasurementComparison): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_measurement_comparisons (
        comparison_id, project_id, baseline_snapshot_id, current_snapshot_id,
        compatibility, summary_json, metric_deltas_json, prompt_transitions_json,
        remediation_drivers_json, regressions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      comparison.comparisonId,
      comparison.projectId,
      comparison.baselineSnapshotId,
      comparison.currentSnapshotId,
      comparison.compatibility,
      JSON.stringify(comparison.summary),
      JSON.stringify(comparison.metricDeltas),
      JSON.stringify(comparison.promptTransitions),
      JSON.stringify(comparison.remediationDrivers),
      JSON.stringify(comparison.regressions),
      new Date().toISOString()
    );
  }
}
