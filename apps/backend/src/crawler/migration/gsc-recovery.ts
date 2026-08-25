/**
 * Hardened GSC Migration Recovery & Comparability Engine.
 * Evaluates performance transfer with configurable thresholds, period comparability checks, and safe correlation terminology.
 */

import { UrlMappingEntry, RecoveryState, GscPeriodComparability } from "./types";
import { DEFAULT_MIGRATION_POLICY, MigrationPolicy } from "./config";

export interface GscPagePerformanceSample {
  url: string;
  clicks: number;
  impressions: number;
}

export function evaluateGscMigrationRecovery(params: {
  mappings: UrlMappingEntry[];
  preMigrationGscData: GscPagePerformanceSample[];
  postMigrationGscData: GscPagePerformanceSample[];
  daysSinceLaunch: number;
  prePeriodDays?: number;
  postPeriodDays?: number;
  isPartialPostPeriod?: boolean;
  isStaleData?: boolean;
  policy?: MigrationPolicy;
}): {
  recoveryState: RecoveryState;
  periodComparability: GscPeriodComparability;
  preMigrationTotalClicks: number;
  postMigrationTotalClicks: number;
  observedClickTransferRatio: number;
  recoveryDetails: string;
} {
  const policy = params.policy || DEFAULT_MIGRATION_POLICY;

  const preMap = new Map(params.preMigrationGscData.map((d) => [d.url, d]));
  const postMap = new Map(params.postMigrationGscData.map((d) => [d.url, d]));

  let totalPreClicks = 0;
  let totalPostClicks = 0;

  for (const m of params.mappings) {
    if (m.sourceUrl && preMap.has(m.sourceUrl)) {
      totalPreClicks += preMap.get(m.sourceUrl)!.clicks;
    }
    if (m.destinationUrl && postMap.has(m.destinationUrl)) {
      totalPostClicks += postMap.get(m.destinationUrl)!.clicks;
    }
  }

  // 1. Missing GSC Data
  if (params.preMigrationGscData.length === 0 && params.postMigrationGscData.length === 0) {
    return {
      recoveryState: "INSUFFICIENT_DATA",
      periodComparability: "MISSING_GSC_DATA",
      preMigrationTotalClicks: 0,
      postMigrationTotalClicks: 0,
      observedClickTransferRatio: 1.0,
      recoveryDetails: "No Google Search Console performance data connected or configured. Search recovery cannot be evaluated.",
    };
  }

  // 2. Stale Data
  if (params.isStaleData) {
    return {
      recoveryState: "INSUFFICIENT_DATA",
      periodComparability: "STALE_GSC_DATA",
      preMigrationTotalClicks: totalPreClicks,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: totalPreClicks > 0 ? totalPostClicks / totalPreClicks : 0,
      recoveryDetails: "GSC performance snapshot data is stale. Historical search transfer comparison suppressed.",
    };
  }

  // 3. Shorter Post-Launch Evaluation Window (< policy.minDaysForRecoveryEvaluation)
  if (params.daysSinceLaunch < policy.minDaysForRecoveryEvaluation) {
    return {
      recoveryState: "RECOVERY_NOT_YET_EVALUABLE",
      periodComparability: "SHORTER_POST_LAUNCH_PERIOD",
      preMigrationTotalClicks: totalPreClicks,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: totalPreClicks > 0 ? totalPostClicks / totalPreClicks : 0,
      recoveryDetails: `Migration launched ${params.daysSinceLaunch} days ago (< ${policy.minDaysForRecoveryEvaluation} days minimum). Post-launch search activity window is too brief for conclusive recovery evaluation.`,
    };
  }

  // 4. Period Window Mismatch (e.g. comparing 90-day pre vs 7-day post without normalization)
  const preDays = params.prePeriodDays || 28;
  const postDays = params.postPeriodDays || params.daysSinceLaunch;
  if (Math.abs(preDays - postDays) > 7 && !params.isPartialPostPeriod) {
    const normalizedPreClicks = (totalPreClicks / preDays) * postDays;
    const ratio = normalizedPreClicks > 0 ? totalPostClicks / normalizedPreClicks : 1.0;
    return {
      recoveryState: ratio >= policy.stableRecoveryThreshold ? "RECOVERY_STABLE" : "RECOVERY_IN_PROGRESS",
      periodComparability: "PERIOD_WINDOW_MISMATCH",
      preMigrationTotalClicks: totalPreClicks,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: ratio,
      recoveryDetails: `Baseline window (${preDays} days) differs from post-launch window (${postDays} days). Evaluated against daily normalized search volume.`,
    };
  }

  // 5. Partial GSC Period
  if (params.isPartialPostPeriod) {
    return {
      recoveryState: "RECOVERY_IN_PROGRESS",
      periodComparability: "PARTIAL_GSC_DATA",
      preMigrationTotalClicks: totalPreClicks,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: totalPreClicks > 0 ? totalPostClicks / totalPreClicks : 0,
      recoveryDetails: "Post-launch GSC performance reflects a partial date window. Cautious directional recovery indicated.",
    };
  }

  // 6. Zero baseline clicks
  if (totalPreClicks === 0) {
    return {
      recoveryState: "INSUFFICIENT_DATA",
      periodComparability: "COMPARABLE_PERIODS",
      preMigrationTotalClicks: 0,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: 1.0,
      recoveryDetails: "Pre-migration GSC dataset contains 0 baseline clicks. Direct traffic transfer comparison is inconclusive.",
    };
  }

  // 7. Standard Comparable Period Comparison
  const ratio = totalPostClicks / totalPreClicks;

  if (ratio >= policy.stableRecoveryThreshold) {
    return {
      recoveryState: "RECOVERY_STABLE",
      periodComparability: "COMPARABLE_PERIODS",
      preMigrationTotalClicks: totalPreClicks,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: ratio,
      recoveryDetails: `Mapped URLs demonstrate strong search recovery (${Math.round(
        ratio * 100
      )}% of pre-migration click volume transferred across comparable ${postDays}-day periods).`,
    };
  }

  if (ratio >= policy.declineRecoveryThreshold) {
    return {
      recoveryState: "RECOVERY_IN_PROGRESS",
      periodComparability: "COMPARABLE_PERIODS",
      preMigrationTotalClicks: totalPreClicks,
      postMigrationTotalClicks: totalPostClicks,
      observedClickTransferRatio: ratio,
      recoveryDetails: `Mapped URLs demonstrate active traffic transfer (${Math.round(
        ratio * 100
      )}% click volume recovered over ${params.daysSinceLaunch} days post-launch).`,
    };
  }

  return {
    recoveryState: "RECOVERY_DECLINE_REVIEW",
    periodComparability: "COMPARABLE_PERIODS",
    preMigrationTotalClicks: totalPreClicks,
    postMigrationTotalClicks: totalPostClicks,
    observedClickTransferRatio: ratio,
    recoveryDetails: `Post-launch click volume (${totalPostClicks}) is temporally associated with a significant decline compared to pre-migration baseline (${totalPreClicks}). Review redirects, canonicals, and indexation state on high-value mapped pages.`,
  };
}
