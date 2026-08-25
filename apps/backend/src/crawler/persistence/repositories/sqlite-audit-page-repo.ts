/**
 * Phase 24: SQLite Audit Page Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { AuditPageEntity, AuditPageRepository } from "../types";

export class SQLiteAuditPageRepository implements AuditPageRepository {
  constructor(private db: DatabaseSync) {}

  async batchInsertPages(pages: AuditPageEntity[]): Promise<void> {
    if (pages.length === 0) return;

    this.db.exec("BEGIN TRANSACTION;");
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_pages (
          audit_page_id, audit_run_id, project_id, normalized_url, original_url,
          final_url, status_code, indexability, canonical_url, title,
          meta_description, h1_summary, content_hash, template_identity,
          crawl_depth, redirect_chain_json, response_metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const p of pages) {
        stmt.run(
          p.auditPageId,
          p.auditRunId,
          p.projectId,
          p.normalizedUrl,
          p.originalUrl,
          p.finalUrl,
          p.statusCode,
          p.indexability,
          p.canonicalUrl || null,
          p.title || null,
          p.metaDescription || null,
          p.h1Summary || null,
          p.contentHash || null,
          p.templateIdentity || null,
          p.crawlDepth || 0,
          p.redirectChain ? JSON.stringify(p.redirectChain) : null,
          p.responseMetadata ? JSON.stringify(p.responseMetadata) : null,
          p.createdAt || new Date().toISOString()
        );
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  async getPagesForAuditRun(auditRunId: string, limit = 500, offset = 0): Promise<AuditPageEntity[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_pages
      WHERE audit_run_id = ?
      ORDER BY crawl_depth ASC, normalized_url ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(auditRunId, limit, offset) as any[];
    return rows.map(this.mapRowToEntity);
  }

  async getPageByUrl(auditRunId: string, normalizedUrl: string): Promise<AuditPageEntity | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_pages
      WHERE audit_run_id = ? AND normalized_url = ?
      LIMIT 1
    `);
    const row = stmt.get(auditRunId, normalizedUrl) as any;
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  async getPageHistory(projectId: string, normalizedUrl: string): Promise<AuditPageEntity[]> {
    const stmt = this.db.prepare(`
      SELECT p.* FROM audit_pages p
      JOIN audit_runs r ON p.audit_run_id = r.audit_run_id
      WHERE p.project_id = ? AND p.normalized_url = ?
      ORDER BY r.sequence_number ASC
    `);
    const rows = stmt.all(projectId, normalizedUrl) as any[];
    return rows.map(this.mapRowToEntity);
  }

  private mapRowToEntity(row: any): AuditPageEntity {
    return {
      auditPageId: row.audit_page_id,
      auditRunId: row.audit_run_id,
      projectId: row.project_id,
      normalizedUrl: row.normalized_url,
      originalUrl: row.original_url,
      finalUrl: row.final_url,
      statusCode: row.status_code,
      indexability: row.indexability as "INDEXABLE" | "NON_INDEXABLE",
      canonicalUrl: row.canonical_url || undefined,
      title: row.title || undefined,
      metaDescription: row.meta_description || undefined,
      h1Summary: row.h1_summary || undefined,
      contentHash: row.content_hash || undefined,
      templateIdentity: row.template_identity || undefined,
      crawlDepth: row.crawl_depth,
      redirectChain: row.redirect_chain_json ? JSON.parse(row.redirect_chain_json) : undefined,
      responseMetadata: row.response_metadata_json ? JSON.parse(row.response_metadata_json) : undefined,
      createdAt: row.created_at,
    };
  }
}
