/**
 * SQLite Security Snapshot & Verification Event Repository (SECURITY S7).
 * Implements immutable persistence, version tracking, and safe retrieval.
 */

import { DatabaseSync } from "node:sqlite";
import type {
  SecurityAuditSnapshotEntity,
  SecurityVerificationEventEntity,
} from "./types";
import type { SecurityAuditViewModel } from "../scoring/score-types";

export interface SecuritySnapshotRepository {
  saveSnapshot(snapshot: SecurityAuditSnapshotEntity): Promise<void>;
  getSnapshotByAuditRunId(auditRunId: string): Promise<SecurityAuditSnapshotEntity | null>;
  listSnapshotsForProject(projectId: string, limit?: number): Promise<SecurityAuditSnapshotEntity[]>;
  getLatestSnapshotForProject(projectId: string): Promise<SecurityAuditSnapshotEntity | null>;
  
  saveVerificationEvent(event: SecurityVerificationEventEntity): Promise<void>;
  listVerificationEventsForFinding(projectId: string, findingId: string): Promise<SecurityVerificationEventEntity[]>;
  listVerificationEventsForProject(projectId: string, limit?: number): Promise<SecurityVerificationEventEntity[]>;
}

export function sanitizeSecurityPayloadBeforePersistence(payload: SecurityAuditViewModel): SecurityAuditViewModel {
  if (!payload) return payload;
  const sanitized = JSON.parse(JSON.stringify(payload));

  // 1. Findings evidence sanitization
  if (Array.isArray(sanitized.findings)) {
    for (const finding of sanitized.findings) {
      if (finding.evidence) {
        const sensitiveKeys = [
          "password", "secret", "token", "apiKey", "credential", "authHeader",
          "privateKey", "accessToken", "refreshToken", "sessionToken", "bearerToken",
          "rawEnv", "rawGitConfig", "envContent", "gitConfigContent", "responseBody",
        ];
        for (const k of sensitiveKeys) {
          if (finding.evidence[k] !== undefined) {
            finding.evidence[k] = "[REDACTED]";
          }
        }
        if (typeof finding.evidence.observed === "string" && (
          finding.evidence.observed.includes("SECRET") ||
          finding.evidence.observed.includes("PASSWORD") ||
          finding.evidence.observed.includes("API_KEY") ||
          finding.evidence.observed.includes("TOKEN")
        )) {
          finding.evidence.observed = "[REDACTED_SENSITIVE_EVIDENCE]";
        }
      }
    }
  }

  // 2. Strict omission of security.txt.rawText
  if (sanitized.securityTxt && "rawText" in sanitized.securityTxt) {
    delete sanitized.securityTxt.rawText;
  }

  return sanitized;
}

export class SQLiteSecuritySnapshotRepository implements SecuritySnapshotRepository {
  constructor(private db: DatabaseSync) {}

  async saveSnapshot(snapshot: SecurityAuditSnapshotEntity): Promise<void> {
    const sanitizedPayload = sanitizeSecurityPayloadBeforePersistence(snapshot.payload);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO security_audit_snapshots (
        snapshot_id,
        audit_run_id,
        project_id,
        domain,
        started_at,
        completed_at,
        security_schema_version,
        rule_catalog_version,
        score_policy_version,
        remediation_contract_version,
        score,
        posture_band,
        critical_count,
        high_count,
        medium_count,
        low_count,
        informational_count,
        manual_areas_count,
        tests_executed,
        passed_controls,
        total_rules_registered,
        requested_crawl_limit,
        discovered_page_count,
        actual_crawled_page_count,
        is_partial_audit,
        payload_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.snapshotId,
      snapshot.auditRunId,
      snapshot.projectId,
      snapshot.domain,
      snapshot.startedAt,
      snapshot.completedAt || null,
      snapshot.securitySchemaVersion,
      snapshot.ruleCatalogVersion,
      snapshot.scorePolicyVersion,
      snapshot.remediationContractVersion,
      snapshot.score,
      snapshot.postureBand,
      snapshot.criticalCount,
      snapshot.highCount,
      snapshot.mediumCount,
      snapshot.lowCount,
      snapshot.informationalCount,
      snapshot.manualAreasCount,
      snapshot.testsExecuted,
      snapshot.passedControls,
      snapshot.totalRulesRegistered,
      snapshot.requestedCrawlLimit ?? null,
      snapshot.discoveredPageCount ?? null,
      snapshot.actualCrawledPageCount ?? null,
      snapshot.isPartialAudit ? 1 : 0,
      JSON.stringify(sanitizedPayload),
      snapshot.createdAt
    );
  }

