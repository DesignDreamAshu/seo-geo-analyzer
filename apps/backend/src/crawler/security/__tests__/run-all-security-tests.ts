/**
 * UNIFIED SECURITY TEST SUITE ORCHESTRATOR (S1 - S6)
 * Executes all certified security test phases (S1-S6), collects per-phase metrics,
 * verifies zero regressions, and prints an authoritative aggregate scorecard.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PhaseResult {
  phase: string;
  name: string;
  script: string;
  passed: number;
  failed: number;
  durationMs: number;
  success: boolean;
  rawOutput: string;
}

const phases = [
  {
    phase: "S1",
    name: "Security Evidence Architecture & Fact Collection",
    script: "run-security-s1-tests.ts",
    expectedMinPassed: 64,
  },
  {
    phase: "S2",
    name: "Security Engine & Rule Verification (S2)",
    script: "run-security-s2-tests.ts",
    expectedMinPassed: 47,
  },
  {
    phase: "S3",
    name: "Formal Ground-Truth Certification Suite (S3)",
    script: "run-security-s3-certification.ts",
    expectedMinPassed: 65,
  },
  {
    phase: "S4",
    name: "Fix Intelligence & Remediation Engineering (S4)",
    script: "run-security-s4-remediation-tests.ts",
    expectedMinPassed: 750,
  },
  {
    phase: "S5",
    name: "Security Posture Scoring & ViewModel (S5)",
    script: "run-security-s5-score-tests.ts",
    expectedMinPassed: 26,
  },
  {
    phase: "S6",
    name: "Advanced Gap Analysis & Guardrails (S6)",
    script: "run-security-s6-tests.ts",
    expectedMinPassed: 18,
  },
  {
    phase: "S7",
    name: "Persistence, History, Comparison & Verify Fix (S7)",
    script: "run-security-s7-tests.ts",
    expectedMinPassed: 42,
  },
];

async function runAllSecurityTests() {
  console.log("===============================================================");
  console.log("DREAM SEO — CERTIFIED SECURITY S1–S7 TEST SUITE ORCHESTRATOR");
  console.log("===============================================================\n");

  const results: PhaseResult[] = [];
  let aggregatePassed = 0;
  let aggregateFailed = 0;
  const overallStart = Date.now();

  for (const p of phases) {
    const scriptPath = path.resolve(__dirname, p.script);
    console.log(`▶ Executing [${p.phase}] ${p.name}...`);
    const start = Date.now();

    try {
      const output = execSync(`npx tsx "${scriptPath}"`, {
        cwd: path.resolve(__dirname, "../../../.."),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const durationMs = Date.now() - start;

      // Parse output for passed count: "Passed: X | Failed: Y" or "X PASSED | Y FAILED"
      const summaryMatch = output.match(/TEST SUMMARY:\s*Passed:\s*(\d+)\s*\|\s*Failed:\s*(\d+)/i)
        || output.match(/(\d+)\s*PASSED\s*\|\s*(\d+)\s*FAILED/i)
        || output.match(/Passed:\s*(\d+)\s*\/\s*(\d+)/i);

      let passed = 0;
      let failed = 0;

      if (summaryMatch) {
        passed = parseInt(summaryMatch[1], 10);
        failed = parseInt(summaryMatch[2], 10);
      } else {
        // Fallback: count checkmarks
        const checkmarks = (output.match(/✓|✅ PASS/g) || []).length;
        passed = checkmarks;
      }

      aggregatePassed += passed;
      aggregateFailed += failed;

      results.push({
        phase: p.phase,
        name: p.name,
        script: p.script,
        passed,
        failed,
        durationMs,
        success: failed === 0 && passed >= p.expectedMinPassed,
        rawOutput: output,
      });

      console.log(`  ✓ ${p.phase} Completed: ${passed} Passed | ${failed} Failed (${(durationMs / 1000).toFixed(2)}s)\n`);
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      const stdout = err.stdout ? err.stdout.toString() : "";
      console.error(`  ✗ ${p.phase} Failed execution:`, stderr || stdout);

      results.push({
        phase: p.phase,
        name: p.name,
        script: p.script,
        passed: 0,
        failed: 1,
        durationMs,
        success: false,
        rawOutput: stderr || stdout,
      });
      aggregateFailed += 1;
    }
  }

  const totalDurationMs = Date.now() - overallStart;

  console.log("===============================================================");
  console.log("CERTIFIED SECURITY TEST SUITE (S1–S6) — AGGREGATE SCORECARD");
  console.log("===============================================================");
  console.log(
    `| Phase | Test Suite Name                              | Script                           | Passed | Failed | Status |`
  );
  console.log(
    `| :---: | :------------------------------------------- | :------------------------------- | :----: | :----: | :----: |`
  );

  for (const r of results) {
    const status = r.success ? "✅ PASS" : "❌ FAIL";
    const phaseCol = r.phase.padEnd(5);
    const nameCol = r.name.slice(0, 44).padEnd(44);
    const scriptCol = r.script.slice(0, 32).padEnd(32);
    const passCol = String(r.passed).padStart(6);
    const failCol = String(r.failed).padStart(6);
    console.log(`| ${phaseCol} | ${nameCol} | ${scriptCol} | ${passCol} | ${failCol} | ${status} |`);
  }

  console.log("---------------------------------------------------------------");
  console.log(
    `TOTALS: ${aggregatePassed} Passed | ${aggregateFailed} Failed | Grand Total: ${aggregatePassed + aggregateFailed} Tests (${(totalDurationMs / 1000).toFixed(2)}s)`
  );
  console.log("===============================================================\n");

  if (aggregateFailed > 0 || results.some((r) => !r.success)) {
    console.error("❌ CERTIFICATION FAILED: One or more security test suites failed.");
    process.exit(1);
  } else {
    console.log("✅ CERTIFICATION PASSED: All S1–S6 security test suites passed with 100% success.");
  }
}

runAllSecurityTests().catch((err) => {
  console.error("Fatal error in test orchestrator:", err);
  process.exit(1);
});
