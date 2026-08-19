import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { getGitProvenance } from "./git-info";
import { executeBrowserCapabilityCheck } from "./run-browser-capability";
import { executeLegacyStabilityCheck } from "./run-legacy-stability";
import { executeParitySuite } from "./run-parity-suite";
import { executeFullAuditSuite } from "./run-audit-suite";
import { generateReleaseReport } from "./report-generator";
import type { VerificationEnvironment, VerificationRunHeader } from "./types";

async function main() {
  console.log("==========================================================================");
  console.log("    DREAM SEO ANALYZER — CANONICAL RELEASE VERIFICATION ORCHESTRATOR      ");
  console.log("==========================================================================\n");

  const cwd = path.resolve(process.cwd(), "apps/backend");
  const repoRoot = path.resolve(process.cwd());

  // 1. Resolve Dynamic Git Metadata
  const git = getGitProvenance(repoRoot);
  console.log(`[Provenance] Commit SHA: ${git.gitSha} (${git.shortSha})`);
  console.log(`[Provenance] Branch: ${git.branch}`);
  console.log(`[Provenance] Working Tree Clean: ${git.workingTreeClean ? "YES" : "NO"}`);

  const allowDirty = process.argv.includes("--allow-dirty");
  if (!git.workingTreeClean && !allowDirty) {
    console.error("\n==========================================================================");
    console.error("  RELEASE VERIFICATION ABORTED");
    console.error("  Reason: working tree contains uncommitted changes");
    console.error("==========================================================================");
    console.error("Uncommitted changes detected:");
    git.uncommittedChanges.forEach((c) => console.error(`  - ${c}`));
    console.error("\nPlease commit all changes before running the release verification pipeline.");
    process.exit(1);
  }

  const verificationRunId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();

  // 2. Prepare Artifact Directories
  const artifactsBaseDir = path.resolve(repoRoot, "artifacts/verification");
  const runArtifactsDir = path.join(artifactsBaseDir, verificationRunId);
  const latestArtifactsDir = path.join(artifactsBaseDir, "latest");

  fs.mkdirSync(runArtifactsDir, { recursive: true });
  fs.mkdirSync(latestArtifactsDir, { recursive: true });

  const playwrightPkg = JSON.parse(
    fs.readFileSync(path.resolve(cwd, "node_modules/playwright/package.json"), "utf8")
  ).version || "unknown";

  const environment: VerificationEnvironment = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    playwrightVersion: playwrightPkg,
    isRender: Boolean(process.env.RENDER),
  };

  const header: VerificationRunHeader = {
    verificationRunId,
    gitSha: git.gitSha,
    branch: git.branch,
    workingTreeClean: git.workingTreeClean,
    targetSite: "https://www.botconsulting.io/",
    startedAt,
    environment,
  };

  console.log(`[Run ID] ${verificationRunId}`);
  console.log(`[Artifacts Store] ${runArtifactsDir}\n`);

  // Step 1: TypeScript Build Check
  console.log("--- Step 1/7: TypeScript Production Build Verification ---");
  try {
    execSync("npm run build", { cwd, stdio: "inherit" });
    console.log("✓ TypeScript build succeeded.\n");
  } catch {
    console.error("FAIL: TypeScript build failed.");
    process.exit(1);
  }

  // Step 2: Browser Capability Check
  console.log("--- Step 2/7: Browser Verification Capability Check ---");
  const capabilityArtifact = await executeBrowserCapabilityCheck(verificationRunId, git.gitSha, environment);
  if (capabilityArtifact.capability === "unavailable") {
    console.error("FAIL: Headless browser is unavailable.");
    process.exit(1);
  }
  console.log("✓ Browser capability passed.\n");

  // Step 3: Fast Regression & Unit Invariant Tests
  console.log("--- Step 3/7: Deterministic Regression Suites ---");
  try {
    execSync("npx tsx src/crawler/__tests__/verify-correctness.ts", { cwd, stdio: "inherit" });
    execSync("npx tsx src/crawler/__tests__/golden-dataset.test.ts", { cwd, stdio: "inherit" });
    console.log("✓ Deterministic unit & golden dataset regression passed.\n");
  } catch (err: any) {
    console.error(`FAIL: Regression suite failed: ${err.message}`);
    process.exit(1);
  }

  // Step 4: Live Smoke Reachability
  console.log("--- Step 4/7: Live Production URL Reachability Smoke ---");
  try {
    execSync("npx tsx src/crawler/__tests__/live-regression-smoke.test.ts", { cwd, stdio: "inherit" });
    console.log("✓ Live smoke suite passed.\n");
  } catch (err: any) {
    console.error(`FAIL: Live smoke reachability failed: ${err.message}`);
    process.exit(1);
  }

  // Step 5: Legacy CMS Response Stability Multi-Probe
  console.log("--- Step 5/7: Disputed Legacy CMS Response Stability Diagnostics ---");
  const stabilityArtifact = await executeLegacyStabilityCheck(verificationRunId, git.gitSha);
  console.log("✓ Legacy CMS stability diagnostics completed.\n");

  // Step 6: Independent 25-URL Playwright Browser Parity
  console.log("--- Step 6/7: Independent 25-URL Playwright Browser Parity Oracle ---");
  const parityArtifact = await executeParitySuite(verificationRunId, git.gitSha);
  console.log("✓ Independent Playwright parity suite completed.\n");

  // Step 7: Fresh Comprehensive Site Audit
  console.log("--- Step 7/7: Fresh Full Production BOT Audit Crawl (maxPages=300) ---");
  const auditArtifact = await executeFullAuditSuite(verificationRunId, git.gitSha);
  console.log("✓ Full site audit completed.\n");

  // Compile Final Report & Cross-Artifact Validation
  console.log("==========================================================================");
  console.log("    COMPILING CANONICAL RELEASE REPORT & VERIFYING INVARIANTS             ");
  console.log("==========================================================================\n");

  const { reportJson, reportMd, manifest } = generateReleaseReport(
    header,
    capabilityArtifact,
    stabilityArtifact,
    parityArtifact,
    auditArtifact,
    runArtifactsDir
  );

  const reportJsonPath = path.join(runArtifactsDir, "release-verification-report.json");
  const reportMdPath = path.join(runArtifactsDir, "release-verification-report.md");

  fs.writeFileSync(reportJsonPath, JSON.stringify(reportJson, null, 2), "utf8");
  fs.writeFileSync(reportMdPath, reportMd, "utf8");

  // Mirror to latest
  fs.copyFileSync(path.join(runArtifactsDir, "browser-capability.json"), path.join(latestArtifactsDir, "browser-capability.json"));
  fs.copyFileSync(path.join(runArtifactsDir, "legacy-stability.json"), path.join(latestArtifactsDir, "legacy-stability.json"));
  fs.copyFileSync(path.join(runArtifactsDir, "parity.json"), path.join(latestArtifactsDir, "parity.json"));
  fs.copyFileSync(path.join(runArtifactsDir, "audit.json"), path.join(latestArtifactsDir, "audit.json"));
  fs.copyFileSync(path.join(runArtifactsDir, "manifest.json"), path.join(latestArtifactsDir, "manifest.json"));
  fs.copyFileSync(reportJsonPath, path.join(latestArtifactsDir, "release-verification-report.json"));
  fs.copyFileSync(reportMdPath, path.join(latestArtifactsDir, "release-verification-report.md"));

  console.log(reportMd);

  console.log("==========================================================================");
  console.log("    RELEASE VERIFICATION PIPELINE COMPLETED SUCCESSFULLY                  ");
  console.log(`    Run Artifacts:    ${runArtifactsDir}`);
  console.log(`    Canonical Report: ${reportMdPath}`);
  console.log("==========================================================================");
}

main().catch((err) => {
  console.error("\nFATAL: Release verification pipeline crashed:", err);
  process.exit(1);
});
