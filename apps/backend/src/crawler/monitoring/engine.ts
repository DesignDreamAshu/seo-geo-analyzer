/**
 * Master SEO Monitoring & Regression Intelligence Engine.
 * Orchestrates multi-signal comparability, snapshot diffing, systemic regression detection,
 * and alert tier classification.
 */

import {
  CrawlSnapshot,
  BaselineType,
  DirectUrlProbe,
  MonitoringAuditResult,
  OperationalBaselineType,
} from "./types";
import { evaluateCrawlComparability } from "./comparability";
import { diffCrawlSnapshots } from "./diff-engine";
import { detectSystemicRegressions } from "./systemic-detector";
import { evaluateAlertTier } from "./alert-evaluator";
import { DEFAULT_MONITORING_CONFIG, MonitoringConfig } from "./config";

export function auditSnapshotRegression(
  currentSnapshot: CrawlSnapshot,
  baselineSnapshot: CrawlSnapshot | null | undefined,
  baselineType: BaselineType = "PREVIOUS_SUCCESSFUL",
  historicalSnapshots: CrawlSnapshot[] = [],
  directProbes: Record<string, DirectUrlProbe> = {},
  config: MonitoringConfig = DEFAULT_MONITORING_CONFIG
): MonitoringAuditResult {
  // 1. Determine Baseline Support Status
  const operationalBaselines: OperationalBaselineType[] = ["PREVIOUS_SUCCESSFUL", "LAST_VERIFIED", "USER_PINNED"];
  const baselineSupportStatus = operationalBaselines.includes(baselineType as OperationalBaselineType)
    ? "OPERATIONAL"
    : "ARCHITECTURE_READY";

  // 2. Evaluate Comparability Gate
  const comparability = evaluateCrawlComparability(baselineSnapshot, currentSnapshot, config);

  // 3. Perform Detailed Diff
  const { findingChanges, pageChanges } = diffCrawlSnapshots(
    baselineSnapshot,
    currentSnapshot,
    historicalSnapshots,
    directProbes,
    config
  );

  // 4. Detect Systemic Regressions & Change Bursts
  const { systemicGroups, changeBurst } = detectSystemicRegressions(
    findingChanges,
    currentSnapshot,
    config
  );

  // 5. Evaluate Alert Tiers
  const { alertTier, alertSummary } = evaluateAlertTier(
    findingChanges,
    pageChanges,
    systemicGroups
  );

  // 6. Compile Summary Counts
  const totalNewRegressions = findingChanges.filter((f) => f.lifecycle === "NEW").length;
  const totalChangedFindings = findingChanges.filter((f) => f.lifecycle === "CHANGED").length;
  const totalReopenedRegressions = findingChanges.filter((f) => f.lifecycle === "REOPENED").length;
  const totalPersistingFindings = findingChanges.filter((f) => f.lifecycle === "PERSISTING").length;
  const totalResolvedFindings = findingChanges.filter((f) => f.lifecycle === "RESOLVED").length;
  const totalNewlyDetectable = findingChanges.filter((f) => f.lifecycle === "NEWLY_DETECTABLE").length;
  const criticalAlertsCount = findingChanges.filter(
    (f) => (f.lifecycle === "NEW" || f.lifecycle === "REOPENED") && f.technicalSeverity === "critical"
  ).length;

  return {
    currentSnapshotId: currentSnapshot.snapshotId,
    baselineSnapshotId: baselineSnapshot ? baselineSnapshot.snapshotId : null,
    baselineType,
    baselineSupportStatus,
    comparedAt: new Date().toISOString(),
    comparability,
    summary: {
      totalUrlsCurrent: Object.keys(currentSnapshot.pages).length,
      totalUrlsBaseline: baselineSnapshot ? Object.keys(baselineSnapshot.pages).length : 0,
      totalNewRegressions,
      totalChangedFindings,
      totalReopenedRegressions,
      totalPersistingFindings,
      totalResolvedFindings,
      totalNewlyDetectable,
      totalSystemicGroups: systemicGroups.length,
      criticalAlertsCount,
    },
    systemicRegressions: systemicGroups,
    findingChanges,
    pageChanges,
    changeBurst,
    alertTier,
    alertSummary,
  };
}
