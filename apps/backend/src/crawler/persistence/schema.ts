/**
 * Phase 24: Database Schema & Migration Engine.
 * Provides deterministic, versioned DDL migrations compatible with SQLite and portable to PostgreSQL.
 */

import { DatabaseSync } from "node:sqlite";

export interface MigrationDefinition {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: MigrationDefinition[] = [
  {
    version: 1,
    name: "001_initial_schema",
    up: (db: DatabaseSync) => {
      // 1. Projects table
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          project_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          primary_domain TEXT NOT NULL,
          normalized_domain TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          default_country TEXT,
          default_device TEXT,
          notes TEXT,
          latest_audit_run_id TEXT,
          metadata_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_projects_normalized_domain ON projects(normalized_domain);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      `);

      // 2. Audit Runs table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_runs (
          audit_run_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          sequence_number INTEGER NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          status TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          crawler_version TEXT NOT NULL,
          rule_inventory_version TEXT NOT NULL,
          production_rule_count INTEGER NOT NULL,
          policy_versions_json TEXT NOT NULL,
          configuration_snapshot_json TEXT NOT NULL,
          summary_stats_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_runs_project_seq ON audit_runs(project_id, sequence_number DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_runs_project_status ON audit_runs(project_id, status);
        CREATE INDEX IF NOT EXISTS idx_audit_runs_created_at ON audit_runs(created_at DESC);
      `);

      // 3. Audit Pages table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_pages (
          audit_page_id TEXT PRIMARY KEY,
          audit_run_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          normalized_url TEXT NOT NULL,
          original_url TEXT NOT NULL,
          final_url TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          indexability TEXT NOT NULL,
          canonical_url TEXT,
          title TEXT,
          meta_description TEXT,
          h1_summary TEXT,
          content_hash TEXT,
          template_identity TEXT,
          crawl_depth INTEGER NOT NULL DEFAULT 0,
          redirect_chain_json TEXT,
          response_metadata_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (audit_run_id) REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_pages_run_id ON audit_pages(audit_run_id);
        CREATE INDEX IF NOT EXISTS idx_audit_pages_project_url ON audit_pages(project_id, normalized_url);
      `);

      // 4. Audit Findings table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_findings (
          audit_finding_id TEXT PRIMARY KEY,
          audit_run_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          audit_page_id TEXT,
          rule_id TEXT NOT NULL,
          severity TEXT NOT NULL,
          finding_state TEXT NOT NULL,
          message TEXT NOT NULL,
          evidence_json TEXT NOT NULL,
          normalized_url TEXT NOT NULL,
          finding_fingerprint TEXT NOT NULL,
          target_resource TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (audit_run_id) REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_findings_run_id ON audit_findings(audit_run_id);
        CREATE INDEX IF NOT EXISTS idx_audit_findings_project_fingerprint ON audit_findings(project_id, finding_fingerprint);
        CREATE INDEX IF NOT EXISTS idx_audit_findings_project_rule ON audit_findings(project_id, rule_id);
        CREATE INDEX IF NOT EXISTS idx_audit_findings_project_url ON audit_findings(project_id, normalized_url);
      `);

      // 5. Audit Metrics table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_metrics (
          metric_id TEXT PRIMARY KEY,
          audit_run_id TEXT NOT NULL UNIQUE,
          project_id TEXT NOT NULL,
          pages_crawled INTEGER NOT NULL,
          pages_indexable INTEGER NOT NULL,
          total_findings INTEGER NOT NULL,
          critical_count INTEGER NOT NULL,
          high_count INTEGER NOT NULL,
          medium_count INTEGER NOT NULL,
          low_count INTEGER NOT NULL,
          informational_count INTEGER NOT NULL,
          seo_score REAL,
          category_scores_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (audit_run_id) REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_metrics_project_created ON audit_metrics(project_id, created_at DESC);
      `);

      // 6. Audit Comparisons table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_comparisons (
          comparison_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          baseline_audit_run_id TEXT NOT NULL,
          current_audit_run_id TEXT NOT NULL,
          baseline_sequence_number INTEGER NOT NULL,
          current_sequence_number INTEGER NOT NULL,
          computed_at TEXT NOT NULL,
          previous_issue_count INTEGER NOT NULL,
          current_issue_count INTEGER NOT NULL,
          fixed_count INTEGER NOT NULL,
          new_count INTEGER NOT NULL,
          unchanged_count INTEGER NOT NULL,
          reopened_count INTEGER NOT NULL,
          changed_count INTEGER NOT NULL,
          severity_increased_count INTEGER NOT NULL,
          severity_decreased_count INTEGER NOT NULL,
          uncomparable_count INTEGER NOT NULL,
          page_changes_json TEXT NOT NULL,
          rule_summaries_json TEXT NOT NULL,
          finding_diffs_json TEXT NOT NULL,
          metric_changes_json TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_comparisons_project ON audit_comparisons(project_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_comparisons_pair ON audit_comparisons(baseline_audit_run_id, current_audit_run_id);
      `);

