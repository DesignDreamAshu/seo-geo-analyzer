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

export async function executeAndPersistAudit(
  input: ExecuteAndPersistAuditInput
): Promise<ExecuteAndPersistAuditOutput> {
  const { project, persistenceLayer, crawlOptions, trigger = "MANUAL", customCrawlerExecutor } = input;

  // 1. Get next project-local sequence number
  const sequenceNumber = await persistenceLayer.auditRuns.getNextSequenceNumber(project.projectId);
  const auditRunId = `audit_${project.projectId}_seq_${sequenceNumber}_${Date.now()}`;
  const startedAt = new Date().toISOString();

  // 2. Initialize Rule Evaluation Context
  const evaluatedRuleIds = IMPLEMENTED_DIAGNOSTIC_RULES.map((r) => r.ruleCode);
  const ruleContext = {
    productionRuleCount: 95,
    ruleInventoryVersion: "1.0.0",
    evaluatedRuleIds,
  };


  // 3. Create Audit Run in RUNNING state
  const auditRun = await persistenceLayer.auditRuns.createAuditRun({
    auditRunId,
    projectId: project.projectId,
    sequenceNumber,
    startedAt,
    status: "RUNNING",
    trigger,
    crawlerVersion: "2.4.0",
    ruleInventoryVersion: "1.0.0",
    productionRuleCount: 95,
    policyVersions: JSON.stringify({ policyVersion: "1.1.0" }),
    configurationSnapshot: {
      crawlSettings: {
        maxPages: crawlOptions.maxPages ?? 150,
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
      ruleEvaluationContext: ruleContext,
    },
  });

  // 4. Run real crawler pipeline (or custom fixture executor)
  const crawlerExecutor = customCrawlerExecutor || runSiteAuditCrawl;
  const crawlResult = await crawlerExecutor(crawlOptions);

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

    for (const aff of issue.affectedPages || []) {
      const normalizedUrl = aff.url;
      const targetResource = aff.evidence?.targetUrl || undefined;
      const fprint = generateStableFindingFingerprint({
        projectId: project.projectId,
        ruleId: issue.code,
        normalizedUrl,
        targetResource,
        evidence: aff.evidence as any,
      });

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
      sequenceNumber,
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
  });

  // 10. Generate Default Comparison against previous audit if available
  let comparison: AuditComparisonResult | null = null;
  const allProjectRuns = await persistenceLayer.auditRuns.listAuditRunsForProject(project.projectId);
  const previousRun = allProjectRuns.find((r) => r.sequenceNumber === sequenceNumber - 1 && r.status === "COMPLETED");

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

  // 11. Update Project latestAuditRunId
  await persistenceLayer.projects.updateProject(project.projectId, {
    latestAuditRunId: auditRunId,
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
