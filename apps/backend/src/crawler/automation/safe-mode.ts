/**
 * Phase 23: Safe Mode & Catastrophic Anomaly Safety Engine.
 * Site-scale-aware thresholds, confidence levels, deployment context, and granular scopes.
 */

import {
  SafeModeScope,
  SafeModeConfidence,
  SafeModeTriggerClass,
  ProjectAutomationPolicy,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export interface AnomalyEvaluationInput {
  projectId: string;
  totalEvaluatedScopeCount: number;
  totalUrlsDisappearedCount?: number;
  total404Count?: number;
  isSitewideNoindexDetected?: boolean;
  isRobotsDisallowAllDetected?: boolean;
  consecutiveExecutionFailuresCount?: number;
  isKnownDeploymentUnderway?: boolean;
  isCrawlDatasetComplete?: boolean;
  isProviderDataComplete?: boolean;
  policy?: ProjectAutomationPolicy;
}

const safeModeStatusStore = new Map<
  string,
  {
    scope: SafeModeScope;
    confidence: SafeModeConfidence;
    triggerClass?: SafeModeTriggerClass;
    reason?: string;
    triggeredAt?: string;
  }
>();

export function evaluateSafeModeTriggers(input: AnomalyEvaluationInput): {
  scope: SafeModeScope;
  confidence: SafeModeConfidence;
  isSafeModeTriggered: boolean;
  triggerClass?: SafeModeTriggerClass;
  reason?: string;
} {
  const policy = input.policy || DEFAULT_AUTOMATION_POLICY;

  // Incomplete evidence safety: Partial crawl or provider outage CANNOT trigger mass-loss Safe Mode
  if (input.isCrawlDatasetComplete === false || input.isProviderDataComplete === false) {
    return {
      scope: "NORMAL_OPERATION",
      confidence: "INSUFFICIENT_EVIDENCE",
      isSafeModeTriggered: false,
      reason: "Incomplete crawl or provider data. Suppressed false mass-anomaly Safe Mode trigger.",
    };
  }

  // Known deployment awareness: Expected mass deployment diffs are classified as review rather than catastrophe
  if (input.isKnownDeploymentUnderway) {
    return {
      scope: "NORMAL_OPERATION",
      confidence: "SAFE_MODE_TRIGGER_REVIEW",
      isSafeModeTriggered: false,
      reason: "Known production deployment in progress. Associated mass change with scheduled release.",
    };
  }

  let triggerReason: string | undefined;
  let triggerClass: SafeModeTriggerClass | undefined;
  let scope: SafeModeScope = "NORMAL_OPERATION";

  const total = Math.max(1, input.totalEvaluatedScopeCount);
  const disappearedPct = ((input.totalUrlsDisappearedCount || 0) / total) * 100;
  const error404Pct = ((input.total404Count || 0) / total) * 100;

  if (input.isSitewideNoindexDetected) {
    triggerClass = "TECHNICAL_CATASTROPHE";
    scope = "SAFE_MODE";
    triggerReason = "CATASTROPHIC_ANOMALY: Sitewide noindex tag confirmed deployed.";
  } else if (input.isRobotsDisallowAllDetected) {
    triggerClass = "TECHNICAL_CATASTROPHE";
    scope = "SAFE_MODE";
    triggerReason = "CATASTROPHIC_ANOMALY: robots.txt Disallow: / blocking entire site.";
  } else if (
    (input.totalUrlsDisappearedCount || 0) >= policy.safeModeThresholds.massUrlDisappearanceMinCount &&
    disappearedPct >= policy.safeModeThresholds.massUrlDisappearancePercentage
  ) {
    triggerClass = "MASS_UNEXPECTED_CHANGE";
    scope = "PROJECT_MUTATIONS_PAUSED";
    triggerReason = `MASS_CHANGE_DETECTED: ${input.totalUrlsDisappearedCount} URLs (${disappearedPct.toFixed(1)}% of site) disappeared unexpectedly.`;
  } else if (
    (input.total404Count || 0) >= policy.safeModeThresholds.mass404MinCount &&
    error404Pct >= policy.safeModeThresholds.mass404Percentage
  ) {
    triggerClass = "TECHNICAL_CATASTROPHE";
    scope = "PROJECT_MUTATIONS_PAUSED";
    triggerReason = `MASS_404_SPIKE: ${input.total404Count} pages (${error404Pct.toFixed(1)}% of site) returning 404 client errors.`;
  } else if (
    (input.consecutiveExecutionFailuresCount || 0) >= policy.safeModeThresholds.consecutiveExecutionFailures
  ) {
    triggerClass = "EXECUTION_ADAPTER_ANOMALY";
    scope = "ADAPTER_PAUSED";
    triggerReason = `EXECUTION_ADAPTER_ANOMALY: ${input.consecutiveExecutionFailuresCount} consecutive mutation failures. Adapter paused.`;
  }

  if (triggerReason && triggerClass) {
    const status = {
      scope,
      confidence: "SAFE_MODE_TRIGGER_CONFIRMED" as SafeModeConfidence,
      triggerClass,
      reason: triggerReason,
      triggeredAt: new Date().toISOString(),
    };
    safeModeStatusStore.set(input.projectId, status);
    return {
      scope,
      confidence: "SAFE_MODE_TRIGGER_CONFIRMED",
      isSafeModeTriggered: true,
      triggerClass,
      reason: triggerReason,
    };
  }

  return {
    scope: "NORMAL_OPERATION",
    confidence: "SAFE_MODE_TRIGGER_CONFIRMED",
    isSafeModeTriggered: false,
  };
}

export function exitSafeMode(projectId: string, authorizedBy: string, reason: string): boolean {
  safeModeStatusStore.set(projectId, {
    scope: "NORMAL_OPERATION",
    confidence: "SAFE_MODE_TRIGGER_CONFIRMED",
    reason: `Safe mode manually cleared by ${authorizedBy}: ${reason}`,
    triggeredAt: undefined,
  });
  return true;
}

export function getSafeModeStatus(projectId: string): {
  scope: SafeModeScope;
  confidence: SafeModeConfidence;
  triggerClass?: SafeModeTriggerClass;
  reason?: string;
} {
  return safeModeStatusStore.get(projectId) || { scope: "NORMAL_OPERATION", confidence: "SAFE_MODE_TRIGGER_CONFIRMED" };
}

export function resetSafeModeStore(projectId?: string): void {
  if (projectId) {
    safeModeStatusStore.delete(projectId);
  } else {
    safeModeStatusStore.clear();
  }
}
