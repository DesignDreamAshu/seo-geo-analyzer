/**
 * Phase 23: Centralized & Contextual Automation Policy Configuration.
 * Removes universal operational hardcoding and enforces project/scale-aware policies.
 */

import { ProjectAutomationPolicy, ProviderType } from "./types";

export const DEFAULT_AUTOMATION_POLICY: ProjectAutomationPolicy = {
  policyVersion: "1.1.0",
  policyName: "DEFAULT_CONTEXTUAL_AUTONOMOUS_OPERATIONS_POLICY_V1_1",
  autonomyMode: "AUTO_VERIFY", // Default: monitors and auto-verifies, but requires approval for mutations
  notificationPolicy: "MATERIAL_CHANGES", // Explicitly separated from autonomy mode
  providerFreshnessHours: {
    GSC: { freshMax: 24, acceptableMax: 72, staleMax: 120 }, // Search Console has known 3-day data latency
    SERP: { freshMax: 24, acceptableMax: 48, staleMax: 96 },
    BACKLINKS: { freshMax: 72, acceptableMax: 168, staleMax: 336 }, // Backlinks crawl on multi-day cadence
    CRUX: { freshMax: 168, acceptableMax: 336, staleMax: 720 }, // CrUX updates monthly / rolling 28 days
    PAGESPEED: { freshMax: 24, acceptableMax: 72, staleMax: 168 },
    INDEXATION_PROVIDER: { freshMax: 24, acceptableMax: 48, staleMax: 96 },
    SERVER_LOGS: { freshMax: 12, acceptableMax: 24, staleMax: 72 },
    ANALYTICS: { freshMax: 24, acceptableMax: 48, staleMax: 96 },
    BUSINESS_METRICS: { freshMax: 24, acceptableMax: 72, staleMax: 168 },
  },
  scheduleFrequencies: {
    technicalCrawlDays: 7,
    gscRefreshHours: 24,
    serpRefreshDays: 3,
    backlinkRefreshDays: 7,
    cwvRefreshDays: 14,
    indexationRefreshDays: 3,
    actionVerificationHours: 6,
    contentLifecycleDays: 14,
  },
  allowlistedAutoSafeRemediations: [
    // Minimal, strict allowlist: deterministic, isolated, reversible, 0 content judgment
    "REPAIR_SYNTAX_ONLY_SCHEMA",
    "PURGE_TRANSIENT_404_CACHE",
    "NORMALIZE_TRAILING_SLASH_REDIRECT",
    "INJECT_MISSING_ALT_TEXT_TRANSIENT",
  ],
  maxDailyBudgetUsd: 50.0,
  alertCooldownHours: 24,
  approvalExpiryDays: 14,
  maxRetryAttempts: 3,
  circuitBreakerThresholds: {
    GSC: { failureThreshold: 5, recoveryTimeMinutes: 30 },
    SERP: { failureThreshold: 3, recoveryTimeMinutes: 15 },
    BACKLINKS: { failureThreshold: 4, recoveryTimeMinutes: 60 },
    CRUX: { failureThreshold: 5, recoveryTimeMinutes: 60 },
    PAGESPEED: { failureThreshold: 3, recoveryTimeMinutes: 15 },
    INDEXATION_PROVIDER: { failureThreshold: 4, recoveryTimeMinutes: 30 },
    SERVER_LOGS: { failureThreshold: 3, recoveryTimeMinutes: 15 },
    ANALYTICS: { failureThreshold: 5, recoveryTimeMinutes: 30 },
    BUSINESS_METRICS: { failureThreshold: 5, recoveryTimeMinutes: 60 },
  },
  safeModeThresholds: {
    massUrlDisappearancePercentage: 15.0, // 15% scope loss
    massUrlDisappearanceMinCount: 20,
    mass404Percentage: 10.0,
    mass404MinCount: 15,
    consecutiveExecutionFailures: 3,
  },
};

export function getContextualScheduleFrequencies(
  siteScale: "SMALL" | "MEDIUM" | "ENTERPRISE",
  isMigrationActive = false,
  policy: ProjectAutomationPolicy = DEFAULT_AUTOMATION_POLICY
) {
  if (isMigrationActive) {
    return {
      technicalCrawlDays: 1,
      gscRefreshHours: 12,
      serpRefreshDays: 1,
      backlinkRefreshDays: 3,
      cwvRefreshDays: 7,
      indexationRefreshDays: 1,
      actionVerificationHours: 2,
      contentLifecycleDays: 30, // Suppress content decay alerts during migration
    };
  }

  if (siteScale === "ENTERPRISE") {
    return {
      technicalCrawlDays: 3,
      gscRefreshHours: 24,
      serpRefreshDays: 2,
      backlinkRefreshDays: 7,
      cwvRefreshDays: 7,
      indexationRefreshDays: 2,
      actionVerificationHours: 4,
      contentLifecycleDays: 14,
    };
  }

  return policy.scheduleFrequencies;
}
