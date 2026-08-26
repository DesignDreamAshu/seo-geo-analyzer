/**
 * Phase 28J: SQLite Competitive Repository.
 * Manages configured project competitors and immutable competitive benchmark snapshots.
 */

import { DatabaseSync } from "node:sqlite";
import { ProjectCompetitor, AICompetitiveBenchmarkSnapshot, CompetitorStatus } from "../types";

export class SqliteCompetitiveRepository {
  constructor(private db: DatabaseSync) {
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_project_competitors (
        competitor_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        discovery_reason TEXT,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_competitive_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        client_measurement_snapshot_id TEXT NOT NULL,
        engine_version TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        comparability TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        competitors_json TEXT NOT NULL,
        prompt_comparisons_json TEXT NOT NULL,
        intent_comparisons_json TEXT NOT NULL,
        opportunities_json TEXT NOT NULL,
        client_advantages_json TEXT NOT NULL,
        corpus_summaries_json TEXT NOT NULL,
        disclaimer TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_comp_proj ON ai_project_competitors(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_ai_comp_snap ON ai_competitive_snapshots(project_id, generated_at);
    `);
  }

  public addCompetitor(competitor: ProjectCompetitor): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_project_competitors (
        competitor_id, project_id, domain, display_name, status,
        source, discovery_reason, confidence, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      competitor.competitorId,
      competitor.projectId,
      competitor.domain,
      competitor.displayName,
      competitor.status,
      competitor.source,
      competitor.discoveryReason || null,
      competitor.confidence,
      competitor.createdAt,
      competitor.updatedAt
    );
  }

  public getCompetitors(projectId: string): ProjectCompetitor[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM ai_project_competitors
        WHERE project_id = ?
        ORDER BY created_at ASC
      `)
      .all(projectId) as any[];

    return rows.map((r) => ({
      competitorId: r.competitor_id,
      projectId: r.project_id,
      domain: r.domain,
      displayName: r.display_name,
      status: r.status,
      source: r.source,
      discoveryReason: r.discovery_reason,
      confidence: r.confidence,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public updateCompetitorStatus(competitorId: string, status: CompetitorStatus): void {
    this.db
      .prepare(`
        UPDATE ai_project_competitors
        SET status = ?, updated_at = ?
        WHERE competitor_id = ?
      `)
      .run(status, new Date().toISOString(), competitorId);
  }

  public deleteCompetitor(competitorId: string): void {
    this.db
      .prepare(`
        DELETE FROM ai_project_competitors
        WHERE competitor_id = ?
      `)
      .run(competitorId);
  }

  public saveBenchmarkSnapshot(snapshot: AICompetitiveBenchmarkSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_competitive_snapshots (
        snapshot_id, project_id, client_measurement_snapshot_id,
        engine_version, fingerprint, comparability, summary_json,
        competitors_json, prompt_comparisons_json, intent_comparisons_json,
        opportunities_json, client_advantages_json, corpus_summaries_json,
        disclaimer, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.snapshotId,
      snapshot.projectId,
      snapshot.clientMeasurementSnapshotId,
      snapshot.competitiveEngineVersion,
      snapshot.fingerprint,
      snapshot.comparability,
      JSON.stringify(snapshot.summary),
      JSON.stringify(snapshot.competitors),
      JSON.stringify(snapshot.promptComparisons),
      JSON.stringify(snapshot.intentComparisons),
      JSON.stringify(snapshot.opportunities),
      JSON.stringify(snapshot.clientAdvantages),
      JSON.stringify(snapshot.competitorCorpusSummaries),
      snapshot.disclaimer,
      snapshot.generatedAt,
      new Date().toISOString()
    );
  }

  public getLatestBenchmarkSnapshot(projectId: string): AICompetitiveBenchmarkSnapshot | null {
    const row = this.db
      .prepare(`
        SELECT * FROM ai_competitive_snapshots
        WHERE project_id = ?
        ORDER BY generated_at DESC
        LIMIT 1
      `)
      .get(projectId) as any;

    if (!row) return null;

    return {
      snapshotId: row.snapshot_id,
      projectId: row.project_id,
      clientMeasurementSnapshotId: row.client_measurement_snapshot_id,
      promptUniverseVersion: "v1.0",
      optimizationEngineVersion: "phase28h-advanced-content-intelligence",
      measurementEngineVersion: "phase28i-measurement-v1",
      competitiveEngineVersion: row.engine_version,
      comparability: row.comparability,
      comparabilityNote: "Directly comparable audit snapshot.",
      fingerprint: row.fingerprint,
      generatedAt: row.generated_at,
      competitors: JSON.parse(row.competitors_json),
      competitorCorpusSummaries: JSON.parse(row.corpus_summaries_json),
      summary: JSON.parse(row.summary_json),
      promptComparisons: JSON.parse(row.prompt_comparisons_json),
      intentComparisons: JSON.parse(row.intent_comparisons_json),
      opportunities: JSON.parse(row.opportunities_json),
      clientAdvantages: JSON.parse(row.client_advantages_json),
      providerObservationStatus: {
        availabilityState: "PROVIDER_EVIDENCE_UNAVAILABLE",
        totalObserved: 0,
        note: "Live search grounding is parked.",
      },
      disclaimer: row.disclaimer,
    };
  }
}
