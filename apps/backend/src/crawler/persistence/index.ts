/**
 * Phase 24: Local SQLite Project Persistence & Audit History Factory.
 * Exports repository instances, SQLite connection utilities, comparison engines, and schema runners.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { getDatabase, initializeDatabase, closeDatabase, getDatabaseHealth, createDatabaseBackup } from "./db";
import { runMigrations } from "./schema";
import { SQLiteProjectRepository } from "./repositories/sqlite-project-repo";
import { SQLiteAuditRunRepository } from "./repositories/sqlite-audit-run-repo";
import { SQLiteAuditPageRepository } from "./repositories/sqlite-audit-page-repo";
import { SQLiteAuditFindingRepository } from "./repositories/sqlite-audit-finding-repo";
import { SQLiteAuditMetricRepository } from "./repositories/sqlite-audit-metric-repo";
import { SQLiteAuditComparisonRepository } from "./repositories/sqlite-audit-comparison-repo";
import { SQLiteAuditSnapshotRepository } from "./repositories/sqlite-audit-snapshot-repo";
import { SQLiteSecuritySnapshotRepository } from "../security/history/sqlite-security-snapshot-repo";

export * from "./types";
export * from "./schema";
export * from "./db";
export * from "./fingerprint";
export * from "./comparison-engine";
export * from "./historical-report";
export * from "./crawler-persistence-bridge";
export * from "../security/history/types";
export * from "../security/history/sqlite-security-snapshot-repo";
export * from "../security/history/security-history-engine";
export * from "../security/history/security-fix-verifier";

export interface PersistenceLayer {
  db: DatabaseSync;
  projects: SQLiteProjectRepository;
  auditRuns: SQLiteAuditRunRepository;
  auditPages: SQLiteAuditPageRepository;
  auditFindings: SQLiteAuditFindingRepository;
  auditMetrics: SQLiteAuditMetricRepository;
  auditComparisons: SQLiteAuditComparisonRepository;
  auditSnapshots: SQLiteAuditSnapshotRepository;
  securitySnapshots: SQLiteSecuritySnapshotRepository;
}

export function createPersistenceLayer(customDb?: DatabaseSync | string): PersistenceLayer {
  let db: DatabaseSync;
  if (typeof customDb === "string") {
    if (customDb === ":memory:") {
      db = new DatabaseSync(":memory:");
      db.exec("PRAGMA foreign_keys = ON;");
      runMigrations(db);
    } else {
      const parentDir = path.dirname(customDb);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      db = new DatabaseSync(customDb);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec("PRAGMA busy_timeout = 5000;");
      runMigrations(db);
    }
  } else if (customDb) {
    db = customDb;
    runMigrations(db);
  } else {
    db = getDatabase();
  }

  return {
    db,
    projects: new SQLiteProjectRepository(db),
    auditRuns: new SQLiteAuditRunRepository(db),
    auditPages: new SQLiteAuditPageRepository(db),
    auditFindings: new SQLiteAuditFindingRepository(db),
    auditMetrics: new SQLiteAuditMetricRepository(db),
    auditComparisons: new SQLiteAuditComparisonRepository(db),
    auditSnapshots: new SQLiteAuditSnapshotRepository(db),
    securitySnapshots: new SQLiteSecuritySnapshotRepository(db),
  };
}
