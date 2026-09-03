/**
 * Phase 24: Real Crawler -> Persistence Integration Bridge.
 * Orchestrates: Project -> Start Audit -> Crawler Pipeline -> Persist Pages -> Persist Findings
 * -> Persist Metrics -> Persist Config/Rule Context -> Finalize Audit -> Generate Comparison -> Update Project.
 */

import { PersistenceLayer } from "./index";
import {
  ProjectEntity,
  AuditRunEntity,
  AuditPageEntity,
  AuditFindingEntity,
  AuditMetricEntity,
  AuditComparisonResult,
  AuditTriggerType,
} from "./types";
import { generateStableFindingFingerprint } from "./fingerprint";
import { computeAuditComparison } from "./comparison-engine";
import { reconstructHistoricalReportMarkdown } from "./historical-report";
import { runSiteAuditCrawl } from "../engine";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../verification/rule-inventory";
import type { CrawlOptions, CrawlAuditResult } from "../types";

export interface ExecuteAndPersistAuditInput {
  project: ProjectEntity;
  persistenceLayer: PersistenceLayer;
  crawlOptions: CrawlOptions;
  trigger?: AuditTriggerType;
  customCrawlerExecutor?: (opts: CrawlOptions) => Promise<CrawlAuditResult>;
}

export interface ExecuteAndPersistAuditOutput {
  auditRun: AuditRunEntity;
  pages: AuditPageEntity[];
  findings: AuditFindingEntity[];
  metrics: AuditMetricEntity;
  comparison?: AuditComparisonResult | null;
  historicalReportMarkdown: string;
  crawlResult?: any;
}

const projectSequenceLocks = new Map<string, Promise<any>>();

async function withProjectSequenceLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = projectSequenceLocks.get(projectId) || Promise.resolve();
  let release: () => void;
  const newLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  projectSequenceLocks.set(projectId, newLock);
  try {
    await currentLock;
    return await fn();
  } finally {
    release!();
  }
}

