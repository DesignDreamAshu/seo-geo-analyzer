/**
 * Deterministic Regression Test Suite for Release Verification Harness Invariants
 */

import { generateReleaseReport } from "../report-generator";
import type {
  AuditArtifact,
  BrowserCapabilityArtifact,
  LegacyStabilityArtifact,
  ParityArtifact,
  VerificationEnvironment,
  VerificationRunHeader,
} from "../types";

function createMockEnvironment(): VerificationEnvironment {
  return {
    nodeVersion: "v22.18.0",
    expectedProductionNodeVersion: "22",
    nodeVersionMatchesExpected: true,
    platform: "win32",
    arch: "x64",
    osRelease: "10.0.22631",
    playwrightVersion: "1.58.0",
    isRender: false,
  };
}

function createMockHeader(gitShaFull: string, verificationRunId = "run-test-123"): VerificationRunHeader {
  return {
    verificationRunId,
    gitShaFull,
    gitShaShort: gitShaFull.slice(0, 7),
    branch: "main",
    workingTreeClean: true,
    targetSite: "https://www.botconsulting.io/",
    startedAt: new Date().toISOString(),
    remoteBranchSha: gitShaFull,
    remoteVerified: true,
    verificationGitState: "REMOTE_VERIFIED",
    environment: createMockEnvironment(),
  };
}

function createMockCapability(gitShaFull: string, verificationRunId = "run-test-123"): BrowserCapabilityArtifact {
  return {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    capability: "available",
    details: "Playwright Chromium operational",
    chromiumVersion: "133.0.6943.16",
    chromiumExecutableAvailable: true,
    browserLaunchSucceeded: true,
    navigationSmokeSucceeded: true,
    environment: createMockEnvironment(),
  };
}

function createMockStability(gitShaFull: string, verificationRunId = "run-test-123"): LegacyStabilityArtifact {
  return {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    probesCount: 63,
    disputedUrlsCount: 7,
    results: [],
  };
}

function createMockParity(gitShaFull: string, verificationRunId = "run-test-123"): ParityArtifact {
  return {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    targetUrlsCount: 25,
    totalFactsConsidered: 275,
    exactMatches: 220,
    toleratedMatches: 10,
    mismatches: 45,
    inconclusive: 0,
    notEvaluated: 0,
    strictParity: 80.0,
    comparableParity: 83.6,
    accuracyBand: "good",
    categoryParity: {
      coreSeo: {
        name: "Core SEO",
        registeredFields: ["status_code", "title"],
        totalEvaluated: 150,
        exactMatches: 148,
        toleratedMatches: 2,
        mismatches: 0,
        strictParityPercent: 98.7,
        comparableParityPercent: 100.0,
        qualityGatePassed: true,
        qualityGateThresholdPercent: 98.0,
      },
      structuralAccessibility: {
        name: "Structural & Accessibility",
        registeredFields: ["has_main_landmark"],
        totalEvaluated: 75,
        exactMatches: 60,
        toleratedMatches: 0,
        mismatches: 15,
        strictParityPercent: 80.0,
        comparableParityPercent: 80.0,
        qualityGatePassed: true,
        qualityGateThresholdPercent: 80.0,
      },
      contentText: {
        name: "Content Text",
        registeredFields: ["main_content_word_count"],
        totalEvaluated: 50,
        exactMatches: 12,
        toleratedMatches: 8,
        mismatches: 30,
        strictParityPercent: 24.0,
        comparableParityPercent: 40.0,
        qualityGatePassed: true,
        qualityGateThresholdPercent: 20.0,
      },
    },
    mismatchCategories: {
      "Dynamic navigation search form injected client-side": 15,
      "Client JS navigation/menu hydration word variance": 30,
    },
    fieldMetrics: [
      {
        field: "status_code",
        category: "core_seo",
        totalEvaluated: 150,
        exactMatches: 148,
        toleratedMatches: 2,
        mismatches: 0,
        inconclusive: 0,
        notEvaluated: 0,
        strictParityPercent: 98.7,
        comparableParityPercent: 100.0,
      },
      {
        field: "has_main_landmark",
        category: "structural_a11y",
        totalEvaluated: 75,
        exactMatches: 60,
        toleratedMatches: 0,
        mismatches: 15,
        inconclusive: 0,
        notEvaluated: 0,
        strictParityPercent: 80.0,
        comparableParityPercent: 80.0,
      },
      {
        field: "main_content_word_count",
        category: "content_text",
        totalEvaluated: 50,
        exactMatches: 12,
        toleratedMatches: 8,
        mismatches: 30,
        inconclusive: 0,
        notEvaluated: 0,
        strictParityPercent: 24.0,
        comparableParityPercent: 40.0,
      },
    ],
    ruleMetrics: [],
    urlSummaries: [],
  };
}

