/**
 * Alert Tier Evaluator.
 * Categorizes change events into immediate alerts, digest summaries, or report-only notifications.
 */

import {
  AlertTier,
  FindingChangeRecord,
  PageChangeRecord,
  SystemicRegressionGroup,
} from "./types";

export function evaluateAlertTier(
  findingChanges: FindingChangeRecord[],
  pageChanges: PageChangeRecord[],
  systemicGroups: SystemicRegressionGroup[]
): {
  alertTier: AlertTier;
  alertSummary: string[];
} {
  const alertSummary: string[] = [];
  let isImmediate = false;
  let isDigest = false;

  // 1. Check Immediate Triggers
  for (const pc of pageChanges) {
    // A. Homepage 404 / 500
    if ((pc.url.endsWith("/") || pc.url.includes("index")) && pc.statusCodeChange && pc.statusCodeChange.current >= 400) {
      isImmediate = true;
      alertSummary.push(`CRITICAL: Homepage returned HTTP ${pc.statusCodeChange.current} (previously ${pc.statusCodeChange.previous}).`);
    }

    // B. Indexable -> Noindex on high-value pages
    if (pc.indexabilityChange && pc.indexabilityChange.previous === true && pc.indexabilityChange.current === false) {
      if (pc.url.endsWith("/") || pc.url.includes("/pricing") || pc.url.includes("/services")) {
        isImmediate = true;
        alertSummary.push(`CRITICAL: High-value page '${pc.url}' transitioned from indexable to noindex.`);
      } else {
        isDigest = true;
      }
    }

    // C. Massive Content Loss
    if (pc.contentLossDetected) {
      isDigest = true;
      alertSummary.push(`WARNING: Significant body content loss detected on '${pc.url}'.`);
    }
  }

  // 2. Check Critical Finding Changes
  for (const fc of findingChanges) {
    if ((fc.lifecycle === "NEW" || fc.lifecycle === "REOPENED") && fc.technicalSeverity === "critical") {
      isImmediate = true;
      alertSummary.push(`CRITICAL REGRESSION: New critical issue '${fc.ruleCode}' on '${fc.url}'.`);
    }
  }

  // 3. Check Systemic Template Regressions
  if (systemicGroups.length > 0) {
    isDigest = true;
    for (const sg of systemicGroups) {
      alertSummary.push(`SYSTEMIC REGRESSION: '${sg.ruleCode}' introduced across ${sg.affectedUrlsCount} pages in '${sg.templateOrRoutePattern}'.`);
    }
  }

  let alertTier: AlertTier = "REPORT_ONLY";
  if (isImmediate) {
    alertTier = "ALERT_IMMEDIATE";
  } else if (isDigest) {
    alertTier = "ALERT_DIGEST";
  }

  return { alertTier, alertSummary };
}