export async function executeAndPersistAudit(
  input: ExecuteAndPersistAuditInput
): Promise<ExecuteAndPersistAuditOutput> {
  const { project, persistenceLayer, crawlOptions, trigger = "MANUAL", customCrawlerExecutor } = input;

  // Retrieve previous completed audit to determine known scope and known URLs
  const latestCompletedAudit = await persistenceLayer.auditRuns.getLatestAuditRunForProject(project.projectId);
  let previousKnownPages: AuditPageEntity[] = [];
  if (latestCompletedAudit && latestCompletedAudit.status === "COMPLETED") {
    previousKnownPages = await persistenceLayer.auditPages.getPagesForAuditRun(latestCompletedAudit.auditRunId);
  }
  const knownScope = previousKnownPages.length;
  const knownUrls = crawlOptions.knownUrls || previousKnownPages.map((p) => p.normalizedUrl);

  const discoveryCeiling = crawlOptions.discoveryCeiling || crawlOptions.maxPages || project.metadata?.crawlDiscoveryCeiling || 300;

  // 1. Get next project-local sequence number and create audit run atomically
  const { auditRun, ruleContext } = await withProjectSequenceLock(project.projectId, async () => {
    const sequenceNumber = await persistenceLayer.auditRuns.getNextSequenceNumber(project.projectId);
    const auditRunId = `audit_${project.projectId}_seq_${sequenceNumber}_${Date.now()}`;
    const startedAt = new Date().toISOString();

    const evaluatedRuleIds = IMPLEMENTED_DIAGNOSTIC_RULES.map((r) => r.ruleCode);
    const context = {
      productionRuleCount: IMPLEMENTED_DIAGNOSTIC_RULES.length,
      ruleInventoryVersion: "1.0.0",
      evaluatedRuleIds,
    };

    const run = await persistenceLayer.auditRuns.createAuditRun({
      auditRunId,
      projectId: project.projectId,
      sequenceNumber,
      startedAt,
      status: "RUNNING",
      trigger,
      crawlerVersion: "2.4.0",
      ruleInventoryVersion: "1.0.0",
      productionRuleCount: IMPLEMENTED_DIAGNOSTIC_RULES.length,
      policyVersions: JSON.stringify({ policyVersion: "1.1.0" }),
      configurationSnapshot: {
        crawlSettings: {
          maxPages: discoveryCeiling,
          requestedCrawlLimit: discoveryCeiling,
          discoveryCeiling: discoveryCeiling,
          previousKnownScope: knownScope,
          maxDepth: crawlOptions.maxDepth ?? 5,
          userAgent: (crawlOptions as any).userAgent,
          respectRobotsTxt: (crawlOptions as any).respectRobotsTxt !== false,
        },
        countryContext: project.defaultCountry || "US",
        deviceContext: project.defaultDevice || "MOBILE",
        ruleInventoryVersion: "1.0.0",
        productionRuleCount: 95,
        crawlerVersion: "2.4.0",
        policyVersions: { policyVersion: "1.1.0" },
        ruleEvaluationContext: context,
      },
    });

    return { auditRun: run, ruleContext: context };
  });

  const auditRunId = auditRun.auditRunId;

  // 4. Run real crawler pipeline (or custom fixture executor) with known URLs and discovery ceiling
  const crawlerExecutor = customCrawlerExecutor || runSiteAuditCrawl;
  const effectiveCrawlOptions: CrawlOptions = {
    ...crawlOptions,
    maxPages: discoveryCeiling,
    discoveryCeiling,
    knownUrls,
    previousKnownScope: knownScope,
  };
  const crawlResult = await crawlerExecutor(effectiveCrawlOptions);

  // 5. Transform and persist crawled pages
  const crawledPagesList = crawlResult.crawledPages || (crawlResult as any).pages || [];
  const auditPages: AuditPageEntity[] = (crawledPagesList as any[]).map((p, idx) => ({
    auditPageId: `page_${auditRunId}_${idx}`,
    auditRunId,
    projectId: project.projectId,
    normalizedUrl: p.normalizedUrl || p.url,
    originalUrl: p.url,
    finalUrl: p.url,
    statusCode: p.statusCode || 200,
    indexability: p.isIndexable ? "INDEXABLE" : "NON_INDEXABLE",
    canonicalUrl: p.canonicalUrl || undefined,
    title: p.title || undefined,
    metaDescription: p.metaDescription || undefined,
    h1Summary: p.h1s && p.h1s.length > 0 ? p.h1s.join(" | ") : undefined,
    contentHash: p.contentHash || undefined,
    templateIdentity: p.templateIdentity || undefined,
    crawlDepth: p.crawlDepth || 0,
    redirectChain: p.redirectChain || [],
    responseMetadata: {
      responseTimeMs: p.responseTimeMs,
      wordCount: p.wordCount,
    },
    createdAt: new Date().toISOString(),
  }));

  if (auditPages.length > 0) {
    await persistenceLayer.auditPages.batchInsertPages(auditPages);
  }

  // 6. Transform and persist diagnostic findings
  const auditFindings: AuditFindingEntity[] = [];
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let informationalCount = 0;

  for (const issue of crawlResult.issues || []) {
    const sev = (issue.severity || "warning").toUpperCase();
    let mappedSeverity: AuditFindingEntity["severity"] = "MEDIUM";
    if (sev === "CRITICAL") {
      mappedSeverity = "CRITICAL";
      criticalCount += issue.affectedPages?.length || 1;
    } else if (sev === "WARNING") {
      mappedSeverity = "HIGH";
      highCount += issue.affectedPages?.length || 1;
    } else if (sev === "OPPORTUNITY") {
      mappedSeverity = "MEDIUM";
      mediumCount += issue.affectedPages?.length || 1;
    } else if (sev === "NOTICE") {
      mappedSeverity = "LOW";
      lowCount += issue.affectedPages?.length || 1;
    } else {
      informationalCount += issue.affectedPages?.length || 1;
    }

    const seenFingerprints = new Map<string, number>();
    for (const aff of issue.affectedPages || []) {
      const normalizedUrl = aff.url;
      const targetResource = aff.evidence?.targetUrl || aff.evidence?.imageSrc || aff.evidence?.src || aff.evidence?.domSelector || undefined;
      const baseFprint = generateStableFindingFingerprint({
        projectId: project.projectId,
        ruleId: issue.code,
        normalizedUrl,
        targetResource,
        evidence: aff.evidence as any,
      });

      const count = seenFingerprints.get(baseFprint) || 0;
      seenFingerprints.set(baseFprint, count + 1);
      const fprint = count === 0 ? baseFprint : `${baseFprint}__occ_${count}`;

      auditFindings.push({
        auditFindingId: `f_${auditRunId}_${auditFindings.length + 1}`,
        auditRunId,
        projectId: project.projectId,
        ruleId: issue.code,
        severity: mappedSeverity,
        findingState: "OPEN",
        message: aff.evidence?.observed || issue.description || issue.title,
        evidence: aff.evidence as any || {},
        normalizedUrl,
        findingFingerprint: fprint,
        targetResource,
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (auditFindings.length > 0) {
    await persistenceLayer.auditFindings.batchInsertFindings(auditFindings);
  }

  // 7. Persist metrics
  const totalFindings = auditFindings.length;
  const seoScore = crawlResult.healthScore ?? (crawlResult as any).summary?.score ?? 80;
  const auditMetric: AuditMetricEntity = {
    metricId: `metric_${auditRunId}`,
    auditRunId,
    projectId: project.projectId,
    pagesCrawled: auditPages.length,
    pagesIndexable: auditPages.filter((p) => p.indexability === "INDEXABLE").length,
    totalFindings,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    informationalCount,
    seoScore,
    createdAt: new Date().toISOString(),
  };

  await persistenceLayer.auditMetrics.saveMetrics(auditMetric);

  // 8. Persist immutable snapshot JSON (including full crawlResult)
  await persistenceLayer.auditSnapshots.saveSnapshot({
    snapshotId: `snap_${auditRunId}`,
    auditRunId,
    projectId: project.projectId,
    payloadJson: JSON.stringify({
      auditRunId,
      projectId: project.projectId,
      sequenceNumber: auditRun.sequenceNumber,
      crawlResult,
      crawlSummary: (crawlResult as any).summary || { score: seoScore, totalIssues: totalFindings },
      pagesCount: auditPages.length,
      findingsCount: auditFindings.length,
    }),
    immutabilityStatement: "RUNTIME_IMMUTABLE_FREEZE",
    createdAt: new Date().toISOString(),
  });

  // 9. Finalize Audit Run Status to COMPLETED
  const completedAt = new Date().toISOString();
  await persistenceLayer.auditRuns.updateAuditRunStatus(auditRunId, "COMPLETED", completedAt, {
    pagesCrawled: auditPages.length,
    pagesIndexable: auditPages.filter((p) => p.indexability === "INDEXABLE").length,
    totalFindings,
    criticalFindings: criticalCount,
    highFindings: highCount,
    mediumFindings: mediumCount,
    lowFindings: lowCount,
    informationalFindings: informationalCount,
    seoScore,
    discoveryCeiling,
    discoveredPageCount: auditPages.length,
    previousKnownScope: knownScope,
  } as any);

  // 10. Update inventory on crawlResult for runtime fidelity
  if (crawlResult && crawlResult.inventory) {
    crawlResult.inventory.maxPagesConfigured = discoveryCeiling;
    crawlResult.inventory.discoveryCeiling = discoveryCeiling;
    crawlResult.inventory.previousKnownScope = knownScope;
    crawlResult.inventory.totalCrawled = auditPages.length;
  }

  // 11. Generate Default Comparison against previous audit if available
  let comparison: AuditComparisonResult | null = null;
  const allProjectRuns = await persistenceLayer.auditRuns.listAuditRunsForProject(project.projectId);
  const previousRun = allProjectRuns.find((r) => r.sequenceNumber === auditRun.sequenceNumber - 1 && r.status === "COMPLETED");

  if (previousRun) {
    const basePages = await persistenceLayer.auditPages.getPagesForAuditRun(previousRun.auditRunId);
    const baseFindings = await persistenceLayer.auditFindings.getFindingsForAuditRun(previousRun.auditRunId);
    const historicalFindings = await persistenceLayer.auditFindings.listHistoricalFindingsForFingerprints(
      project.projectId,
      auditFindings.map((f) => f.findingFingerprint)
    );

    const completedAuditRun = (await persistenceLayer.auditRuns.getAuditRunById(auditRunId))!;
    comparison = computeAuditComparison({
      projectId: project.projectId,
      baselineAudit: previousRun,
      currentAudit: completedAuditRun,
      baselinePages: basePages,
      currentPages: auditPages,
      baselineFindings: baseFindings,
      currentFindings: auditFindings,
      historicalFindingsForProject: historicalFindings,
    });

    await persistenceLayer.auditComparisons.saveComparison(comparison);
  }

  // 12. Save Authoritative Security Audit Snapshot (SECURITY S7)
  if (crawlResult && (crawlResult.security || (crawlResult as any).securityAudit)) {
    const secVm = crawlResult.security || (crawlResult as any).securityAudit;
    try {
      await persistenceLayer.securitySnapshots.saveSnapshot({
        snapshotId: `sec_snap_${auditRunId}`,
        auditRunId,
        projectId: project.projectId,
        domain: project.normalizedDomain,
        startedAt: auditRun.startedAt,
        completedAt,
        securitySchemaVersion: "v1.0.0",
        ruleCatalogVersion: "v1.0.0-64rules",
        scorePolicyVersion: "v1.0.0-deductive",
        remediationContractVersion: "v1.0.0-matrix",
        score: secVm.scoreBreakdown?.score ?? 100,
        postureBand: secVm.postureBand ?? "Excellent",
        criticalCount: secVm.stats?.criticalFindings ?? 0,
        highCount: secVm.stats?.highFindings ?? 0,
        mediumCount: secVm.stats?.mediumFindings ?? 0,
        lowCount: secVm.stats?.lowFindings ?? 0,
        informationalCount: 0,
        manualAreasCount: secVm.stats?.manualAssessmentAreas ?? 10,
        testsExecuted: secVm.stats?.testsExecuted ?? 0,
        passedControls: secVm.stats?.passedControls ?? 0,
        totalRulesRegistered: secVm.stats?.totalRulesRegistered ?? 64,
        requestedCrawlLimit: discoveryCeiling,
        isPartialAudit: Boolean((crawlResult as any)?.isReducedScopeWarning),
        payload: secVm,
        createdAt: completedAt,
      });
    } catch (secErr) {
      console.error("[Persistence Bridge] Failed to save security audit snapshot:", secErr);
    }
  }

  // 13. Update Project latestAuditRunId and preserved discovery ceiling
  await persistenceLayer.projects.updateProject(project.projectId, {
    latestAuditRunId: auditRunId,
    metadata: {
      ...(project.metadata || {}),
      crawlDiscoveryCeiling: discoveryCeiling,
      lastDiscoveredPageCount: auditPages.length,
    },
  });

  // 12. Reconstruct point-in-time historical report markdown
  const completedAuditRun = (await persistenceLayer.auditRuns.getAuditRunById(auditRunId))!;
  const historicalReportMarkdown = reconstructHistoricalReportMarkdown({
    projectName: project.name,
    auditRun: completedAuditRun,
    pages: auditPages,
    findings: auditFindings,
    metrics: auditMetric,
    comparisonWithPrevious: comparison,
  });

  return {
    auditRun: completedAuditRun,
    pages: auditPages,
    findings: auditFindings,
    metrics: auditMetric,
    comparison,
    historicalReportMarkdown,
    crawlResult,
  };
}
