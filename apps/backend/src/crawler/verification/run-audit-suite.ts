import { runSiteAuditCrawl } from "../engine";
import type { AuditArtifact } from "./types";

export async function executeFullAuditSuite(
  verificationRunId: string,
  gitSha: string
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

  const artifact: AuditArtifact = {
    verificationRunId,
    gitSha,
    generatedAt: new Date().toISOString(),
    auditId: result.auditId,
    seedUrl: result.seedUrl,
    durationMs: result.durationMs,
    terminationReason: result.terminationReason,
    healthScore: result.healthScore,
    auditCoveragePercent: result.auditCoveragePercent,
    inventory: result.inventory,
    severityCounts: result.severityCounts,
    issues: result.issues,
    externalLinkTelemetry: extTel,
  };

  console.log(
    `[Verify:Audit] Complete. Audit ID: ${result.auditId} | Score: ${result.healthScore}/100 | Pages: ${result.inventory.totalCrawled} | Reason: ${result.terminationReason}`
  );
  return artifact;
}
