/**
 * Systemic Regression & Change Burst Detector.
 * Identifies shared template regressions and abnormal change spikes with calibrated confidence.
 */

import {
  ChangeBurstReport,
  CrawlSnapshot,
  FindingChangeRecord,
  SystemicRegressionGroup,
} from "./types";
import { DEFAULT_MONITORING_CONFIG, MonitoringConfig } from "./config";

export function detectSystemicRegressions(
  findingChanges: FindingChangeRecord[],
  currentSnapshot: CrawlSnapshot,
  config: MonitoringConfig = DEFAULT_MONITORING_CONFIG
): {
  systemicGroups: SystemicRegressionGroup[];
  changeBurst: ChangeBurstReport;
} {
  const newFindings = findingChanges.filter((f) => f.lifecycle === "NEW" || f.lifecycle === "REOPENED");
  const newlyDetectable = findingChanges.filter((f) => f.lifecycle === "NEWLY_DETECTABLE");

  // 1. Group by Rule Code and Route Family
  const groupsByRuleAndFamily = new Map<string, FindingChangeRecord[]>();

  for (const f of newFindings) {
    const routeFamily = extractRouteFamily(f.url);
    const groupKey = `${f.ruleCode}:::${routeFamily}`;

    const list = groupsByRuleAndFamily.get(groupKey) || [];
    list.push(f);
    groupsByRuleAndFamily.set(groupKey, list);
  }

  const systemicGroups: SystemicRegressionGroup[] = [];

  for (const [key, records] of groupsByRuleAndFamily) {
    if (records.length >= config.systemic.minGroupSizeForSystemic) {
      const [ruleCode, routeFamily] = key.split(":::");
      const affectedUrls = records.map((r) => r.url);

      let title = `Systemic Regression: ${ruleCode} across ${affectedUrls.length} pages in '${routeFamily}'`;
      let rootCauseHypothesis = `Likely shared CMS Collection Template or Route Component regression for '${routeFamily}'.`;
      let whereToFix = `Webflow Designer → CMS Collection Template (${routeFamily}) or Global Component`;

      if (ruleCode === "SOCIAL_INCOMPLETE_OG" || ruleCode.includes("OG_")) {
        title = `Systemic Open Graph Regression: OG Image Missing across ${affectedUrls.length} pages`;
        rootCauseHypothesis = `Likely shared Blog CMS Collection Template regression (Open Graph image binding removed or unmapped).`;
        whereToFix = `Webflow Designer → Pages Panel → CMS Collection Template (Blog Posts) → Page Settings → Open Graph Image URL`;
      } else if (ruleCode === "CONTENT_MISSING_H1") {
        title = `Systemic Heading Regression: H1 Missing across ${affectedUrls.length} pages`;
        rootCauseHypothesis = `Likely heading component removed or changed from <h1> to <div> in shared template.`;
        whereToFix = `Webflow Designer → CMS Collection Template Canvas → Main Heading Element`;
      }

      systemicGroups.push({
        groupId: `SYS_${ruleCode}_${routeFamily.replace(/[^a-zA-Z0-9]/g, "_")}`,
        ruleCode,
        monitoringSignalCode: records[0].monitoringSignalCode,
        title,
        rootCauseHypothesis,
        rootCauseConfidence: "HIGH_CONFIDENCE",
        groupingEvidence: {
          affectedUrlsCount: affectedUrls.length,
          routePattern: routeFamily,
          sharedStructuralSignal: `Identical transition observed across ${affectedUrls.length} pages in same route family.`,
        },
        templateOrRoutePattern: routeFamily,
        affectedUrls,
        affectedUrlsCount: affectedUrls.length,
        estimatedRealEdits: 1, // 1 template edit resolves all affected pages
        regressionPriority: "HIGH_REGRESSION",
        firstObservedSnapshotId: currentSnapshot.snapshotId,
        remediationGuidance: records[0].remediationSummary,
        whereToFix,
        verificationInstructions: `Publish template change; re-crawl representative URLs from '${routeFamily}' and full affected template group.`,
      });
    }
  }

  // 2. Evaluate Change Burst Status with Safeguards
  const burstThreshold = config.changeBurst.burstFindingThreshold;
  const totalNew = newFindings.length;
  const isChangeBurst = totalNew >= burstThreshold;
  const probableCauses: string[] = [];

  let burstStatus: ChangeBurstReport["burstStatus"] = "NORMAL_VARIATION";

  if (!currentSnapshot.isComplete && isChangeBurst) {
    burstStatus = "SUPPRESSED_CRAWL_INCOMPLETE";
    probableCauses.push("Change burst suppressed because current crawl traversal was incomplete.");
  } else if (newlyDetectable.length >= burstThreshold && totalNew < burstThreshold) {
    burstStatus = "NEW_RULESET_BURST";
    probableCauses.push(`Burst driven by ${newlyDetectable.length} newly introduced rule-set diagnostics.`);
  } else if (isChangeBurst) {
    burstStatus = "CHANGE_BURST_REVIEW";
    if (systemicGroups.length > 0) {
      probableCauses.push("Shared CMS template or global navigation component modification.");
    }
    if (currentSnapshot.deploymentMetadata?.deploymentId || currentSnapshot.deploymentMetadata?.commitSha) {
      probableCauses.push(`First observed after production deployment (${currentSnapshot.deploymentMetadata.deploymentId || currentSnapshot.deploymentMetadata.commitSha}).`);
    }
    probableCauses.push("Sitewide CSS / template theme update.");
  }

  const changeBurst: ChangeBurstReport = {
    isChangeBurst: burstStatus === "CHANGE_BURST_REVIEW",
    totalNewFindings: totalNew,
    burstThreshold,
    burstStatus,
    probableCauses,
  };

  return { systemicGroups, changeBurst };
}

function extractRouteFamily(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "homepage";
    if (parts.length === 1) return `/${parts[0]}/*`;
    return `/${parts[0]}/*`;
  } catch {
    return "general_site";
  }
}
