/**
 * Phase 28D.1: SQLite AI Provider Certification Repository.
 * Stores timestamped certification runs, capabilities, and telemetry.
 * 
 * STRICT SECURITY:
 * Never stores API keys, auth headers, or raw environment variables.
 */

import { DatabaseSync } from "node:sqlite";
import { LiveProviderCertificationResult } from "./types";

export class SqliteProviderCertificationRepository {
  constructor(private db: DatabaseSync) {}

  public saveCertification(cert: LiveProviderCertificationResult): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ai_provider_certifications (
        certification_id,
        provider,
        gateway,
        requested_model_id,
        resolved_model_id,
        underlying_provider,
        timestamp,
        certification_version,
        authentication,
        connectivity,
        basic_completion,
        structured_output,
        usage_metadata,
        timeout_handling,
        error_normalization,
        dream_seo_contract_mapping,
        latency_ms,
        input_tokens,
        output_tokens,
        total_tokens,
        estimated_cost_usd,
        overall_result,
        failure_reason,
        declared_capabilities_json,
        verified_capabilities_json,
        verification_notes_json,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Ensure payload never contains secrets
    const safePayload = {
      level1Connectivity: cert.level1Connectivity,
      nativeStructuredOutput: cert.nativeStructuredOutput,
      promptGuidedJson: cert.promptGuidedJson,
      dreamSeoContract: cert.dreamSeoContract,
      requestedStructuredMode: cert.requestedStructuredMode,
      actualStructuredMode: cert.actualStructuredMode,
      fallbackUsed: cert.fallbackUsed,
      fallbackReason: cert.fallbackReason,
      finishReason: cert.finishReason,
      failureClassification: cert.failureClassification,
      diagnosticSampleResponse: cert.diagnosticSampleResponse,
    };

    stmt.run(
      cert.certificationId,
      cert.provider,
      cert.gateway,
      cert.requestedModelId,
      cert.resolvedModelId || null,
      cert.underlyingProvider || null,
      cert.timestamp,
      cert.certificationVersion,
      cert.authentication,
      cert.connectivity,
      cert.basicCompletion,
      cert.structuredOutput,
      cert.usageMetadata,
      cert.timeoutHandling,
      cert.errorNormalization,
      cert.dreamSeoContractMapping,
      cert.latencyMs,
      cert.inputTokens,
      cert.outputTokens,
      cert.totalTokens,
      cert.estimatedCostUsd,
      cert.overallResult,
      cert.failureReason || null,
      JSON.stringify(cert.declaredCapabilities || []),
      JSON.stringify(cert.verifiedCapabilities || []),
      JSON.stringify(cert.verificationNotes || []),
      JSON.stringify(safePayload),
      cert.timestamp
    );
  }

  public getLatestCertification(provider: string, modelId?: string): LiveProviderCertificationResult | null {
    let stmt;
    if (modelId) {
      stmt = this.db.prepare(`
        SELECT * FROM ai_provider_certifications
        WHERE provider = ? AND requested_model_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      const row = stmt.get(provider, modelId) as any;
      return row ? this.mapRowToResult(row) : null;
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM ai_provider_certifications
        WHERE provider = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      const row = stmt.get(provider) as any;
      return row ? this.mapRowToResult(row) : null;
    }
  }

  public listCertifications(provider?: string, limit = 50): LiveProviderCertificationResult[] {
    let stmt;
    if (provider) {
      stmt = this.db.prepare(`
        SELECT * FROM ai_provider_certifications
        WHERE provider = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const rows = stmt.all(provider, limit) as any[];
      return rows.map((r) => this.mapRowToResult(r));
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM ai_provider_certifications
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit) as any[];
      return rows.map((r) => this.mapRowToResult(r));
    }
  }

  private mapRowToResult(row: any): LiveProviderCertificationResult {
    const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    return {
      certificationId: row.certification_id,
      provider: row.provider,
      gateway: row.gateway,
      requestedModelId: row.requested_model_id,
      resolvedModelId: row.resolved_model_id,
      underlyingProvider: row.underlying_provider,
      timestamp: row.timestamp,
      certificationVersion: row.certification_version,
      level1Connectivity: payload.level1Connectivity || row.connectivity,
      nativeStructuredOutput: payload.nativeStructuredOutput || (row.structured_output === "PASS" ? "PASS" : "FAIL"),
      promptGuidedJson: payload.promptGuidedJson || "NOT_REQUIRED",
      dreamSeoContract: payload.dreamSeoContract || row.dream_seo_contract_mapping,
      requestedStructuredMode: payload.requestedStructuredMode || "native",
      actualStructuredMode: payload.actualStructuredMode || "native",
      fallbackUsed: Boolean(payload.fallbackUsed),
      fallbackReason: payload.fallbackReason || null,
      authentication: row.authentication,
      connectivity: row.connectivity,
      basicCompletion: row.basic_completion,
      structuredOutput: row.structured_output,
      usageMetadata: row.usage_metadata,
      timeoutHandling: row.timeout_handling,
      errorNormalization: row.error_normalization,
      dreamSeoContractMapping: row.dream_seo_contract_mapping,
      declaredCapabilities: JSON.parse(row.declared_capabilities_json || "[]"),
      verifiedCapabilities: JSON.parse(row.verified_capabilities_json || "[]"),
      verificationNotes: JSON.parse(row.verification_notes_json || "[]"),
      latencyMs: row.latency_ms,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      estimatedCostUsd: row.estimated_cost_usd,
      finishReason: payload.finishReason || null,
      overallResult: row.overall_result,
      failureClassification: payload.failureClassification || "NONE",
      failureReason: row.failure_reason,
      diagnosticSampleResponse: payload.diagnosticSampleResponse,
    };
  }
}
