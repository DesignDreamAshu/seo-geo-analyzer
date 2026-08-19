import { runSiteAuditCrawl } from "../engine";
import type { AuditArtifact } from "./types";

export async function executeFullAuditSuite(
  verificationRunId: string,
  gitShaFull: string
): Promise<AuditArtifact> {
  console.log(`[Verify:Audit] Executing fresh full site audit on https://www.botconsulting.io/ (maxPages=300)...`);

  const result = await runSiteAuditCrawl({
    seedUrl: "https://www.botconsulting.io/",
    maxPages: 300,
    concurrency: 5,
    onProgress: (prog) => {
      if (prog.crawledPages % 30 === 0 || prog.status === "completed") {
        console.log(`[Verify:Audit] [Progress ${prog.percent}%] Crawled: ${prog.crawledPages}/${prog.maxPages} | Queued: ${prog.queuedPages}`);
      }
    },
  });

  const extTel = result.linkGraphSummary.externalLinkTelemetry;

  let renderedSuccess = 0;
  let renderedFailed = 0;
  let actuallyRendered = 0;
  let authoritativeRendered = 0;

  for (const page of result.crawledPages) {
    if (page.renderedFacts?.attempted) {
      actuallyRendered++;
      if (page.renderedFacts.success) renderedSuccess++;
      else renderedFailed++;
    }
    if (page.authoritativeFacts?.source === "rendered") {
      authoritativeRendered++;
    }
  }

  const artifact: AuditArtifact = {
    verificationRunId,
    gitShaFull,
    generatedAt: new Date().toISOString(),
    auditId: result.auditId,
    seedUrl: result.seedUrl,
    durationMs: result.durationMs,
    terminationReason: result.terminationReason,
    healthScore: result.healthScore,
    auditCoveragePercent: result.auditCoveragePercent,
    inventory: result.inventory,
    renderingTelemetry: {
      eligibleForRender: actuallyRendered,
      actuallyRendered,
      renderSuccess: renderedSuccess,
      renderFailed: renderedFailed,
      authoritativeRenderedPagesCount: authoritativeRendered,
    },
    severityCounts: result.severityCounts,
    issues: result.issues,
    externalLinkTelemetry: extTel,
  };

  console.log(
    `[Verify:Audit] Complete. Audit ID: ${result.auditId} | Score: ${result.healthScore}/100 | Pages: ${result.inventory.totalCrawled} | Rendered: ${authoritativeRendered} | Reason: ${result.terminationReason}`
  );
  return artifact;
}
