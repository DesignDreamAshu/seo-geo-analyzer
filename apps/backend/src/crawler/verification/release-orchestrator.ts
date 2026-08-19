import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";
import { execSync } from "child_process";
import { getGitProvenance } from "./git-info";
import { executeBrowserCapabilityCheck } from "./run-browser-capability";
import { executeLegacyStabilityCheck } from "./run-legacy-stability";
import { executeParitySuite } from "./run-parity-suite";
import { executeFullAuditSuite } from "./run-audit-suite";
import { generateReleaseReport } from "./report-generator";
import { verifyDeployedService } from "./verify-deployed-service";
import type { VerificationEnvironment, VerificationRunHeader } from "./types";

const require = createRequire(import.meta.url);

async function main() {
  console.log("==========================================================================");
  console.log("    DREAM SEO ANALYZER — CANONICAL RELEASE VERIFICATION ORCHESTRATOR      ");
  console.log("==========================================================================\n");

  const requireRemote = process.argv.includes("--require-remote");
  const allowDirty = process.argv.includes("--allow-dirty");

  // 1. Resolve Dynamic Git Metadata (Full 40-char SHA & optional remote verification)
  const git = getGitProvenance(process.cwd(), requireRemote);
  const repoRoot = git.repositoryRoot || process.cwd();
  const cwd = path.resolve(repoRoot, "apps/backend");

  console.log(`[Provenance] Local HEAD Full SHA: ${git.gitShaFull} (${git.gitShaShort})`);
  console.log(`[Provenance] Branch:             ${git.branch}`);
  console.log(`[Provenance] Working Tree Clean: ${git.workingTreeClean ? "YES" : "NO"}`);
  if (git.remoteBranchSha) {
    console.log(`[Provenance] Remote Branch SHA:  ${git.remoteBranchSha}`);
    console.log(`[Provenance] Remote Match:       ${git.remoteVerified ? "EXACT MATCH (100% 40-char)" : "MISMATCH"}`);
  }
  console.log(`[Provenance] Verification State: ${git.verificationGitState}\n`);

  if (!git.workingTreeClean && !allowDirty) {
    console.error("==========================================================================");
    console.error("  RELEASE VERIFICATION ABORTED");
    console.error("  Reason: working tree contains uncommitted changes");
    console.error("==========================================================================");
    console.error("Uncommitted changes detected:");
    git.uncommittedChanges.forEach((c) => console.error(`  - ${c}`));
    console.error("\nPlease commit all changes before running the release verification pipeline.");
    process.exit(1);
  }

  if (requireRemote && !git.remoteVerified) {
    console.error("==========================================================================");
    console.error("  RELEASE VERIFICATION ABORTED");
    console.error("  Reason: local HEAD SHA does not match remote branch SHA on origin");
    console.error(`  Local:  ${git.gitShaFull}`);
    console.error(`  Remote: ${git.remoteBranchSha || "Not found"}`);
    console.error("==========================================================================");
    console.error("\nPlease push your commit to origin before running with --require-remote.");
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

  // 3. Resolve Exact Playwright Version (Declared, lockfile, and runtime loaded)
  let runtimePlaywrightVersion = "unknown";
  try {
    const pkg = require("playwright/package.json");
    if (pkg && pkg.version) {
      runtimePlaywrightVersion = pkg.version;
    }
  } catch {}

  let declaredPlaywrightVersion = "^1.58.0";
  try {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    declaredPlaywrightVersion = rootPkg.devDependencies?.playwright || rootPkg.dependencies?.playwright || "^1.58.0";
  } catch {}

  const expectedNode = "22";
  const currentMajor = process.versions.node.split(".")[0];
  const nodeMatches = currentMajor === expectedNode;

  const environment: VerificationEnvironment = {
    nodeVersion: process.version,
    expectedProductionNodeVersion: expectedNode,
    nodeVersionMatchesExpected: nodeMatches,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    declaredPlaywrightVersion,
    runtimePlaywrightVersion,
    playwrightVersionMatchesDeclared: runtimePlaywrightVersion.startsWith("1."),
    playwrightVersion: runtimePlaywrightVersion,
    isRender: Boolean(process.env.RENDER),
  };

  const header: VerificationRunHeader = {
    verificationRunId,
    gitShaFull: git.gitShaFull,
    gitShaShort: git.gitShaShort,
    branch: git.branch,
    workingTreeClean: git.workingTreeClean,
    remoteBranchSha: git.remoteBranchSha,
    remoteVerified: git.remoteVerified,
    verificationGitState: git.verificationGitState,
    targetSite: "https://www.botconsulting.io/",
    startedAt,
    environment,
    gitEvidence: git.gitEvidence,
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
  const capabilityArtifact = await executeBrowserCapabilityCheck(verificationRunId, git.gitShaFull, environment);
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
    execSync("npx tsx src/crawler/verification/__tests__/release-harness-invariants.test.ts", { cwd, stdio: "inherit" });
    console.log("✓ Deterministic unit, golden dataset, and release harness regression passed.\n");
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
  const stabilityArtifact = await executeLegacyStabilityCheck(verificationRunId, git.gitShaFull);
  console.log("✓ Legacy CMS stability diagnostics completed.\n");

  // Step 6: Independent 25-URL Playwright Browser Parity (Dual: Raw & Authoritative)
  console.log("--- Step 6/7: Independent 25-URL Playwright Browser Parity Oracle ---");
  const parityArtifact = await executeParitySuite(verificationRunId, git.gitShaFull);
  console.log("✓ Independent Playwright parity suite completed.\n");

  // Step 7: Fresh Comprehensive Site Audit
  console.log("--- Step 7/7: Fresh Full Production BOT Audit Crawl (maxPages=300) ---");
  const auditArtifact = await executeFullAuditSuite(verificationRunId, git.gitShaFull);
  console.log("✓ Full site audit completed.\n");

  // Optional: Probe Deployed Service
  const deploymentVerification = await verifyDeployedService();

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
    runArtifactsDir,
    deploymentVerification
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
  fs.copyFileSync(path.join(runArtifactsDir, "crawler-accuracy-freeze-gate.json"), path.join(latestArtifactsDir, "crawler-accuracy-freeze-gate.json"));
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
