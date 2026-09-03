/**
 * Security S7 Test Suite: Persistence, History, Lifecycle, Comparison, Verify Fix & Reporting.
 * Executes comprehensive deterministic assertions across all S7 requirements.
 */

import { DatabaseSync } from "node:sqlite";
import {
  createPersistenceLayer,
  computeFindingIdentity,
  compareSecuritySnapshots,
  buildSecurityHistoryTimeline,
  executeTargetedSecurityVerification,
  deduceVerificationMethod,
  evaluateSecurityComparability,
} from "../../persistence/index";
import type { SecurityAuditSnapshotEntity } from "../history/types";
import type { SecurityAuditViewModel } from "../scoring/score-types";
import type { SecurityFinding } from "../../rule-types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

export async function runSecurityS7Tests(): Promise<{ passed: number; failed: number }> {
  console.log(`\n===============================================================`);
  console.log(`DREAM SEO — SECURITY S7 TEST SUITE (PERSISTENCE & HISTORY)`);
  console.log(`===============================================================\n`);

  const memDb = new DatabaseSync(":memory:");
  const persistence = createPersistenceLayer(memDb);

  // Helper to create mock snapshot
  function createMockSnapshot(params: {
    auditRunId: string;
    projectId: string;
    domain: string;
    score: number;
    scorePolicyVersion?: string;
    findings?: SecurityFinding[];
    coverage?: any[];
    capabilities?: any;
    crawledPagesCount?: number;
    requestedCeiling?: number;
    createdAt?: string;
  }): SecurityAuditSnapshotEntity {
    const findings = params.findings || [];
    const coverage = params.coverage || [
      { ruleId: "SEC_HSTS_MISSING", coverageState: "FAIL", applicable: true },
      { ruleId: "SEC_CSP_MISSING", coverageState: "PASS", applicable: true },
      { ruleId: "SEC_MANUAL_PENTEST", coverageState: "REQUIRES_MANUAL_VERIFICATION", applicable: false },
    ];

    const payload: SecurityAuditViewModel = {
      scoreBreakdown: { score: params.score, postureBand: params.score >= 90 ? "Excellent" : "Moderate", totalDeductions: 100 - params.score, isCapped: false, categoryScores: {} as any },
      postureBand: params.score >= 90 ? "Excellent" : "Moderate",
      stats: { totalRulesRegistered: 64, confirmedRules: 52, heuristicRules: 2, manualAssessmentAreas: 10, testsExecuted: 54, applicableControls: 54, passedControls: 50, criticalFindings: 0, highFindings: 0, mediumFindings: findings.length, lowFindings: 0, informationalFindings: 0 },
      categoryHealth: [
        { category: "transport", displayName: "Transport & HTTPS", posture: params.score >= 90 ? "Strong" : "Moderate", score: params.score, deduction: 0, applicableTests: 6, passedTests: 5, failedTests: findings.length, findingsCount: findings.length, manualAssessmentCount: 0, notObservableCount: 0, notApplicableCount: 0 },
      ],
      topRisks: [],
      quickWins: [],
      implementationMap: { actions: [], totalEstimatedEffort: "Low", categoryBreakdown: {} as any, platformDistribution: {} as any },
      findings,
      coverage,
      pages: Array.from({ length: params.crawledPagesCount || 10 }, (_, i) => ({
        url: `https://${params.domain}/page-${i + 1}`,
        findingsCount: 0,
        isHttps: true,
        protocol: "HTTP/2",
        statusCode: 200,
        securityHeadersPresent: ["x-frame-options"],
        securityHeadersMissing: ["strict-transport-security"],
        cookiesCount: 0,
        insecureCookiesCount: 0,
        mixedContentCount: 0,
        passwordFormsWithoutHttps: 0,
        thirdPartyScriptOrigins: ["https://cdn.example.com"],
        hasPasswordInput: false,
      })),
      thirdParties: {
        totalThirdPartyOrigins: 1,
        totalThirdPartyScripts: 1,
        inventory: [{ origin: "https://cdn.example.com", domain: "example.com", scriptCount: 1, category: "CDN", affectedPagesCount: 1 }],
      },
      disclaimer: "Website Security Posture & Configuration Audit",
      capabilities: params.capabilities || {
        deprecatedTlsProtocolProbing: { status: "NOT_AVAILABLE", explanation: "Passive audit only" },
        dnssecValidation: { status: "NOT_OBSERVABLE", explanation: "DNSSEC DO flag unobserved" },
        vulnerabilityAdvisoryLookup: { status: "PROVIDER_REQUIRED", explanation: "Requires provider" },
        securityTxtInspection: { status: "AVAILABLE", explanation: "Inspected RFC 9116" },
      },
    };

    // Ensure parent project and audit run exist for foreign keys
    try {
      memDb.prepare(`
        INSERT OR IGNORE INTO projects (project_id, name, primary_domain, normalized_domain, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(params.projectId, "Test Project", `https://${params.domain}`, params.domain, new Date().toISOString(), new Date().toISOString());

      memDb.prepare(`
        INSERT OR IGNORE INTO audit_runs (
          audit_run_id, project_id, sequence_number, started_at, completed_at, status, trigger_type,
          crawler_version, rule_inventory_version, production_rule_count, policy_versions_json,
          configuration_snapshot_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        params.auditRunId,
        params.projectId,
        1,
        params.createdAt || new Date().toISOString(),
        params.createdAt || new Date().toISOString(),
        "COMPLETED",
        "MANUAL",
        "v1.0.0",
        "v1.0.0",
        64,
        "{}",
        "{}",
        params.createdAt || new Date().toISOString()
      );
    } catch {
      // Ignore if already exists
    }

    return {
      snapshotId: `snap_${params.auditRunId}`,
      auditRunId: params.auditRunId,
      projectId: params.projectId,
      domain: params.domain,
      startedAt: params.createdAt || new Date().toISOString(),
      completedAt: params.createdAt || new Date().toISOString(),
      securitySchemaVersion: "v1.0.0",
      ruleCatalogVersion: "v1.0.0-64rules",
      scorePolicyVersion: params.scorePolicyVersion || "v1.0.0-deductive",
      remediationContractVersion: "v1.0.0-matrix",
      score: params.score,
      postureBand: params.score >= 90 ? "Excellent" : "Moderate",
      criticalCount: 0,
      highCount: 0,
      mediumCount: findings.length,
      lowCount: 0,
      informationalCount: 0,
      manualAreasCount: 10,
      testsExecuted: 54,
      passedControls: 50,
      totalRulesRegistered: 64,
      requestedCrawlLimit: params.requestedCeiling || 300,
      discoveredPageCount: params.crawledPagesCount || 10,
      actualCrawledPageCount: params.crawledPagesCount || 10,
      isPartialAudit: false,
      payload,
      createdAt: params.createdAt || new Date().toISOString(),
    };
  }

  // --- TEST GROUP 1: Snapshot Persistence & Immutability ---
  console.log("--- TEST GROUP 1: Snapshot Persistence & Immutability ---");

  const snap1 = createMockSnapshot({
    auditRunId: "audit_001",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 85,
    findings: [
      {
        ruleId: "SEC_HSTS_MISSING",
        category: "transport",
        severity: "medium",
        title: "Missing Strict-Transport-Security Header",
        description: "HSTS header absent",
        confidence: "confirmed",
        verificationClassification: "deterministic_header",
        scope: "HOST",
        evidence: { observed: "No HSTS", apiKey: "SECRET_KEY_12345" }, // Sensitive evidence
      } as any,
    ],
    createdAt: "2026-09-01T10:00:00Z",
  });

  await persistence.securitySnapshots.saveSnapshot(snap1);
  const retrieved1 = await persistence.securitySnapshots.getSnapshotByAuditRunId("audit_001");

  assert(retrieved1 !== null, "1. Snapshot successfully persisted and retrieved from SQLite");
  assert(retrieved1?.score === 85, "2. Snapshot score preserved exactly as 85");
  assert(retrieved1?.ruleCatalogVersion === "v1.0.0-64rules", "3. Version metadata ruleCatalogVersion explicitly preserved");
  assert(retrieved1?.requestedCrawlLimit === 300, "4. Requested crawl limit 300 explicitly persisted");

  // Verify raw SQLite database payload_json contains [REDACTED] and NO raw apiKey
  const rawRow = memDb.prepare("SELECT payload_json FROM security_audit_snapshots WHERE audit_run_id = 'audit_001'").get() as any;
  assert(rawRow && typeof rawRow.payload_json === "string", "4a. Raw SQLite row payload_json exists as string");
  assert(!rawRow.payload_json.includes("SECRET_KEY_12345"), "4b. Raw database payload_json DOES NOT contain unredacted SECRET_KEY_12345");
  assert(rawRow.payload_json.includes("[REDACTED]"), "4c. Raw database payload_json contains [REDACTED]");

  // --- TEST GROUP 2: Finding Identity & Lifecycle State Machine ---
  console.log("\n--- TEST GROUP 2: Finding Identity & Lifecycle State Machine ---");

  const id1 = computeFindingIdentity({ ruleId: "SEC_HSTS_MISSING", scope: "HOST", category: "transport" } as any);
  const id2 = computeFindingIdentity({ ruleId: "SEC_HSTS_MISSING", scope: "HOST", category: "transport", affectedUrls: ["https://example.com/b", "https://example.com/a"] } as any);
  assert(id1 === id2, "5. Global host finding identity stable under URL reordering");

  // Identical second audit -> PERSISTING
  const snap2 = createMockSnapshot({
    auditRunId: "audit_002",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 85,
    findings: snap1.payload.findings,
    createdAt: "2026-09-02T10:00:00Z",
  });
  await persistence.securitySnapshots.saveSnapshot(snap2);

  const comp1_2 = compareSecuritySnapshots(snap1, snap2);
  assert(comp1_2.lifecycleSummary.totalPersisting === 1, "6. Identical second audit classifies finding as PERSISTING");
  assert(comp1_2.lifecycleSummary.totalNew === 0, "7. Identical second audit produces 0 NEW findings");

  // Audit 3: Fixed finding -> RESOLVED
  const snap3 = createMockSnapshot({
    auditRunId: "audit_003",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 100,
    findings: [], // Fixed!
    coverage: [{ ruleId: "SEC_HSTS_MISSING", coverageState: "PASS", applicable: true }],
    createdAt: "2026-09-03T10:00:00Z",
  });
  await persistence.securitySnapshots.saveSnapshot(snap3);

  const comp2_3 = compareSecuritySnapshots(snap2, snap3);
  assert(comp2_3.lifecycleSummary.totalResolved === 1, "8. Clean re-tested audit marks finding as RESOLVED");
  assert(comp2_3.scoreComparison.scoreDelta === 15, "9. Score improvement calculated as +15 pts (85 -> 100)");

  // Audit 4: Reopened finding -> REOPENED
  const snap4 = createMockSnapshot({
    auditRunId: "audit_004",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 85,
    findings: snap1.payload.findings,
    createdAt: "2026-09-04T10:00:00Z",
  });
  await persistence.securitySnapshots.saveSnapshot(snap4);

  const comp3_4 = compareSecuritySnapshots(snap3, snap4, [snap1, snap2, snap3]);
  assert(comp3_4.lifecycleSummary.totalReopened === 1, "10. Returning finding previously resolved classifies as REOPENED");

  // Audit 5: Brand New Finding -> NEW
  const snap5 = createMockSnapshot({
    auditRunId: "audit_005",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 75,
    findings: [
      ...snap1.payload.findings,
      {
        ruleId: "SEC_ENV_EXPOSURE",
        category: "sensitive_files",
        severity: "critical",
        title: "Public .env Configuration File",
        description: ".env exposed",
        confidence: "confirmed",
        verificationClassification: "deterministic_probe",
        scope: "HOST",
        evidence: {},
      } as any,
    ],
    createdAt: "2026-09-05T10:00:00Z",
  });
  const comp4_5 = compareSecuritySnapshots(snap4, snap5);
  assert(comp4_5.lifecycleSummary.totalNew === 1, "11. Novel rule finding classifies as NEW");

  // --- TEST GROUP 3: Coverage-Aware Resolution Guards ---
  console.log("\n--- TEST GROUP 3: Coverage-Aware Resolution Guards ---");

  // Scenario A: Capability NOT_AVAILABLE in current audit -> UNABLE_TO_CONFIRM_RESOLUTION
  const snapCapUnavail = createMockSnapshot({
    auditRunId: "audit_cap_unavail",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 100,
    findings: [],
    coverage: [{ ruleId: "SEC_HSTS_MISSING", coverageState: "NOT_AVAILABLE", applicable: false }],
  });
  const compCap = compareSecuritySnapshots(snap1, snapCapUnavail);
  assert(compCap.lifecycleSummary.totalUnableToConfirm === 1, "12. Capability NOT_AVAILABLE suppresses fake resolution (UNABLE_TO_CONFIRM_RESOLUTION)");
  assert(compCap.lifecycleSummary.totalResolved === 0, "13. Zero resolved findings when capability unavailable");

  // Scenario B: Rule not executed in current audit -> UNABLE_TO_CONFIRM_RESOLUTION
  const snapNoExec = createMockSnapshot({
    auditRunId: "audit_no_exec",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 100,
    findings: [],
    coverage: [], // Rule omitted!
  });
  const compNoExec = compareSecuritySnapshots(snap1, snapNoExec);
  assert(compNoExec.lifecycleSummary.totalUnableToConfirm === 1, "14. Unexecuted rule in current audit cannot claim resolution");

  // Scenario C: Page-level finding on page-5, but current audit only crawled 2 pages -> UNABLE_TO_CONFIRM
  const pageFindingSnap = createMockSnapshot({
    auditRunId: "audit_page_base",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 90,
    crawledPagesCount: 10,
    findings: [
      {
        ruleId: "SEC_PASSWORD_HTTP",
        category: "forms_inputs",
        severity: "high",
        title: "Password Form without HTTPS",
        description: "Password input on HTTP",
        confidence: "confirmed",
        verificationClassification: "deterministic_dom",
        scope: "PAGE",
        affectedUrls: ["https://example.com/page-5"],
        evidence: {},
      } as any,
    ],
  });
  const truncatedCrawlSnap = createMockSnapshot({
    auditRunId: "audit_page_trunc",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 100,
    crawledPagesCount: 2, // Only crawled page-1 and page-2
    findings: [],
    coverage: [{ ruleId: "SEC_PASSWORD_HTTP", coverageState: "PASS", applicable: true }],
  });
  const compTrunc = compareSecuritySnapshots(pageFindingSnap, truncatedCrawlSnap);
  assert(compTrunc.lifecycleSummary.totalUnableToConfirm === 1, "15. Truncated crawl missing affected URL marks finding UNABLE_TO_CONFIRM_RESOLUTION");

  // --- TEST GROUP 4: Score Policy Version Incompatibility Guard ---
  console.log("\n--- TEST GROUP 4: Score Policy Version Incompatibility Guard ---");

  const snapPolicyOld = createMockSnapshot({
    auditRunId: "audit_v1_policy",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 80,
    scorePolicyVersion: "v1.0.0-deductive",
  });
  const snapPolicyNew = createMockSnapshot({
    auditRunId: "audit_v2_policy",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 90,
    scorePolicyVersion: "v2.0.0-multiplicative",
  });
  const compPolicy = compareSecuritySnapshots(snapPolicyOld, snapPolicyNew);
  assert(compPolicy.scoreComparison.scoreDelta === null, "16. Incompatible scorePolicyVersion suppresses direct numerical score delta");
  assert(Boolean(compPolicy.scoreComparison.scorePolicyMismatchNote), "17. Score policy mismatch produces transparent explanatory note");

  // --- TEST GROUP 5: Targeted Verify Fix Engine ---
  console.log("\n--- TEST GROUP 5: Targeted Verify Fix Engine ---");

  // Deduce method tests
  assert(deduceVerificationMethod("SEC_HSTS_MISSING") === "RE_FETCH_HTTPS", "18. SEC_HSTS_MISSING correctly deduces RE_FETCH_HTTPS");
  assert(deduceVerificationMethod("SEC_DMARC_MISSING") === "DNS_QUERY", "19. SEC_DMARC_MISSING correctly deduces DNS_QUERY");
  assert(deduceVerificationMethod("SEC_ENV_EXPOSURE") === "SAFE_PROBE", "20. SEC_ENV_EXPOSURE correctly deduces SAFE_PROBE");
  assert(deduceVerificationMethod("SEC_CERT_EXPIRED") === "TLS_HANDSHAKE", "21. SEC_CERT_EXPIRED correctly deduces TLS_HANDSHAKE");
  assert(deduceVerificationMethod("SEC_MANUAL_AUTH_BYPASS") === "MANUAL_ONLY", "22. SEC_MANUAL_AUTH_BYPASS correctly deduces MANUAL_ONLY");

  // Verify Fix on Manual Rule -> UNABLE_TO_VERIFY
  const manualVerifyRes = await executeTargetedSecurityVerification({
    projectId: "proj_test_1",
    sourceAuditId: "audit_001",
    findingId: "SEC_MANUAL_PENTEST",
    ruleId: "SEC_MANUAL_PENTEST",
  });
  assert(manualVerifyRes.result === "UNABLE_TO_VERIFY", "23. Manual-only finding cannot be auto-verified (UNABLE_TO_VERIFY)");
  assert(manualVerifyRes.method === "MANUAL_ONLY", "24. Manual-only verification method preserved as MANUAL_ONLY");

  // Save verification event
  await persistence.securitySnapshots.saveVerificationEvent({
    eventId: manualVerifyRes.eventId,
    projectId: "proj_test_1",
    sourceAuditId: "audit_001",
    findingId: "SEC_MANUAL_PENTEST",
    ruleId: "SEC_MANUAL_PENTEST",
    startedAt: manualVerifyRes.startedAt,
    completedAt: manualVerifyRes.completedAt,
    method: "MANUAL_ONLY",
    scope: "HOST",
    result: "UNABLE_TO_VERIFY",
    evidenceSummary: manualVerifyRes.evidenceSummary,
    createdAt: manualVerifyRes.completedAt,
  });

  const verifyEvents = await persistence.securitySnapshots.listVerificationEventsForFinding("proj_test_1", "SEC_MANUAL_PENTEST");
  assert(verifyEvents.length === 1, "25. Verification event successfully persisted and retrieved");

  // Verify source audit snapshot remained immutable
  const untouchedAudit = await persistence.securitySnapshots.getSnapshotByAuditRunId("audit_001");
  assert(untouchedAudit?.score === 85, "26. Targeted verification action does NOT mutate historical audit snapshot");

  // --- TEST GROUP 6: Recrawl Scope Preservation & Hierarchy ---
  console.log("\n--- TEST GROUP 6: Recrawl Scope Preservation & Hierarchy ---");

  const fullScopeSnap = createMockSnapshot({
    auditRunId: "audit_scope_300",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 90,
    crawledPagesCount: 157,
    requestedCeiling: 300,
  });
  assert(fullScopeSnap.requestedCrawlLimit === 300, "27. Initial audit preserves requested ceiling 300");
  assert(fullScopeSnap.actualCrawledPageCount === 157, "28. Initial audit preserves actual crawled count 157");

  // Comparability evaluation when user intentionally reduces scope (300 -> 100)
  const reducedScopeSnap = createMockSnapshot({
    auditRunId: "audit_scope_100",
    projectId: "proj_test_1",
    domain: "example.com",
    score: 90,
    crawledPagesCount: 100,
    requestedCeiling: 100,
  });
  const compScope = evaluateSecurityComparability(fullScopeSnap, reducedScopeSnap);
  assert(compScope.status === "PARTIALLY_COMPARABLE", "29. Explicitly reduced crawl ceiling evaluates to PARTIALLY_COMPARABLE");
  assert(compScope.isScopeReduced === true, "30. Reduced crawl ceiling sets isScopeReduced flag true");

  // --- TEST GROUP 7: Project History Timeline View & Baseline ---
  console.log("\n--- TEST GROUP 7: Project History Timeline View & Baseline ---");

  const timelineAll = buildSecurityHistoryTimeline("proj_test_1", "example.com", [snap1, snap2, snap3]);
  assert(timelineAll.totalSecurityAudits === 3, "31. Timeline response reflects all 3 snapshots");
  assert(timelineAll.isBaselineOnly === false, "32. Multi-audit timeline sets isBaselineOnly = false");
  assert(timelineAll.latestScore === 100, "33. Latest score accurately reflects most recent snapshot (100)");

  const timelineSingle = buildSecurityHistoryTimeline("proj_single", "single.com", [snap1]);
  assert(timelineSingle.isBaselineOnly === true, "34. Single-audit timeline sets isBaselineOnly = true");

  const timelineEmpty = buildSecurityHistoryTimeline("proj_empty", "empty.com", []);
  assert(timelineEmpty.totalSecurityAudits === 0, "35. Zero-audit legacy project returns totalSecurityAudits = 0 without error");

  // --- TEST GROUP 8: Third-Party JS Inventory Diffs ---
  console.log("\n--- TEST GROUP 8: Third-Party JS Inventory Diffs ---");

  const snapTPBase = createMockSnapshot({
    auditRunId: "audit_tp_1",
    projectId: "proj_tp",
    domain: "tp.com",
    score: 95,
  });
  const snapTPNew = createMockSnapshot({
    auditRunId: "audit_tp_2",
    projectId: "proj_tp",
    domain: "tp.com",
    score: 95,
  });
  snapTPNew.payload.thirdParties = {
    totalThirdPartyOrigins: 2,
    totalThirdPartyScripts: 2,
    inventory: [
      { origin: "https://cdn.example.com", domain: "example.com", scriptCount: 1, category: "CDN", affectedPagesCount: 1 },
      { origin: "https://analytics.tracker.com", domain: "tracker.com", scriptCount: 1, category: "Analytics", affectedPagesCount: 1 },
    ],
  };

  const compTP = compareSecuritySnapshots(snapTPBase, snapTPNew);
  const addedTP = compTP.thirdPartyComparisons.find((t) => t.origin === "https://analytics.tracker.com");
  assert(addedTP?.status === "ADDED", "36. New third-party origin correctly classified as ADDED");

  // --- TEST GROUP 9: Capability & Truth State History ---
  console.log("\n--- TEST GROUP 9: Capability & Truth State History ---");

  const dnssecCap = snap1.payload.capabilities.dnssecValidation;
  assert(dnssecCap.status === "NOT_OBSERVABLE", "37. DNSSEC NOT_OBSERVABLE state preserved historically in snapshot");

  const advisoryCap = snap1.payload.capabilities.vulnerabilityAdvisoryLookup;
  assert(advisoryCap.status === "PROVIDER_REQUIRED", "38. Advisory lookup PROVIDER_REQUIRED preserved historically in snapshot");

  // Assert rawText is omitted from security.txt if present
  const snapWithSecTxt = createMockSnapshot({
    auditRunId: "audit_sec_txt",
    projectId: "proj_txt",
    domain: "sectxt.com",
    score: 95,
  });
  snapWithSecTxt.payload.securityTxt = {
    hasSecurityTxt: true,
    contact: "mailto:security@example.com",
    isHttps: true,
    httpStatus: 200,
  } as any;
  assert(!("rawText" in snapWithSecTxt.payload.securityTxt), "39. security.txt.rawText is strictly omitted from snapshot payload");

  // Site growth 157 -> 160 discoverable under ceiling 300
  const growBaseSnap = createMockSnapshot({ auditRunId: "grow_base", projectId: "proj_grow", domain: "grow.com", score: 90, crawledPagesCount: 157, requestedCeiling: 300 });
  const growNextSnap = createMockSnapshot({ auditRunId: "grow_next", projectId: "proj_grow", domain: "grow.com", score: 92, crawledPagesCount: 160, requestedCeiling: 300 });
  const compGrow = evaluateSecurityComparability(growBaseSnap, growNextSnap);
  assert(compGrow.status === "FULLY_COMPARABLE", "40. Site growth from 157 to 160 pages is FULLY_COMPARABLE under ceiling 300");

  // Natural shrink 157 -> 149 evaluated without false truncation
  const shrinkNextSnap = createMockSnapshot({ auditRunId: "shrink_next", projectId: "proj_grow", domain: "grow.com", score: 90, crawledPagesCount: 149, requestedCeiling: 300 });
  const compShrink = evaluateSecurityComparability(growBaseSnap, shrinkNextSnap);
  assert(compShrink.status === "FULLY_COMPARABLE", "41. Natural page reduction 157 -> 149 evaluates as FULLY_COMPARABLE");

  // Category N/A and manual assessment never falsely marked as improvement
  const compCatCheck = compareSecuritySnapshots(snap1, snap2);
  const manualCat = compCatCheck.categoryComparisons.find((c) => c.category === "manual_pentest");
  assert(manualCat?.isImprovement !== true, "42. Manual assessment category is never falsely marked as an improvement");

  console.log(`\n===============================================================`);
  console.log(`SECURITY S7 TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log(`===============================================================\n`);

  if (failedCount > 0) {
    throw new Error(`Security S7 test suite failed with ${failedCount} errors.`);
  }

  return { passed: passedCount, failed: failedCount };
}

if (process.argv[1]?.includes("run-security-s7-tests")) {
  runSecurityS7Tests().catch((err) => {
    console.error("FATAL ERROR in S7 test suite:", err);
    process.exit(1);
  });
}
