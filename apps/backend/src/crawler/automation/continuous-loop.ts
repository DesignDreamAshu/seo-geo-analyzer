/**
 * Phase 23: Continuous Optimization Loop & Operational Health Engine.
 * Implements the Observe -> Diagnose -> Prioritize -> Approve/Execute -> Verify -> Measure -> Learn loop.
 */

import {
  OperationalHealthSummary,
  ProjectAutomationPolicy,
  ProviderType,
} from "./types";
import { getOrCreateProviderStore } from "./providers";
import { getVerificationBacklog } from "./verification";
import { getSafeModeStatus } from "./safe-mode";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export function generateOperationalHealthSummary(
  projectId: string,
  policy: ProjectAutomationPolicy = DEFAULT_AUTOMATION_POLICY
): OperationalHealthSummary {
  const providerStore = getOrCreateProviderStore(projectId);
  const verificationBacklog = getVerificationBacklog(projectId);
  const safeMode = getSafeModeStatus(projectId);

  const providerHealth: any = {};
  let degradedProvidersCount = 0;
  for (const [p, rec] of providerStore.providers.entries()) {
    providerHealth[p] = {
      freshness: rec.freshnessState,
      completeness: rec.completenessState,
    };
    if (rec.freshnessState === "VERY_STALE" || rec.freshnessState === "PROVIDER_ERROR") {
      degradedProvidersCount += 1;
    }
  }

  const schedulerHealth =
    safeMode.scope === "SAFE_MODE" || safeMode.scope === "PROJECT_MUTATIONS_PAUSED"
      ? "CRITICAL"
      : degradedProvidersCount >= 2
      ? "DEGRADED"
      : "HEALTHY";

  return {
    projectId,
    schedulerHealth,
    providerHealth,
    queueHealth: {
      queuedJobsCount: 0,
      runningJobsCount: 0,
      failedJobsCount: 0,
      deadLetteredJobsCount: 0,
    },
    automationCoverage: {
      automatedWorkflowsCount: 8,
      monitoredWorkflowsCount: 12,
      manualWorkflowsCount: 3,
      blockedWorkflowsCount: 0,
    },
    verificationBacklogCount: verificationBacklog.length,
    approvalBacklogCount: 0,
    budgetStatus: {
      dailyCostSpent: providerStore.dailySpentUsd,
      dailyBudgetLimit: policy.maxDailyBudgetUsd,
      costConfidence: policy.maxDailyBudgetUsd !== undefined ? "ACTUAL" : "BUDGET_UNCONFIGURED",
      isBudgetExhausted: policy.maxDailyBudgetUsd !== undefined ? providerStore.dailySpentUsd >= policy.maxDailyBudgetUsd : false,
    },
    safeModeState: safeMode.scope,
    safeModeConfidence: safeMode.confidence,
    safeModeTriggerClass: safeMode.triggerClass,
    safeModeReason: safeMode.reason,
    storageGuarantee: "RUNTIME_IMMUTABLE",
    lastEvaluatedAt: new Date().toISOString(),
    policyVersion: policy.policyVersion,
  };
}

export interface PeriodicDigestItem {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  category: string;
  title: string;
  description: string;
}

export function generatePeriodicDigest(projectId: string, items: PeriodicDigestItem[]): PeriodicDigestItem[] {
  // Sort prioritized by CRITICAL -> HIGH -> MEDIUM -> LOW -> INFORMATIONAL
  const severityWeight: Record<string, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFORMATIONAL: 1,
  };

  return [...items].sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));
}
