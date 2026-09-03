/**
 * SQLite AI Analysis Report Persistence Repository.
 * Stores generated AI executive reports, model telemetry, and entitlement metadata.
 * 
 * STRICT SECURITY:
 * Never stores API keys, Authorization headers, or raw environment variables.
 */

import { DatabaseSync } from "node:sqlite";
import { PersistedAIAnalysisRecord } from "./ai-report-types";

export class SqliteAiAnalysisReportRepository {
  constructor(private db: DatabaseSync) {}

  public saveReport(record: PersistedAIAnalysisRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_analysis_reports (
        report_id,
        project_id,
        audit_run_id,
        generated_at,
        provider,
        gateway,
        requested_model,
        resolved_model,
        input_tokens,
        output_tokens,
        total_tokens,
        estimated_cost_usd,
        latency_ms,
        entitlement_source,
        credits_consumed,
        generation_status,
        schema_version,
        report_payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.reportId,
      record.projectId,
      record.auditRunId,
      record.generatedAt,
      record.provider,
      record.gateway,
      record.requestedModel,
      record.resolvedModel || null,
      record.inputTokens,
      record.outputTokens,
      record.totalTokens,
      record.estimatedCostUsd,
      record.latencyMs,
      record.entitlementSource,
      record.creditsConsumed,
      record.generationStatus,
      record.schemaVersion,
      JSON.stringify(record.report),
      record.createdAt
    );
  }

  public getLatestReportForProject(projectId: string): PersistedAIAnalysisRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_analysis_reports
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId) as any;
    return row ? this.mapRowToRecord(row) : null;
  }

  public getReportForAuditRun(auditRunId: string): PersistedAIAnalysisRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM ai_analysis_reports
      WHERE audit_run_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(auditRunId) as any;
    return row ? this.mapRowToRecord(row) : null;
  }

  private mapRowToRecord(row: any): PersistedAIAnalysisRecord {
    return {
      reportId: row.report_id,
      projectId: row.project_id,
      auditRunId: row.audit_run_id,
      generatedAt: row.generated_at,
      provider: row.provider,
      gateway: row.gateway,
      requestedModel: row.requested_model,
      resolvedModel: row.resolved_model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      estimatedCostUsd: row.estimated_cost_usd,
      latencyMs: row.latency_ms,
      entitlementSource: row.entitlement_source,
      creditsConsumed: row.credits_consumed,
      generationStatus: row.generation_status,
      schemaVersion: row.schema_version,
      report: JSON.parse(row.report_payload_json || "{}"),
      createdAt: row.created_at,
    };
  }
}