  async getSnapshotByAuditRunId(auditRunId: string): Promise<SecurityAuditSnapshotEntity | null> {
    const stmt = this.db.prepare("SELECT * FROM security_audit_snapshots WHERE audit_run_id = ?");
    const row = stmt.get(auditRunId) as any;
    if (!row) return null;
    return this.mapRowToSnapshot(row);
  }

  async listSnapshotsForProject(projectId: string, limit = 100): Promise<SecurityAuditSnapshotEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM security_audit_snapshots
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(projectId, limit) as any[];
    return rows.map((r) => this.mapRowToSnapshot(r));
  }

  async getLatestSnapshotForProject(projectId: string): Promise<SecurityAuditSnapshotEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM security_audit_snapshots
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId) as any;
    if (!row) return null;
    return this.mapRowToSnapshot(row);
  }

  async saveVerificationEvent(event: SecurityVerificationEventEntity): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO security_verification_events (
        event_id,
        project_id,
        source_audit_id,
        finding_id,
        rule_id,
        target_url,
        started_at,
        completed_at,
        method,
        scope,
        result,
        evidence_summary,
        error_message,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.eventId,
      event.projectId,
      event.sourceAuditId,
      event.findingId,
      event.ruleId,
      event.targetUrl || null,
      event.startedAt,
      event.completedAt,
      event.method,
      event.scope,
      event.result,
      event.evidenceSummary,
      event.errorMessage || null,
      event.createdAt
    );
  }

  async listVerificationEventsForFinding(projectId: string, findingId: string): Promise<SecurityVerificationEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM security_verification_events
      WHERE project_id = ? AND finding_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(projectId, findingId) as any[];
    return rows.map((r) => this.mapRowToEvent(r));
  }

  async listVerificationEventsForProject(projectId: string, limit = 100): Promise<SecurityVerificationEventEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM security_verification_events
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(projectId, limit) as any[];
    return rows.map((r) => this.mapRowToEvent(r));
  }

  private mapRowToSnapshot(row: any): SecurityAuditSnapshotEntity {
    let payload: SecurityAuditViewModel;
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      payload = {} as any;
    }

    return {
      snapshotId: row.snapshot_id,
      auditRunId: row.audit_run_id,
      projectId: row.project_id,
      domain: row.domain,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      securitySchemaVersion: row.security_schema_version,
      ruleCatalogVersion: row.rule_catalog_version,
      scorePolicyVersion: row.score_policy_version,
      remediationContractVersion: row.remediation_contract_version,
      score: row.score,
      postureBand: row.posture_band,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      informationalCount: row.informational_count,
      manualAreasCount: row.manual_areas_count,
      testsExecuted: row.tests_executed,
      passedControls: row.passed_controls,
      totalRulesRegistered: row.total_rules_registered,
      requestedCrawlLimit: row.requested_crawl_limit,
      discoveredPageCount: row.discovered_page_count,
      actualCrawledPageCount: row.actual_crawled_page_count,
      isPartialAudit: Boolean(row.is_partial_audit),
      payload,
      createdAt: row.created_at,
    };
  }

  private mapRowToEvent(row: any): SecurityVerificationEventEntity {
    return {
      eventId: row.event_id,
      projectId: row.project_id,
      sourceAuditId: row.source_audit_id,
      findingId: row.finding_id,
      ruleId: row.rule_id,
      targetUrl: row.target_url,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      method: row.method,
      scope: row.scope,
      result: row.result,
      evidenceSummary: row.evidence_summary,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
}
