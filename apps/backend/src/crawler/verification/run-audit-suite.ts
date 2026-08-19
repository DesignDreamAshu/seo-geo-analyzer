import { runSiteAuditCrawl } from "../engine";
import type { AuditArtifact, RenderingTelemetry } from "./types";

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

  let htmlPagesEvaluated = 0;
  let eligibleForRender = 0;
  let notEligibleForRender = 0;
  let actuallyRendered = 0;
  let skippedEligible = 0;
  let renderSuccess = 0;
  let renderFailed = 0;
  let authoritativeRendered = 0;

  for (const page of result.crawledPages) {
    if (page.resourceType === "html_page") {
      htmlPagesEvaluated++;
      if (page.renderDecision) {
        if (page.renderDecision.eligible) {
          eligibleForRender++;
          if (page.renderDecision.attempted) {
            actuallyRendered++;
            if (page.renderDecision.success) renderSuccess++;
            else renderFailed++;
          } else {
            skippedEligible++;
          }
        } else {
          notEligibleForRender++;
        }
      }
    }
    if (page.authoritativeFacts?.source === "rendered") {
      authoritativeRendered++;
    }
  }

  const telemetryInvariantValid = eligibleForRender === actuallyRendered + skippedEligible;

  const renderingTelemetry: RenderingTelemetry = {
    htmlPagesEvaluated,
    eligibleForRender,
    notEligibleForRender,
    actuallyRendered,
    skippedEligible,
    renderSuccess,
    renderFailed,
    authoritativeRenderedPagesCount: authoritativeRendered,
    telemetryInvariantValid,
  };

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
    renderingTelemetry,
    severityCounts: result.severityCounts,
    issues: result.issues,
    externalLinkTelemetry: extTel,
  };

  console.log(
    `[Verify:Audit] Complete. Audit ID: ${result.auditId} | Score: ${result.healthScore}/100 | Pages: ${result.inventory.totalCrawled} | Rendered: ${authoritativeRendered} (Eligible: ${eligibleForRender}) | Reason: ${result.terminationReason}`
  );
  return artifact;
}
