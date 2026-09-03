/**
 * Dream SEO — Real Live End-to-End AI Report Verification Script.
 * Executes live generation against a real existing project & audit in the database.
 */

import { getDatabase } from "../../crawler/persistence/db";
import { AIReportGenerator, AI_REPORT_SCHEMA_VERSION } from "../reporting/ai-report-generator";
import { SqliteAiAnalysisReportRepository } from "../reporting/ai-report-persistence";
import { OpenRouterProviderAdapter } from "../observation/adapters/openrouter-adapter";
import { globalAIEntitlementService } from "../entitlement/ai-entitlement-service";

async function runLiveE2E() {
  console.log("\n==================================================================================");
  console.log("DREAM SEO — USER-FACING LIVE AI EXECUTIVE REPORT END-TO-END VERIFICATION");
  console.log("==================================================================================\n");

  const db = getDatabase();
  const repo = new SqliteAiAnalysisReportRepository(db);
  const adapter = new OpenRouterProviderAdapter();
  const generator = new AIReportGenerator(adapter, repo);

  // 1. Target Real Existing Project & Audit
  const projectId = "proj_botconsulting";
  const project = db.prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId) as any;
  if (!project) {
    throw new Error(`Target project ${projectId} not found in database.`);
  }

  const latestAudit = db.prepare(
    "SELECT * FROM audit_runs WHERE project_id = ? AND status = 'COMPLETED' ORDER BY created_at DESC LIMIT 1"
  ).get(projectId) as any;
  if (!latestAudit) {
    throw new Error(`No completed audit found for project ${projectId}.`);
  }

  const snapshot = db.prepare("SELECT * FROM audit_snapshots WHERE audit_run_id = ?").get(latestAudit.audit_run_id) as any;
  if (!snapshot) {
    throw new Error(`Audit snapshot for ${latestAudit.audit_run_id} not found.`);
  }

  const payload = JSON.parse(snapshot.payload_json);
  const siteAudit = payload.crawlResult || payload.siteAudit || payload;

  console.log(`[E2E Step 1] Loaded Real Project: "${project.name}" (${project.primary_domain})`);
  console.log(`[E2E Step 2] Loaded Real Completed Audit: ${latestAudit.audit_run_id}`);
  console.log(`             Health Score: ${siteAudit.healthScore}/100, Issues: ${siteAudit.issues?.length || 0}`);

  // 2. Verify Dev Entitlement Bypass
  const entitlement = await globalAIEntitlementService.checkAiReportAccess("live_tester", projectId);
  console.log(`[E2E Step 3] Entitlement Check:`, entitlement);
  if (!entitlement.allowed || entitlement.source !== "DEV_BYPASS") {
    throw new Error(`Expected DEV_BYPASS entitlement but got: ${JSON.stringify(entitlement)}`);
  }

  // 3. Select Live Certified Model
  const modelToUse = process.env.DREAMSEO_AI_MODEL || "minimax/minimax-m3:free";
  console.log(`[E2E Step 4] Invoking Live Certified Model: "${modelToUse}" via OpenRouter...`);

  const startTime = Date.now();
  const result = await generator.generateReport(
    projectId,
    latestAudit.audit_run_id,
    siteAudit,
    "live_tester",
    modelToUse
  );
  const totalElapsed = Date.now() - startTime;

  if (!result.success || !result.record) {
    console.error(`❌ Live Generation Failed:`, result.error);
    process.exit(1);
  }

  const rec = result.record;
  const report = rec.report;

  console.log(`\n✅ [E2E Step 5] Real Provider Returned Successfully!`);
  console.log(`   Report ID: ${rec.reportId}`);
  console.log(`   Requested Model: ${rec.requestedModel}`);
  console.log(`   Resolved Model: ${rec.resolvedModel}`);
  console.log(`   Tokens: ${rec.inputTokens} prompt + ${rec.outputTokens} completion = ${rec.totalTokens} total`);
  console.log(`   Provider Latency: ${rec.latencyMs}ms (Total elapsed: ${totalElapsed}ms)`);
  console.log(`   Estimated Cost: $${rec.estimatedCostUsd}`);
  console.log(`   Entitlement Source: ${rec.entitlementSource} (Credits consumed: ${rec.creditsConsumed})`);

  console.log(`\n==================================================================================`);
  console.log(`STRUCTURED AI EXECUTIVE REPORT CONTENT PREVIEW:`);
  console.log(`==================================================================================`);
  console.log(`Health Band: ${report.healthBand || "N/A"}`);
  console.log(`Executive Summary:\n  ${report.executiveSummary}\n`);
  console.log(`Top Strategic Priorities (${report.topPriorities?.length || 0}):`);
  report.topPriorities?.forEach((p: any, idx: number) => {
    console.log(`  ${idx + 1}. [${p.expectedImpact} Impact / ${p.difficulty}] ${p.title}`);
    console.log(`     Action: ${p.recommendedAction}`);
  });
  console.log(`\nQuick Wins (${report.quickWins?.length || 0}):`);
  report.quickWins?.forEach((qw: any, idx: number) => {
    console.log(`  - [${qw.effort}] ${qw.title}: ${qw.action}`);
  });

  // 4. Verify SQLite Persistence & Reopen Without Provider Call
  console.log(`\n[E2E Step 6] Verifying Reopen / Freshness from SQLite...`);
  const status = generator.getLatestReportStatus(projectId, latestAudit.audit_run_id);
  if (!status.hasReport || !status.record || status.isStale) {
    throw new Error(`Failed to retrieve fresh persisted report from SQLite.`);
  }
  console.log(`✅ Persisted report successfully retrieved from SQLite without new provider call (isStale: ${status.isStale})`);

  // 5. Secret Leakage Verification
  console.log(`\n[E2E Step 7] Verifying Secret Safety...`);
  const rawRow = db.prepare("SELECT * FROM ai_analysis_reports WHERE report_id = ?").get(rec.reportId) as any;
  const rawRowStr = JSON.stringify(rawRow);
  const hasKeyLeak = rawRowStr.includes("sk-or") || rawRowStr.includes("Authorization");
  if (hasKeyLeak) {
    throw new Error("CRITICAL SECURITY DEFECT: API key or Authorization header leaked in database row!");
  }
  console.log(`✅ Zero credentials or Authorization headers found in SQLite persistence or report output.`);

  console.log("\n==================================================================================");
  console.log("USER-FACING LIVE AI REPORT E2E: PASS");
  console.log("==================================================================================\n");
}

runLiveE2E().catch((err) => {
  console.error("FATAL ERROR in Live E2E test:", err);
  process.exit(1);
});