function createMockAudit(gitShaFull: string, verificationRunId = "run-test-123"): AuditArtifact {
  return {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    auditId: "audit-12345",
    seedUrl: "https://www.botconsulting.io/",
    durationMs: 25000,
    terminationReason: "queue_exhausted",
    healthScore: 60.0,
    auditCoveragePercent: 86.0,
    inventory: {
      totalCrawled: 169,
      totalIndexable: 137,
      totalNonIndexable: 32,
      totalRedirects: 0,
      totalBrokenPages: 1,
      sitemapDiscoveredCount: 167,
      sitemapOrphanCount: 0,
      crawlIsolatedCount: 0,
    },
    renderingTelemetry: {
      eligibleForRender: 4,
      actuallyRendered: 4,
      renderSuccess: 4,
      renderFailed: 0,
      authoritativeRenderedPagesCount: 4,
    },
    severityCounts: { critical: 2, warnings: 8, opportunities: 5, notices: 0 },
    issues: [
      {
        id: "1",
        code: "SCHEMA_MALFORMED_JSON",
        category: "social_schema",
        severity: "critical",
        title: "Malformed schema",
        description: "Schema error",
        recommendation: "Fix schema",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 8,
        scorePenalty: 40.0,
        affectedCount: 10,
        affectedOccurrences: 10,
        affectedUniquePages: 10,
        eligiblePageCount: 169,
        affectedRatio: 0.05,
        affectedPages: [],
      },
    ],
    externalLinkTelemetry: {
      discoveredUniqueUrls: 44,
      discoveredOccurrences: 545,
      verificationLimit: 50,
      checkedUniqueUrls: 44,
      checkedOccurrences: 545,
      uncheckedUniqueUrls: 0,
      uncheckedOccurrences: 0,
      confirmedOkUniqueUrls: 32,
      confirmedOkOccurrences: 374,
      redirectedOkUniqueUrls: 1,
      redirectedOkOccurrences: 1,
      browserVerifiedOkUniqueUrls: 0,
      browserVerifiedOkOccurrences: 0,
      confirmedBrokenUniqueUrls: 1,
      confirmedBrokenOccurrences: 1,
      inconclusiveUniqueUrls: 10,
      inconclusiveOccurrences: 169,
      verificationCoveragePercent: 100,
      uniqueExternalUrlsCount: 44,
      totalExternalOccurrences: 545,
      confirmedOkCount: 374,
      redirectedOkCount: 1,
      browserVerifiedOkCount: 0,
      confirmedBrokenCount: 1,
      botBlockedCount: 169,
      rateLimitedCount: 0,
      timeoutCount: 0,
      networkDnsSslCount: 0,
      excludedPlaceholderHashCount: 1562,
      excludedMailtoTelJsCount: 1,
      topExternalDomains: [],
    },
  };
}

