/**
 * Phase 24: SQLite Project Repository Implementation.
 */

import { DatabaseSync } from "node:sqlite";
import { ProjectEntity, ProjectRepository, ProjectStatus } from "../types";
import { normalizeDomain } from "../fingerprint";

export class SQLiteProjectRepository implements ProjectRepository {
  constructor(private db: DatabaseSync) {}

  async createProject(project: Omit<ProjectEntity, "createdAt" | "updatedAt">): Promise<ProjectEntity> {
    const now = new Date().toISOString();
    const normalizedDomain = project.normalizedDomain || normalizeDomain(project.primaryDomain);

    const stmt = this.db.prepare(`
      INSERT INTO projects (
        project_id, name, primary_domain, normalized_domain, status,
        default_country, default_device, notes, latest_audit_run_id, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      project.projectId,
      project.name,
      project.primaryDomain,
      normalizedDomain,
      project.status || "ACTIVE",
      project.defaultCountry || null,
      project.defaultDevice || null,
      project.notes || null,
      project.latestAuditRunId || null,
      project.metadata ? JSON.stringify(project.metadata) : null,
      now,
      now
    );

    return {
      ...project,
      normalizedDomain,
      status: project.status || "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateProject(projectId: string, updates: Partial<ProjectEntity>): Promise<ProjectEntity> {
    const existing = await this.getProjectById(projectId);
    if (!existing) {
      throw new Error(`Project with ID ${projectId} not found.`);
    }

    const now = new Date().toISOString();
    const name = updates.name !== undefined ? updates.name : existing.name;
    const primaryDomain = updates.primaryDomain !== undefined ? updates.primaryDomain : existing.primaryDomain;
    const normalizedDomain = updates.normalizedDomain !== undefined ? updates.normalizedDomain : updates.primaryDomain ? normalizeDomain(updates.primaryDomain) : existing.normalizedDomain;
    const status = updates.status !== undefined ? updates.status : existing.status;
    const defaultCountry = updates.defaultCountry !== undefined ? updates.defaultCountry : existing.defaultCountry;
    const defaultDevice = updates.defaultDevice !== undefined ? updates.defaultDevice : existing.defaultDevice;
    const notes = updates.notes !== undefined ? updates.notes : existing.notes;
    const latestAuditRunId = updates.latestAuditRunId !== undefined ? updates.latestAuditRunId : existing.latestAuditRunId;
    const metadata = updates.metadata !== undefined ? updates.metadata : existing.metadata;

    const stmt = this.db.prepare(`
      UPDATE projects SET
        name = ?,
        primary_domain = ?,
        normalized_domain = ?,
        status = ?,
        default_country = ?,
        default_device = ?,
        notes = ?,
        latest_audit_run_id = ?,
        metadata_json = ?,
        updated_at = ?
      WHERE project_id = ?
    `);

    stmt.run(
      name,
      primaryDomain,
      normalizedDomain,
      status,
      defaultCountry || null,
      defaultDevice || null,
      notes || null,
      latestAuditRunId || null,
      metadata ? JSON.stringify(metadata) : null,
      now,
      projectId
    );

    return {
      projectId,
      name,
      primaryDomain,
      normalizedDomain,
      status,
      defaultCountry,
      defaultDevice,
      notes,
      latestAuditRunId,
      metadata,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  async getProjectById(projectId: string): Promise<ProjectEntity | null> {
    const stmt = this.db.prepare("SELECT * FROM projects WHERE project_id = ?");
    const row = stmt.get(projectId) as any;
    if (!row) return null;

    return {
      projectId: row.project_id,
      name: row.name,
      primaryDomain: row.primary_domain,
      normalizedDomain: row.normalized_domain,
      status: row.status as ProjectStatus,
      defaultCountry: row.default_country || undefined,
      defaultDevice: row.default_device || undefined,
      notes: row.notes || undefined,
      latestAuditRunId: row.latest_audit_run_id || undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getProjectByDomain(domain: string): Promise<ProjectEntity | null> {
    const normalized = normalizeDomain(domain);
    const stmt = this.db.prepare("SELECT * FROM projects WHERE normalized_domain = ? LIMIT 1");
    const row = stmt.get(normalized) as any;
    if (!row) return null;

    return {
      projectId: row.project_id,
      name: row.name,
      primaryDomain: row.primary_domain,
      normalizedDomain: row.normalized_domain,
      status: row.status as ProjectStatus,
      defaultCountry: row.default_country || undefined,
      defaultDevice: row.default_device || undefined,
      notes: row.notes || undefined,
      latestAuditRunId: row.latest_audit_run_id || undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listProjects(status?: ProjectStatus): Promise<ProjectEntity[]> {
    let stmt;
    if (status) {
      stmt = this.db.prepare("SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC");
      return (stmt.all(status) as any[]).map(this.mapRowToEntity);
    } else {
      stmt = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC");
      return (stmt.all() as any[]).map(this.mapRowToEntity);
    }
  }

  async archiveProject(projectId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare("UPDATE projects SET status = 'ARCHIVED', updated_at = ? WHERE project_id = ?");
    stmt.run(now, projectId);
    return true;
  }

  private mapRowToEntity(row: any): ProjectEntity {
    return {
      projectId: row.project_id,
      name: row.name,
      primaryDomain: row.primary_domain,
      normalizedDomain: row.normalized_domain,
      status: row.status as ProjectStatus,
      defaultCountry: row.default_country || undefined,
      defaultDevice: row.default_device || undefined,
      notes: row.notes || undefined,
      latestAuditRunId: row.latest_audit_run_id || undefined,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
