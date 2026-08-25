/**
 * Master Phase 1–24 Full Synchronous Regression Runner.
 * Executes all test suites across all 24 phases, diagnostic rules, remediation contracts, and invariants.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const PHASE_MAP: Record<string, string> = {
  "performance": "Phase 7: Performance / Core Web Vitals",
  "gsc": "Phase 8: Google Search Console Intelligence",
  "ai-search": "Phase 9: AEO / GEO Intelligence",
  "monitoring": "Phase 10: Regression Monitoring & Lifecycle",
  "opportunity": "Phase 11: Opportunity & Action Planning",
  "content-demand": "Phase 12: Content Demand & Cannibalization",
  "competitor-serp": "Phase 13: Competitor & SERP Intelligence",
  "backlinks": "Phase 14: Backlink & Off-Page Intelligence",
  "local-seo": "Phase 15: Local SEO Intelligence",
  "international-seo": "Phase 16: International SEO & Hreflang",
  "migration": "Phase 17: Site Migration & Replatforming",
  "server-logs": "Phase 18: Server Log & Crawl Budget Intelligence",
  "indexation": "Phase 19: Indexation Lifecycle & Canonical Graph",
  "forecasting": "Phase 20: Impact Forecasting & Scenario Modeling",
  "content-lifecycle": "Phase 21: Content Decay, Refresh & Consolidation",
  "experimentation": "Phase 22: SEO Experimentation & Causal Impact",
  "automation": "Phase 23: Autonomous-but-Safe SEO Operations",
  "persistence": "Phase 24: Local Persistence & Audit History",
  "verification": "Core: Remediation Contract, QA & Invariants",
  "fix-intelligence": "Core: Fix Intelligence (95/95 Handlers)",
  "scope-completion": "Core: Scope Completion",
};

function getTestFilesInDir(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getTestFilesInDir(full));
    } else if (file.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  console.log("========================================================================");
  console.log("DREAM SEO — FULL MASTER SYNCHRONOUS PHASE 1–24 REGRESSION HARNESS");
  console.log("========================================================================\n");

  const cwd = process.cwd();
  const crawlerDir = path.join(cwd, "src/crawler");

  let totalSuites = 0;
  let passedSuites = 0;
  let failedSuites = 0;

  const summaryReport: { phaseName: string; total: number; passed: number; failed: number }[] = [];

  const orderedKeys = [
    "performance",
    "gsc",
    "ai-search",
    "monitoring",
    "opportunity",
    "content-demand",
    "competitor-serp",
    "backlinks",
    "local-seo",
    "international-seo",
    "migration",
    "server-logs",
    "indexation",
    "forecasting",
    "content-lifecycle",
    "experimentation",
    "automation",
    "persistence",
    "verification",
    "fix-intelligence",
    "scope-completion",
  ];

  for (const key of orderedKeys) {
    const targetDir = path.join(crawlerDir, key);
    const files = getTestFilesInDir(targetDir).sort();
    if (files.length === 0) continue;

    const phaseName = PHASE_MAP[key] || key;
    console.log(`\n--- Running [${phaseName}] (${files.length} test suites) ---`);
    let phasePassed = 0;
    let phaseFailed = 0;

    for (const file of files) {
      const base = path.basename(file);
      totalSuites++;
      try {
        execSync(`npx tsx "${file}"`, {
          cwd,
          stdio: "pipe",
          timeout: 45000,
          env: {
            ...process.env,
            PATH: "f:\\Work\\Dream SEO\\node22_env\\node-v22.14.0-win-x64;" + process.env.PATH,
          },
        });
        passedSuites++;
        phasePassed++;
        console.log(`  ✓ ${base}`);
      } catch (err: any) {
        failedSuites++;
        phaseFailed++;
        console.error(`  ✗ ${base} FAILED`);
        console.error(err.stdout?.toString() || err.stderr?.toString() || err.message);
      }
    }

    summaryReport.push({
      phaseName,
      total: files.length,
      passed: phasePassed,
      failed: phaseFailed,
    });
  }

  console.log("\n========================================================================");
  console.log("FULL PHASE 1–24 REGRESSION MATRIX SUMMARY:");
  console.log("========================================================================");
  for (const rep of summaryReport) {
    const status = rep.failed === 0 ? "PASSED (100%)" : `FAILED (${rep.failed} failed)`;
    console.log(`${rep.phaseName.padEnd(52)} : ${rep.passed}/${rep.total} suites ${status}`);
  }

  console.log("========================================================================");
  console.log(`TOTAL TEST SUITES EXECUTED : ${totalSuites}`);
  console.log(`TOTAL TEST SUITES PASSED   : ${passedSuites}`);
  console.log(`TOTAL TEST SUITES FAILED   : ${failedSuites}`);
  console.log(`FINAL REGRESSION STATUS    : ${failedSuites === 0 ? "100% CLEAN SUCCESS" : "FAILED"}`);
  console.log("========================================================================");

  if (failedSuites > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL MASTER REGRESSION RUNNER ERROR:", err);
  process.exit(1);
});
