/**
 * Phase 28K: Unified Remediation Workflow & Client Reporting Certification Test Suite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { RemediationWorkflowEngine } from "../engine";
import { SqliteWorkflowRepository } from "../persistence/sqlite-workflow-repo";
import { ClientReportEngine, REPORT_ENGINE_VERSION } from "../../reporting/engine";
import { SqliteClientReportRepository } from "../../reporting/persistence/sqlite-report-repo";
import { RemediationCsvExporter } from "../../reporting/csv-exporter";
import { ClientPdfGenerator } from "../../reporting/pdf-generator";
import { validateWorkflowInvariants, validateReportInvariants } from "../invariants";
import { getClientSafePresentation } from "../client-labels";
import { ActionItem } from "../types";

describe("Phase 28K: Remediation Workflow & Client Reporting", () => {
  let db: DatabaseSync;
  let workflowEngine: RemediationWorkflowEngine;
  let workflowRepo: SqliteWorkflowRepository;
  let reportEngine: ClientReportEngine;
  let reportRepo: SqliteClientReportRepository;

  const projectId = "proj_test_28k";
  const projectName = "BOT Consulting";
  const domain = "botconsulting.io";

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    workflowEngine = new RemediationWorkflowEngine();
    workflowRepo = new SqliteWorkflowRepository(db);
    reportEngine = new ClientReportEngine();
    reportRepo = new SqliteClientReportRepository(db);
  });

  it("1. Unified Action Creation, Consolidation & Source Traceability", () => {
    const mockAuditResult = {
      healthScore: 70.8,
      ruleExecutionObservability: [
        {
          ruleId: "CONTENT_SKIPPED_HEADINGS",
          ruleTitle: "Skipped Heading Levels",
          category: "CONTENT_STRUCTURE",
          severity: "MEDIUM",
          passed: false,
          summary: "Heading level skipped from H1 to H3.",
          recommendation: "Use sequential heading levels.",
          affectedPages: ["https://botconsulting.io/services/servicenow", "https://botconsulting.io/about"],
          occurrences: [
            { selector: "h3.title-sub", identity: "h3:title-sub", location: "Header Banner" },
            { selector: "h4.feature-sub", identity: "h4:feature-sub", location: "Feature Section" },
          ],
        },
        {
          ruleId: "ACCESSIBILITY_UNLABELLED_FORM_CONTROL",
          ruleTitle: "Unlabelled Form Controls",
          category: "ACCESSIBILITY",
          severity: "HIGH",
          passed: false,
          summary: "Form input missing label.",
          recommendation: "Add aria-label or label tag.",
          affectedPages: ["https://botconsulting.io/contact"],
          occurrences: [
            { selector: "input#email", identity: "input:email" },
            { selector: "input#phone", identity: "input:phone" },
          ],
        },
      ],
    };

    const actionItems = workflowEngine.generateActionItemsFromAudit(
      projectId,
      "audit_run_101",
      mockAuditResult,
      []
    );

    expect(actionItems.length).toBe(2);

    const headingItem = actionItems.find((i) => i.sourceId === "CONTENT_SKIPPED_HEADINGS");
    expect(headingItem).toBeDefined();
    expect(headingItem!.title).toBe("Heading Hierarchy Improvement");
    expect(headingItem!.effectivePriority).toBe("MEDIUM");
    expect(headingItem!.affectedUrls.length).toBe(2);
    expect(headingItem!.totalOccurrences).toBe(2);
    expect(headingItem!.status).toBe("OPEN");
    expect(headingItem!.sourceSnapshotRef.auditRunId).toBe("audit_run_101");

    const accessItem = actionItems.find((i) => i.sourceId === "ACCESSIBILITY_UNLABELLED_FORM_CONTROL");
    expect(accessItem).toBeDefined();
    expect(accessItem!.effectivePriority).toBe("HIGH");
    expect(accessItem!.totalOccurrences).toBe(2);

    workflowRepo.saveActionItems(actionItems);
    const loaded = workflowRepo.getActionItems(projectId);
    expect(loaded.length).toBe(2);
  });

  it("2. User-Done Negative Control & State Transitions", () => {
    let item: ActionItem = {
      actionItemId: "act_1",
      projectId,
      sourceType: "SEO_FINDING",
      sourceId: "TITLE_TAG_MISSING",
      title: "Missing Primary Page Title",
      summary: "Page has no title tag.",
      systemPriority: "HIGH",
      userPriority: null,
      effectivePriority: "HIGH",
      priorityReason: "High priority SEO tag",
      status: "OPEN",
      userSetStatus: null,
      systemVerifiedStatus: null,
      lastVerifiedAt: null,
      verificationMethod: "LIVE_HTTP_AND_DOM_VERIFICATION",
      category: "TECHNICAL_SEO",
      clientSafeLabel: "Missing Primary Page Title",
      affectedUrls: ["https://botconsulting.io/terms"],
      affectedPrompts: [],
      totalOccurrences: 1,
      resolvedOccurrences: 0,
      remainingOccurrences: 1,
      occurrences: [{ occurrenceId: "occ_1", url: "https://botconsulting.io/terms", isResolved: false }],
      whatIsWrong: "Missing title",
      whyItMatters: "Search engine ranking",
      whereItOccurs: "1 page",
      whatToChange: "Add title",
      howToChange: "Edit template",
      howToVerify: "Check live page",
      recommendation: "Add title tag",
      assigneeName: null,
      dueDate: null,
      blockerReason: null,
      blockerDetail: null,
      notes: [],
      history: [],
      sourceSnapshotRef: { auditRunId: "audit_1" },
      lastVerificationEvidence: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // User starts work -> IN_PROGRESS
    item = workflowEngine.updateItemStatus(item, "IN_PROGRESS", "USER");
    expect(item.status).toBe("IN_PROGRESS");
    expect(item.userSetStatus).toBe("IN_PROGRESS");

    // User marks "DONE" / "VERIFIED_FIXED" -> MUST SET READY_TO_VERIFY (Never VERIFIED_FIXED)
    item = workflowEngine.updateItemStatus(item, "VERIFIED_FIXED", "USER");
    expect(item.status).toBe("READY_TO_VERIFY");
    expect(item.userSetStatus).toBe("READY_TO_VERIFY");
    expect(item.systemVerifiedStatus).toBeNull();
  });

  it("3. Blocker Control & History Tracking", () => {
    let item: ActionItem = {
      actionItemId: "act_dns_block",
      projectId,
      sourceType: "TECHNICAL_OPPORTUNITY",
      sourceId: "DNS_CONFIG",
      title: "DNS SSL Certificate Renewal",
      summary: "Domain requires CAA record update.",
      systemPriority: "CRITICAL",
      userPriority: null,
      effectivePriority: "CRITICAL",
      priorityReason: "SSL issue",
      status: "IN_PROGRESS",
      userSetStatus: "IN_PROGRESS",
      systemVerifiedStatus: null,
      lastVerifiedAt: null,
      verificationMethod: "DNS_QUERY",
      category: "INFRASTRUCTURE",
      clientSafeLabel: "SSL Security Certificate",
      affectedUrls: ["https://botconsulting.io"],
      affectedPrompts: [],
      totalOccurrences: 1,
      resolvedOccurrences: 0,
      remainingOccurrences: 1,
      occurrences: [],
      whatIsWrong: "DNS CAA record missing",
      whyItMatters: "Prevents certificate renewal",
      whereItOccurs: "Domain level",
      whatToChange: "Update DNS CAA records",
      howToChange: "Login to DNS registrar",
      howToVerify: "Query dig CAA",
      recommendation: "Add CAA record",
      assigneeName: "Ashutosh",
      dueDate: "2026-09-01",
      blockerReason: null,
      blockerDetail: null,
      notes: [],
      history: [],
      sourceSnapshotRef: {},
      lastVerificationEvidence: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Set Blocker
    item = workflowEngine.setBlocker(
      item,
      "DNS_ACCESS_REQUIRED",
      "Awaiting DNS provider credentials from client team.",
      "USER"
    );

    expect(item.status).toBe("BLOCKED");
    expect(item.blockerReason).toBe("DNS_ACCESS_REQUIRED");
    expect(item.blockerDetail).toBe("Awaiting DNS provider credentials from client team.");
    expect(item.history.length).toBeGreaterThan(0);

    // Unblock -> resumes to IN_PROGRESS
    item = workflowEngine.setBlocker(item, null, null, "USER");
    expect(item.status).toBe("IN_PROGRESS");
    expect(item.blockerReason).toBeNull();
  });

  it("4. Priority Override Preserves System Priority", () => {
    let item: ActionItem = {
      actionItemId: "act_prio_test",
      projectId,
      sourceType: "SEO_FINDING",
      sourceId: "IMAGES_MISSING_EXPLICIT_DIMENSIONS",
      title: "Images Missing Explicit Dimensions",
      summary: "Images lack width and height.",
      systemPriority: "LOW",
      userPriority: null,
      effectivePriority: "LOW",
      priorityReason: "Low impact on CLS",
      status: "OPEN",
      userSetStatus: null,
      systemVerifiedStatus: null,
      lastVerifiedAt: null,
      verificationMethod: "LIVE_DOM",
      category: "PERFORMANCE",
      clientSafeLabel: "Image Layout Dimensions",
      affectedUrls: ["https://botconsulting.io/about"],
      affectedPrompts: [],
      totalOccurrences: 5,
      resolvedOccurrences: 0,
      remainingOccurrences: 5,
      occurrences: [],
      whatIsWrong: "Missing width/height",
      whyItMatters: "CLS optimization",
      whereItOccurs: "5 images",
      whatToChange: "Add dimensions",
      howToChange: "Set attributes",
      howToVerify: "Inspect DOM",
      recommendation: "Add dimensions",
      assigneeName: null,
      dueDate: null,
      blockerReason: null,
      blockerDetail: null,
      notes: [],
      history: [],
      sourceSnapshotRef: {},
      lastVerificationEvidence: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // User overrides priority to HIGH
    item = workflowEngine.setPriorityOverride(item, "HIGH", "USER");
    expect(item.systemPriority).toBe("LOW");
    expect(item.userPriority).toBe("HIGH");
    expect(item.effectivePriority).toBe("HIGH");

    // User clears override -> reverts to system priority LOW
    item = workflowEngine.setPriorityOverride(item, null, "USER");
    expect(item.systemPriority).toBe("LOW");
    expect(item.userPriority).toBeNull();
    expect(item.effectivePriority).toBe("LOW");
  });

  it("5. Reconciliation Control: Still Open -> Resolved -> Reopened", () => {
    // Initial Audit Run 1: Finding exists
    const audit1 = {
      healthScore: 65.0,
      ruleExecutionObservability: [
        {
          ruleId: "TITLE_TAG_MISSING",
          ruleTitle: "Missing Page Title",
          category: "TECHNICAL_SEO",
          passed: false,
          summary: "Missing title tag.",
          affectedPages: ["https://botconsulting.io/contact"],
        },
      ],
    };

    let items = workflowEngine.generateActionItemsFromAudit(projectId, "audit_1", audit1, []);
    expect(items.length).toBe(1);
    expect(items[0].status).toBe("OPEN");

    // Audit Run 2: Finding resolved
    const audit2 = {
      healthScore: 72.0,
      ruleExecutionObservability: [
        {
          ruleId: "TITLE_TAG_MISSING",
          ruleTitle: "Missing Page Title",
          category: "TECHNICAL_SEO",
          passed: true,
          summary: "Title tag is present.",
          affectedPages: [],
        },
      ],
    };

    items = workflowEngine.generateActionItemsFromAudit(projectId, "audit_2", audit2, items);
    expect(items.length).toBe(1);
    expect(items[0].status).toBe("VERIFIED_FIXED");
    expect(items[0].remainingOccurrences).toBe(0);

    // Audit Run 3: Regression occurs -> defect reappears
    const audit3 = {
      healthScore: 68.0,
      ruleExecutionObservability: [
        {
          ruleId: "TITLE_TAG_MISSING",
          ruleTitle: "Missing Page Title",
          category: "TECHNICAL_SEO",
          passed: false,
          summary: "Missing title tag again.",
          affectedPages: ["https://botconsulting.io/contact"],
        },
      ],
    };

    items = workflowEngine.generateActionItemsFromAudit(projectId, "audit_3", audit3, items);
    expect(items.length).toBe(1);
    expect(items[0].status).toBe("REOPENED");
  });

  it("6. Workflow Denominator Invariants & Occurrence Bounds", () => {
    const items: ActionItem[] = [
      {
        actionItemId: "act_inv_1",
        projectId,
        sourceType: "SEO_FINDING",
        sourceId: "RULE_1",
        title: "Test 1",
        summary: "Summary 1",
        systemPriority: "HIGH",
        userPriority: null,
        effectivePriority: "HIGH",
        priorityReason: "Prio 1",
        status: "OPEN",
        userSetStatus: null,
        systemVerifiedStatus: null,
        lastVerifiedAt: null,
        verificationMethod: "LIVE",
        category: "TECHNICAL_SEO",
        clientSafeLabel: "Test 1",
        affectedUrls: ["https://botconsulting.io/1"],
        affectedPrompts: [],
        totalOccurrences: 4,
        resolvedOccurrences: 0,
        remainingOccurrences: 4,
        occurrences: [],
        whatIsWrong: "Wrong",
        whyItMatters: "Matters",
        whereItOccurs: "Where",
        whatToChange: "Change",
        howToChange: "How",
        howToVerify: "Verify",
        recommendation: "Rec",
        assigneeName: null,
        dueDate: null,
        blockerReason: null,
        blockerDetail: null,
        notes: [],
        history: [],
        sourceSnapshotRef: {},
        lastVerificationEvidence: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        actionItemId: "act_inv_2",
        projectId,
        sourceType: "SEO_FINDING",
        sourceId: "RULE_2",
        title: "Test 2",
        summary: "Summary 2",
        systemPriority: "MEDIUM",
        userPriority: null,
        effectivePriority: "MEDIUM",
        priorityReason: "Prio 2",
        status: "VERIFIED_FIXED",
        userSetStatus: null,
        systemVerifiedStatus: "VERIFIED_FIXED",
        lastVerifiedAt: new Date().toISOString(),
        verificationMethod: "LIVE",
        category: "CONTENT",
        clientSafeLabel: "Test 2",
        affectedUrls: ["https://botconsulting.io/2"],
        affectedPrompts: [],
        totalOccurrences: 6,
        resolvedOccurrences: 6,
        remainingOccurrences: 0,
        occurrences: [],
        whatIsWrong: "Wrong",
        whyItMatters: "Matters",
        whereItOccurs: "Where",
        whatToChange: "Change",
        howToChange: "How",
        howToVerify: "Verify",
        recommendation: "Rec",
        assigneeName: null,
        dueDate: null,
        blockerReason: null,
        blockerDetail: null,
        notes: [],
        history: [],
        sourceSnapshotRef: {},
        lastVerificationEvidence: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const summary = workflowEngine.computeQueueSummary(projectId, items);
    expect(summary.totalActionItems).toBe(2);
    expect(summary.openCount).toBe(1);
    expect(summary.verifiedFixedCount).toBe(1);
    expect(summary.totalOriginalOccurrences).toBe(10);
    expect(summary.resolvedOriginalOccurrences).toBe(6);
    expect(summary.remainingOccurrences).toBe(4);

    expect(() => validateWorkflowInvariants(items, summary)).not.toThrow();
  });

  it("7. Client Report Snapshot Generation & Arithmetic Invariants", () => {
    const currentAudit = {
      auditRunId: "audit_current",
      healthScore: 70.8,
      ruleExecutionObservability: [
        { ruleId: "CONTENT_SKIPPED_HEADINGS", ruleTitle: "Skipped Headings", passed: false },
        { ruleId: "TECH_MISSING_CANONICAL", ruleTitle: "Missing Canonical", passed: true },
      ],
    };

    const previousAudit = {
      auditRunId: "audit_prev",
      healthScore: 63.3,
      ruleExecutionObservability: [
        { ruleId: "CONTENT_SKIPPED_HEADINGS", ruleTitle: "Skipped Headings", passed: false },
        { ruleId: "TECH_MISSING_CANONICAL", ruleTitle: "Missing Canonical", passed: false },
      ],
    };

    const actionItems: ActionItem[] = [
      {
        actionItemId: "act_1",
        projectId,
        sourceType: "SEO_FINDING",
        sourceId: "CONTENT_SKIPPED_HEADINGS",
        title: "Heading Hierarchy Improvement",
        summary: "Heading skipped",
        systemPriority: "MEDIUM",
        userPriority: null,
        effectivePriority: "MEDIUM",
        priorityReason: "Structure",
        status: "OPEN",
        userSetStatus: null,
        systemVerifiedStatus: null,
        lastVerifiedAt: null,
        verificationMethod: "LIVE",
        category: "CONTENT_STRUCTURE",
        clientSafeLabel: "Heading Hierarchy Improvement",
        affectedUrls: ["https://botconsulting.io/services"],
        affectedPrompts: [],
        totalOccurrences: 1,
        resolvedOccurrences: 0,
        remainingOccurrences: 1,
        occurrences: [],
        whatIsWrong: "Heading skipped",
        whyItMatters: "Content hierarchy",
        whereItOccurs: "Services page",
        whatToChange: "Fix heading tags",
        howToChange: "Update HTML",
        howToVerify: "Re-check DOM",
        recommendation: "Fix heading tags",
        assigneeName: null,
        dueDate: null,
        blockerReason: null,
        blockerDetail: null,
        notes: [],
        history: [],
        sourceSnapshotRef: {},
        lastVerificationEvidence: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const aiMeasurementSnapshot = {
      snapshotId: "meas_101",
      promptUniverseSize: 132,
      summary: {
        adequatelyServedPrompts: 38,
        highPriorityServedPrompts: 23,
        highPriorityPrompts: 38,
        clearPrimaryTargets: 85,
      },
      categoryHealth: [],
      providerObservationStatus: { availabilityState: "PROVIDER_EVIDENCE_UNAVAILABLE" },
    };

    const competitiveSnapshot = {
      snapshotId: "comp_101",
      summary: {
        totalPromptsCompared: 132,
        clientAdvantagesCount: 102,
        competitorAdvantagesCount: 2,
        roughParityCount: 0,
        bothWeakCount: 28,
        opportunitiesCount: 2,
      },
      competitorCorpusSummaries: [{ domain: "designdream.agency" }],
    };

    const report = reportEngine.generateClientReport(
      projectId,
      projectName,
      domain,
      currentAudit,
      previousAudit,
      actionItems,
      aiMeasurementSnapshot,
      competitiveSnapshot,
      { audience: "EXECUTIVE" }
    );

    expect(report.reportVersion).toBe(REPORT_ENGINE_VERSION);
    expect(report.seoHealth.currentScore).toBe(70.8);
    expect(report.seoHealth.previousScore).toBe(63.3);
    expect(report.seoHealth.scoreDelta).toBe(7.5);
    expect(report.seoHealth.scoreDrivers.length).toBeGreaterThan(0);
    expect(report.competitiveIntelligence.clientWins).toBe(102);
    expect(report.methodologyAndCaveats.comparability).toBe("DIRECTLY_COMPARABLE");

    expect(() => validateReportInvariants(report)).not.toThrow();

    reportRepo.saveReportSnapshot(report);
    const loadedReport = reportRepo.getLatestReportSnapshot(projectId);
    expect(loadedReport).toBeDefined();
    expect(loadedReport!.fingerprint).toBe(report.fingerprint);
  });

  it("8. Five-Run Determinism for Client Report Fingerprint (Δ = 0.0)", () => {
    const currentAudit = { healthScore: 70.8, ruleExecutionObservability: [] };
    const actionItems: ActionItem[] = [];

    const fingerprints: string[] = [];

    for (let i = 0; i < 5; i++) {
      const rep = reportEngine.generateClientReport(
        projectId,
        projectName,
        domain,
        currentAudit,
        null,
        actionItems,
        null,
        null,
        { audience: "EXECUTIVE" }
      );
      fingerprints.push(rep.fingerprint);
    }

    const first = fingerprints[0];
    for (const fp of fingerprints) {
      expect(fp).toBe(first);
    }
  });

  it("9. CSV Export & Reparsing Validation", () => {
    const items: ActionItem[] = [
      {
        actionItemId: "act_csv_1",
        projectId,
        sourceType: "SEO_FINDING",
        sourceId: "RULE_CSV",
        title: "Heading Hierarchy, with comma and \"quotes\"",
        summary: "Summary with\nnewline and symbols: € & ©",
        systemPriority: "HIGH",
        userPriority: null,
        effectivePriority: "HIGH",
        priorityReason: "High priority",
        status: "OPEN",
        userSetStatus: null,
        systemVerifiedStatus: null,
        lastVerifiedAt: null,
        verificationMethod: "LIVE",
        category: "CONTENT",
        clientSafeLabel: "Heading Hierarchy",
        affectedUrls: ["https://botconsulting.io/page-1", "https://botconsulting.io/page-2"],
        affectedPrompts: ["Prompt A", "Prompt B"],
        totalOccurrences: 2,
        resolvedOccurrences: 0,
        remainingOccurrences: 2,
        occurrences: [],
        whatIsWrong: "Wrong",
        whyItMatters: "Matters",
        whereItOccurs: "Where",
        whatToChange: "Change",
        howToChange: "How",
        howToVerify: "Verify",
        recommendation: "Rec",
        assigneeName: "Developer A",
        dueDate: "2026-08-30",
        blockerReason: null,
        blockerDetail: null,
        notes: [],
        history: [],
        sourceSnapshotRef: {},
        lastVerificationEvidence: null,
        createdAt: "2026-08-25T10:00:00Z",
        updatedAt: "2026-08-25T10:00:00Z",
      },
    ];

    const csv = RemediationCsvExporter.exportActionItemsToCsv(items);
    expect(csv).toContain("Action ID,Source,Category");
    expect(csv).toContain("act_csv_1");
    expect(csv).toContain('"Heading Hierarchy, with comma and ""quotes"""');
    expect(csv).toContain("Developer A");
    expect(csv).toContain("2026-08-30");
  });

  it("10. PDF Report HTML & Buffer Generation Validation", async () => {
    const currentAudit = { healthScore: 70.8, ruleExecutionObservability: [] };
    const report = reportEngine.generateClientReport(
      projectId,
      projectName,
      domain,
      currentAudit,
      null,
      [],
      null,
      null,
      { audience: "EXECUTIVE" }
    );

    const html = ClientPdfGenerator.generateReportHtml(report);
    expect(html).toContain("SEO & AI Intelligence Report");
    expect(html).toContain("BOT Consulting");
    expect(html).toContain("70.8");
    expect(html).toContain("EXECUTIVE REPORT");

    const pdfBuffer = await ClientPdfGenerator.generateReportPdfBuffer(report);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // Valid PDF signature check
    expect(pdfBuffer.toString("utf-8", 0, 8)).toBe("%PDF-1.4");
  });
});
