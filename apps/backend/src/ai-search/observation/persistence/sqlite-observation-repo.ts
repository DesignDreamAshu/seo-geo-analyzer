/**
 * Phase 28D: SQLite AI Observation Repository.
 * Stores runs, immutable point-in-time observations, mentions, and citations.
 */

import { DatabaseSync } from "node:sqlite";
import { AIObservation, ObservationRunSummary } from "../types";

export class SqliteObservationRepository {
  constructor(private db: DatabaseSync) {}

  public createObservationRun(run: ObservationRunSummary): void {
    const stmt = this.db.prepare(`
      INSERT INTO ai_observation_runs (
        run_id, project_id, status, config_json, knowledge_profile_version,
        prompt_universe_version, total_planned, completed, successful, failed,
        mention_rate, citation_rate, started_at, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.runId,
      run.projectId,
      run.status,
      JSON.stringify(run.config),
      run.knowledgeProfileVersion,
      run.promptUniverseVersion,
      run.totalPlannedObservations,
      run.completedObservations,
      run.successfulObservations,
      run.failedObservations,
      run.overallBrandMentionRate,
      run.ownDomainCitationRate,
      run.startedAt,
      run.completedAt || null,
      new Date().toISOString()
    );
  }

  public updateObservationRun(runId: string, updates: Partial<ObservationRunSummary>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.completedObservations !== undefined) {
      fields.push("completed = ?");
      values.push(updates.completedObservations);
    }
    if (updates.successfulObservations !== undefined) {
      fields.push("successful = ?");
      values.push(updates.successfulObservations);
    }
    if (updates.failedObservations !== undefined) {
      fields.push("failed = ?");
      values.push(updates.failedObservations);
    }
    if (updates.overallBrandMentionRate !== undefined) {
      fields.push("mention_rate = ?");
      values.push(updates.overallBrandMentionRate);
    }
    if (updates.ownDomainCitationRate !== undefined) {
      fields.push("citation_rate = ?");
      values.push(updates.ownDomainCitationRate);
    }
    if (updates.completedAt !== undefined) {
      fields.push("completed_at = ?");
      values.push(updates.completedAt);
    }

    if (fields.length === 0) return;

    values.push(runId);
    const sql = `UPDATE ai_observation_runs SET ${fields.join(", ")} WHERE run_id = ?`;
    this.db.prepare(sql).run(...values);
  }

  public getObservationRun(runId: string): ObservationRunSummary | null {
    const row = this.db.prepare("SELECT * FROM ai_observation_runs WHERE run_id = ?").get(runId) as any;
    if (!row) return null;
    return this.mapRunRow(row);
  }

  public listObservationRuns(projectId: string, limit: number = 20): ObservationRunSummary[] {
    const rows = this.db.prepare(
      "SELECT * FROM ai_observation_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?"
    ).all(projectId, limit) as any[];

    return rows.map((r) => this.mapRunRow(r));
  }

  public saveObservation(obs: AIObservation): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_observations (
        observation_id, run_id, project_id, prompt_id, cluster_id,
        prompt_text, prompt_type, intent, funnel_stage, specificity,
        brandedness, provider_id, model, run_number, status,
        failure_reason, raw_response, normalized_response, response_hash,
        brand_mentioned, brand_mention_count, brand_recommendation_order,
        own_domain_cited, own_domain_citation_count, mentions_json,
        competitors_json, citations_json, extractor_version, observed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      obs.observationId,
      obs.runId,
      obs.projectId,
      obs.promptId,
      obs.clusterId,
      obs.promptText,
      obs.promptType,
      obs.intent,
      obs.funnelStage,
      obs.specificity,
      obs.brandedness,
      obs.providerId,
      obs.model,
      obs.runNumber,
      obs.status,
      obs.failureReason || null,
      obs.rawResponse || null,
      obs.normalizedResponse || null,
      obs.responseHash || null,
      obs.brandMentioned ? 1 : 0,
      obs.brandMentionCount,
      obs.brandRecommendationOrder || null,
      obs.ownDomainCited ? 1 : 0,
      obs.ownDomainCitationCount,
      JSON.stringify(obs.brandMentions || []),
      JSON.stringify(obs.competitorsMentioned || []),
      JSON.stringify(obs.citations || []),
      obs.extractorVersion,
      obs.observedAt
    );
  }

  public saveObservationsBatch(observations: AIObservation[]): void {
    for (const obs of observations) {
      this.saveObservation(obs);
    }
  }

  public getObservationsForRun(runId: string): AIObservation[] {
    const rows = this.db.prepare(
      "SELECT * FROM ai_observations WHERE run_id = ? ORDER BY observed_at ASC"
    ).all(runId) as any[];

    return rows.map((r) => this.mapObservationRow(r));
  }

  public getObservationById(observationId: string): AIObservation | null {
    const row = this.db.prepare(
      "SELECT * FROM ai_observations WHERE observation_id = ? LIMIT 1"
    ).get(observationId) as any;

    if (!row) return null;
    return this.mapObservationRow(row);
  }

  public getObservationsForProject(projectId: string, limit: number = 500): AIObservation[] {
    const rows = this.db.prepare(
      "SELECT * FROM ai_observations WHERE project_id = ? ORDER BY observed_at DESC LIMIT ?"
    ).all(projectId, limit) as any[];

    return rows.map((r) => this.mapObservationRow(r));
  }

  private mapRunRow(row: any): ObservationRunSummary {
    return {
      runId: row.run_id,
      projectId: row.project_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      config: JSON.parse(row.config_json || "{}"),
      knowledgeProfileVersion: row.knowledge_profile_version,
      promptUniverseVersion: row.prompt_universe_version,
      totalPlannedObservations: row.total_planned,
      completedObservations: row.completed,
      successfulObservations: row.successful,
      failedObservations: row.failed,
      overallBrandMentionRate: row.mention_rate,
      unbrandedBrandMentionRate: row.mention_rate,
      brandedBrandMentionRate: 1.0,
      ownDomainCitationRate: row.citation_rate,
      activeProviders: [],
      promptSummaries: [],
    };
  }

  private mapObservationRow(row: any): AIObservation {
    return {
      observationId: row.observation_id,
      runId: row.run_id,
      projectId: row.project_id,
      promptId: row.prompt_id,
      clusterId: row.cluster_id,
      promptText: row.prompt_text,
      promptType: row.prompt_type,
      intent: row.intent,
      funnelStage: row.funnel_stage,
      specificity: row.specificity,
      brandedness: row.brandedness,
      providerId: row.provider_id,
      model: row.model,
      runNumber: row.run_number,
      totalRunsPlanned: 1,
      status: row.status,
      failureReason: row.failure_reason,
      rawResponse: row.raw_response,
      normalizedResponse: row.normalized_response,
      responseHash: row.response_hash,
      brandMentioned: Boolean(row.brand_mentioned),
      brandMentionCount: row.brand_mention_count,
      brandRecommendationOrder: row.brand_recommendation_order,
      brandMentions: JSON.parse(row.mentions_json || "[]"),
      competitorsMentioned: JSON.parse(row.competitors_json || "[]"),
      citations: JSON.parse(row.citations_json || "[]"),
      ownDomainCited: Boolean(row.own_domain_cited),
      ownDomainCitationCount: row.own_domain_citation_count,
      extractorVersion: row.extractor_version,
      observedAt: row.observed_at,
    };
  }
}