      // 7. Audit Snapshots table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_snapshots (
          snapshot_id TEXT PRIMARY KEY,
          audit_run_id TEXT NOT NULL UNIQUE,
          project_id TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          immutability_statement TEXT NOT NULL DEFAULT 'RUNTIME_IMMUTABLE_FREEZE',
          created_at TEXT NOT NULL,
          FOREIGN KEY (audit_run_id) REFERENCES audit_runs(audit_run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_snapshots_project ON audit_snapshots(project_id);
      `);
    },
  },
  {
    version: 2,
    name: "002_ai_visibility_observations",
    up: (db: DatabaseSync) => {
      // 1. AI Observation Runs table
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_observation_runs (
          run_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          status TEXT NOT NULL,
          config_json TEXT NOT NULL,
          knowledge_profile_version TEXT NOT NULL,
          prompt_universe_version TEXT NOT NULL,
          total_planned INTEGER NOT NULL,
          completed INTEGER NOT NULL,
          successful INTEGER NOT NULL,
          failed INTEGER NOT NULL,
          mention_rate REAL NOT NULL DEFAULT 0.0,
          citation_rate REAL NOT NULL DEFAULT 0.0,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ai_runs_project_created ON ai_observation_runs(project_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_observation_runs(status);
      `);

      // 2. AI Observations table (Immutable point-in-time raw responses & structured extractions)
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_observations (
          observation_id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          prompt_id TEXT NOT NULL,
          cluster_id TEXT NOT NULL,
          prompt_text TEXT NOT NULL,
          prompt_type TEXT NOT NULL,
          intent TEXT NOT NULL,
          funnel_stage TEXT NOT NULL,
          specificity TEXT NOT NULL,
          brandedness TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          model TEXT NOT NULL,
          run_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          failure_reason TEXT,
          raw_response TEXT,
          normalized_response TEXT,
          response_hash TEXT,
          brand_mentioned INTEGER NOT NULL DEFAULT 0,
          brand_mention_count INTEGER NOT NULL DEFAULT 0,
          brand_recommendation_order INTEGER,
          own_domain_cited INTEGER NOT NULL DEFAULT 0,
          own_domain_citation_count INTEGER NOT NULL DEFAULT 0,
          mentions_json TEXT,
          competitors_json TEXT,
          citations_json TEXT,
          extractor_version TEXT NOT NULL,
          observed_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES ai_observation_runs(run_id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ai_obs_run ON ai_observations(run_id);
        CREATE INDEX IF NOT EXISTS idx_ai_obs_project ON ai_observations(project_id);
        CREATE INDEX IF NOT EXISTS idx_ai_obs_prompt ON ai_observations(prompt_id);
        CREATE INDEX IF NOT EXISTS idx_ai_obs_provider ON ai_observations(provider_id);
        CREATE INDEX IF NOT EXISTS idx_ai_obs_brandedness ON ai_observations(brandedness);
      `);
    },
  },
  {
    version: 3,
    name: "003_ai_visibility_analytics_snapshots",
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_visibility_analytics_snapshots (
          snapshot_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          metric_version TEXT NOT NULL,
          certification_status TEXT NOT NULL DEFAULT 'PENDING',
          is_test_data INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (run_id) REFERENCES ai_observation_runs(run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ai_analytics_project ON ai_visibility_analytics_snapshots(project_id, generated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ai_analytics_run ON ai_visibility_analytics_snapshots(run_id);
      `);
    },
  },
  {
    version: 4,
    name: "004_ai_citation_intelligence_snapshots",
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_citation_intelligence_snapshots (
          snapshot_id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          version TEXT NOT NULL,
          certification_status TEXT NOT NULL DEFAULT 'PENDING',
          is_test_data INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (run_id) REFERENCES ai_observation_runs(run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ai_citation_project ON ai_citation_intelligence_snapshots(project_id, generated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ai_citation_run ON ai_citation_intelligence_snapshots(run_id);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): { currentVersion: number; appliedCount: number } {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY version ASC").all() as { version: number }[];
  const appliedVersions = new Set(rows.map((r) => r.version));

  let appliedCount = 0;
  for (const mig of MIGRATIONS) {
    if (!appliedVersions.has(mig.version)) {
      mig.up(db);
      const insert = db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");
      insert.run(mig.version, mig.name, new Date().toISOString());
      appliedCount += 1;
    }
  }

  const latestRow = db.prepare("SELECT MAX(version) as max_v FROM schema_migrations").get() as { max_v: number | null };
  return {
    currentVersion: latestRow?.max_v || 0,
    appliedCount,
  };
}
