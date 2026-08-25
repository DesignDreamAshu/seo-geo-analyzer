/**
 * Phase 24: SQLite Database Connection Manager & Backup Engine.
 * Configures WAL mode, busy timeouts, foreign keys, local data directory, and safe backups.
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { runMigrations } from "./schema";
import { DatabaseHealthState } from "./types";

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

export function getDefaultDatabasePath(): string {
  // Check env variable first
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  // Default local data directory outside source control
  const localDataDir = path.resolve(process.cwd(), "local_data");
  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true });
  }
  return path.join(localDataDir, "dream_seo.db");
}

export function initializeDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance && currentDbPath === (dbPath || getDefaultDatabasePath())) {
    return dbInstance;
  }

  const targetPath = dbPath || getDefaultDatabasePath();
  currentDbPath = targetPath;

  if (targetPath !== ":memory:") {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // Configure SQLite production performance and safety settings
  if (targetPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");

  // Run migrations
  runMigrations(db);

  dbInstance = db;
  return db;
}

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    return initializeDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore if already closed
    }
    dbInstance = null;
    currentDbPath = null;
  }
}

export function getDatabaseHealth(): { state: DatabaseHealthState; path: string; schemaVersion: number } {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT MAX(version) as max_v FROM schema_migrations").get() as { max_v: number | null };
    return {
      state: "CONNECTED",
      path: currentDbPath || "UNKNOWN",
      schemaVersion: row?.max_v || 0,
    };
  } catch (err: any) {
    return {
      state: "ERROR",
      path: currentDbPath || "UNKNOWN",
      schemaVersion: 0,
    };
  }
}

export function createDatabaseBackup(backupDestinationPath: string): { success: boolean; bytesCopied: number; backupPath: string } {
  const db = getDatabase();
  if (currentDbPath === ":memory:") {
    throw new Error("Cannot backup an in-memory SQLite database to disk file via file copy.");
  }

  if (!currentDbPath || !fs.existsSync(currentDbPath)) {
    throw new Error("Database file does not exist on disk.");
  }

  // Ensure WAL is checkpointed before backup copy
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");

  const destDir = path.dirname(backupDestinationPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(currentDbPath, backupDestinationPath);
  const stats = fs.statSync(backupDestinationPath);

  return {
    success: true,
    bytesCopied: stats.size,
    backupPath: backupDestinationPath,
  };
}