async function runTests() {
  console.log("=======================================================");
  console.log("  RUNNING RELEASE HARNESS INVARIANT REGRESSION TESTS   ");
  console.log("=======================================================\n");

  const validSha = "3126dedafdd297ac649ed40c0e61c5265601137b";
  const fakeShaSamePrefix = "3126deda4bb0a73dbe7be7b2ff92e105e4fa441d";
  const tempDir = process.cwd();

  // Test 1: Fake full SHA sharing same first 7 chars fails identity validation
  console.log("[Test 1] Fake full SHA with same 7-char prefix must FAIL cross-artifact check...");
  try {
    generateReleaseReport(
      createMockHeader(validSha),
      createMockCapability(fakeShaSamePrefix), // Mismatch!
      createMockStability(validSha),
      createMockParity(validSha),
      createMockAudit(validSha),
      tempDir
    );
    throw new Error("FAIL: Test 1 should have thrown SHA mismatch error!");
  } catch (err: any) {
    if (err.message.includes("Git SHA mismatch detected")) {
      console.log("✓ PASS: Fake SHA rejected correctly.\n");
    } else {
      throw err;
    }
  }

  // Test 2: Field mismatch total != global mismatch total must FAIL report generation
  console.log("[Test 2] Field metrics mismatch sum != global mismatches must FAIL...");
  try {
    const invalidParity = createMockParity(validSha);
    invalidParity.fieldMetrics[0].mismatches = 999; // Corrupt sum!
    generateReleaseReport(
      createMockHeader(validSha),
      createMockCapability(validSha),
      createMockStability(validSha),
      invalidParity,
      createMockAudit(validSha),
      tempDir
    );
    throw new Error("FAIL: Test 2 should have thrown field metrics reconciliation error!");
  } catch (err: any) {
    if (err.message.includes("FIELD METRICS RECONCILIATION FAILED")) {
      console.log("✓ PASS: Inconsistent field metrics sum rejected correctly.\n");
    } else {
      throw err;
    }
  }

  // Test 3: Mismatch category sum != global mismatches must FAIL
  console.log("[Test 3] Mismatch category sum != global mismatches must FAIL...");
  try {
    const invalidParity = createMockParity(validSha);
    invalidParity.mismatchCategories = { "Some reason": 1 }; // Sum is 1 != 45
    generateReleaseReport(
      createMockHeader(validSha),
      createMockCapability(validSha),
      createMockStability(validSha),
      invalidParity,
      createMockAudit(validSha),
      tempDir
    );
    throw new Error("FAIL: Test 3 should have thrown mismatch sum error!");
  } catch (err: any) {
    if (err.message.includes("MISMATCH SUM FAILED")) {
      console.log("✓ PASS: Inconsistent mismatch categories rejected correctly.\n");
    } else {
      throw err;
    }
  }

  // Test 4: Parity arithmetic (exact + tol + mis != total) must FAIL
  console.log("[Test 4] Parity arithmetic failure (exact + tol + mis != total) must FAIL...");
  try {
    const invalidParity = createMockParity(validSha);
    invalidParity.totalFactsConsidered = 999; // Corrupt total
    generateReleaseReport(
      createMockHeader(validSha),
      createMockCapability(validSha),
      createMockStability(validSha),
      invalidParity,
      createMockAudit(validSha),
      tempDir
    );
    throw new Error("FAIL: Test 4 should have thrown parity arithmetic error!");
  } catch (err: any) {
    if (err.message.includes("PARITY ARITHMETIC FAILED")) {
      console.log("✓ PASS: Corrupt parity total rejected correctly.\n");
    } else {
      throw err;
    }
  }

  // Test 5: Valid artifacts generate report with exact invariant compliance
  console.log("[Test 5] Valid artifacts generate clean report with status VERIFIED_PASS...");
  const report = generateReleaseReport(
    createMockHeader(validSha),
    createMockCapability(validSha),
    createMockStability(validSha),
    createMockParity(validSha),
    createMockAudit(validSha),
    tempDir
  );
  if (report.reportJson.overallStatus === "VERIFIED_PASS" && report.reportJson.invariantsCheck.passed) {
    console.log("✓ PASS: Valid report generated successfully.\n");
  } else {
    throw new Error(`FAIL: Unexpected report status: ${report.reportJson.overallStatus}`);
  }

  console.log("=======================================================");
  console.log("  ALL RELEASE HARNESS INVARIANT REGRESSION TESTS PASSED ");
  console.log("=======================================================");
}

runTests().catch((err) => {
  console.error("FATAL: Invariant test failed:", err);
  process.exit(1);
});
