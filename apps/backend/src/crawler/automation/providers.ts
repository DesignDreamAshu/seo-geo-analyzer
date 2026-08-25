/**
 * Phase 23: Provider Freshness, Circuit Breakers, Retry Policy & Budget Governance.
 * Enforces provider-specific freshness windows, completeness separation, and budget confidence.
 */

import {
  ProviderType,
  ProviderFreshnessRecord,
  DataFreshnessState,
  DataCompletenessState,
  CircuitBreakerState,
  RetryClassification,
  CostEstimationConfidence,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export interface ProviderTrackerStore {
  projectId: string;
  providers: Map<ProviderType, ProviderFreshnessRecord>;
  dailySpentUsd: number;
  costConfidence: CostEstimationConfidence;
  lastBudgetResetDate: string;
}

const projectProviderStores = new Map<string, ProviderTrackerStore>();

export function getOrCreateProviderStore(projectId: string): ProviderTrackerStore {
  let store = projectProviderStores.get(projectId);
  if (!store) {
    const today = new Date().toISOString().slice(0, 10);
    const providers = new Map<ProviderType, ProviderFreshnessRecord>();
    const providerList: ProviderType[] = [
      "GSC",
      "SERP",
      "BACKLINKS",
      "CRUX",
      "PAGESPEED",
      "INDEXATION_PROVIDER",
      "SERVER_LOGS",
      "ANALYTICS",
      "BUSINESS_METRICS",
    ];

    for (const p of providerList) {
      const pConfig = DEFAULT_AUTOMATION_POLICY.providerFreshnessHours[p] || { freshMax: 24, acceptableMax: 48, staleMax: 96 };
      providers.set(p, {
        provider: p,
        lastSuccessfulRefresh: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
        dataLatencyHours: 12,
        freshnessState: "FRESH",
        completenessState: "COMPLETE",
        quotaRemainingPercent: 100,
        circuitState: "CLOSED",
        failureCount: 0,
        policyUsed: DEFAULT_AUTOMATION_POLICY.policyName,
        thresholdUsedHours: pConfig.acceptableMax,
      });
    }

    store = {
      projectId,
      providers,
      dailySpentUsd: 0,
      costConfidence: "ACTUAL",
      lastBudgetResetDate: today,
    };
    projectProviderStores.set(projectId, store);
  }
  return store;
}

export function evaluateDataFreshness(
  provider: ProviderType,
  lastRefreshIso: string,
  policy = DEFAULT_AUTOMATION_POLICY
): { freshnessState: DataFreshnessState; policyUsed: string; thresholdsUsed: { freshMax: number; acceptableMax: number; staleMax: number } } {
  const lastTime = new Date(lastRefreshIso).getTime();
  const now = Date.now();
  const diffHours = (now - lastTime) / (1000 * 60 * 60);
  const thresholds = policy.providerFreshnessHours[provider] || { freshMax: 24, acceptableMax: 48, staleMax: 96 };

  let freshnessState: DataFreshnessState = "FRESH";
  if (diffHours <= thresholds.freshMax) {
    freshnessState = "FRESH";
  } else if (diffHours <= thresholds.acceptableMax) {
    freshnessState = "ACCEPTABLE";
  } else if (diffHours <= thresholds.staleMax) {
    freshnessState = "STALE";
  } else {
    freshnessState = "VERY_STALE";
  }

  return {
    freshnessState,
    policyUsed: policy.policyName,
    thresholdsUsed: thresholds,
  };
}

export function classifyErrorForRetry(statusCode?: number, errorMessage?: string, isProviderEndpoint = true): RetryClassification {
  const err = (errorMessage || "").toLowerCase();
  if (statusCode === 429 || err.includes("rate limit") || err.includes("quota")) {
    return "RETRY_AFTER_PROVIDER_WINDOW";
  }
  if (statusCode === 408 || statusCode === 503 || statusCode === 504 || err.includes("timeout") || err.includes("econnreset")) {
    return "RETRYABLE";
  }
  if (statusCode === 401 || statusCode === 403 || err.includes("unauthorized") || err.includes("invalid key")) {
    return "MANUAL_INTERVENTION_REQUIRED";
  }
  if (statusCode === 404) {
    // If it's a provider API endpoint returning 404, it's non-retryable endpoint error
    return "NON_RETRYABLE";
  }
  return "RETRYABLE";
}

export function computeExponentialBackoffMs(attempt: number, baseDelayMs = 1000, maxDelayMs = 30000): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  const jitter = Math.random() * 0.2 * delay;
  return Math.round(delay + jitter);
}

export function recordProviderResult(
  projectId: string,
  provider: ProviderType,
  isSuccess: boolean,
  costUsd = 0,
  completeness: DataCompletenessState = "COMPLETE",
  errorMessage?: string,
  policy = DEFAULT_AUTOMATION_POLICY
): { circuitState: CircuitBreakerState; isBudgetExhausted: boolean; costConfidence: CostEstimationConfidence } {
  const store = getOrCreateProviderStore(projectId);
  const rec = store.providers.get(provider);
  const threshold = policy.circuitBreakerThresholds[provider]?.failureThreshold || 5;

  // Budget tracking
  store.dailySpentUsd += costUsd;
  const isBudgetExhausted = policy.maxDailyBudgetUsd !== undefined ? store.dailySpentUsd >= policy.maxDailyBudgetUsd : false;
  const costConfidence = policy.maxDailyBudgetUsd === undefined ? "BUDGET_UNCONFIGURED" : "ACTUAL";

  if (!rec) return { circuitState: "CLOSED", isBudgetExhausted, costConfidence };

  rec.completenessState = completeness;

  if (isSuccess) {
    rec.lastSuccessfulRefresh = new Date().toISOString();
    rec.dataLatencyHours = 0;
    rec.freshnessState = "FRESH";
    rec.failureCount = 0;
    rec.circuitState = "CLOSED";
    rec.errorMessage = undefined;
  } else {
    rec.failureCount += 1;
    rec.errorMessage = errorMessage;
    if (rec.failureCount >= threshold) {
      rec.circuitState = "OPEN";
      rec.freshnessState = "PROVIDER_ERROR";
    }
  }

  return { circuitState: rec.circuitState, isBudgetExhausted, costConfidence };
}

export function resetProviderStores(projectId?: string): void {
  if (projectId) {
    projectProviderStores.delete(projectId);
  } else {
    projectProviderStores.clear();
  }
}
