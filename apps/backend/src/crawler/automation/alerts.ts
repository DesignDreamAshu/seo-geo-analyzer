/**
 * Phase 23: Alert Lifecycle, Cooldown & Escalation Engine.
 * Manages deduplicated alerts, operational urgency vs SEO severity, and positive resolution verification.
 */

import {
  AutomationAlert,
  AlertLifecycleState,
  ChangeMateriality,
  NotificationPolicy,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export interface ProcessAlertInput {
  projectId: string;
  actionId?: string;
  issueCode: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";
  operationalUrgency?: "HIGH" | "MEDIUM" | "LOW";
  affectedUrls: string[];
  isConditionActive: boolean;
  isProviderDataMissing?: boolean;
  materiality?: ChangeMateriality;
  isMigrationCritical?: boolean;
  persistingHours?: number;
  slaMaxHours?: number;
  assignedOwner?: string;
  notificationPolicy?: NotificationPolicy;
}

const alertRegistry = new Map<string, AutomationAlert>();

export function generateAlertFingerprint(projectId: string, issueCode: string, actionId = "global"): string {
  return `alert_${projectId}_${issueCode}_${actionId}`;
}

export function processAutomationAlert(input: ProcessAlertInput): { alert: AutomationAlert; shouldNotify: boolean } {
  const notifPolicy = input.notificationPolicy || DEFAULT_AUTOMATION_POLICY.notificationPolicy;
  const fingerprint = generateAlertFingerprint(input.projectId, input.issueCode, input.actionId);
  const now = new Date();
  const existing = alertRegistry.get(fingerprint);

  const determineNotificationPermitted = (alert: AutomationAlert): boolean => {
    if (notifPolicy === "NONE") return false;
    if (notifPolicy === "CRITICAL_ONLY") return alert.severity === "CRITICAL" || alert.operationalUrgency === "HIGH";
    if (notifPolicy === "MATERIAL_CHANGES") return alert.materiality === "MATERIAL_CHANGE" || alert.materiality === "CRITICAL_CHANGE";
    if (notifPolicy === "DIGEST_ONLY") return false; // Handled exclusively by digest
    return true; // ALL_ACTIONABLE or CUSTOM
  };

  if (!existing) {
    if (!input.isConditionActive) {
      const inertAlert: AutomationAlert = {
        alertId: `al_${Date.now()}`,
        fingerprint,
        projectId: input.projectId,
        actionId: input.actionId,
        issueCode: input.issueCode,
        title: input.title,
        severity: input.severity,
        operationalUrgency: input.operationalUrgency || "LOW",
        lifecycleState: "RESOLVED",
        materiality: "NO_MATERIAL_CHANGE",
        affectedUrls: input.affectedUrls,
        firstObservedAt: now.toISOString(),
        lastObservedAt: now.toISOString(),
        cooldownExpiresAt: now.toISOString(),
        isSuppressed: true,
        policyUsed: DEFAULT_AUTOMATION_POLICY.policyName,
      };
      return { alert: inertAlert, shouldNotify: false };
    }

    // New alert
    const cooldownExpires = new Date(now.getTime() + DEFAULT_AUTOMATION_POLICY.alertCooldownHours * 3600 * 1000).toISOString();
    const alert: AutomationAlert = {
      alertId: `al_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fingerprint,
      projectId: input.projectId,
      actionId: input.actionId,
      issueCode: input.issueCode,
      title: input.title,
      severity: input.severity,
      operationalUrgency: input.operationalUrgency || (input.severity === "CRITICAL" ? "HIGH" : "MEDIUM"),
      lifecycleState: "NEW",
      materiality: input.materiality || "MATERIAL_CHANGE",
      affectedUrls: input.affectedUrls,
      firstObservedAt: now.toISOString(),
      lastObservedAt: now.toISOString(),
      cooldownExpiresAt: cooldownExpires,
      isSuppressed: false,
      assignedOwner: input.assignedOwner,
      policyUsed: DEFAULT_AUTOMATION_POLICY.policyName,
    };
    alertRegistry.set(fingerprint, alert);
    return { alert, shouldNotify: determineNotificationPermitted(alert) };
  }

  // Existing alert transition
  existing.lastObservedAt = now.toISOString();

  if (!input.isConditionActive) {
    // Check if data is missing due to provider outage -> Never mark resolved on missing data
    if (input.isProviderDataMissing) {
      existing.isSuppressed = true;
      return { alert: existing, shouldNotify: false };
    }

    if (existing.lifecycleState !== "RESOLVED") {
      existing.lifecycleState = "RESOLVED";
      existing.isSuppressed = false; // Notify on positive confirmed resolution
      return { alert: existing, shouldNotify: determineNotificationPermitted(existing) };
    }
    return { alert: existing, shouldNotify: false };
  }

  // Condition is active
  if (existing.lifecycleState === "RESOLVED") {
    existing.lifecycleState = "REOPENED";
    existing.cooldownExpiresAt = new Date(now.getTime() + DEFAULT_AUTOMATION_POLICY.alertCooldownHours * 3600 * 1000).toISOString();
    existing.isSuppressed = false;
    existing.escalationReason = "Previously resolved issue has reopened in fresh crawl/audit.";
    return { alert: existing, shouldNotify: determineNotificationPermitted(existing) };
  }

  // Ongoing condition - check for worsening or escalation
  const isWorsened = input.affectedUrls.length > existing.affectedUrls.length * 1.3 || input.severity === "CRITICAL" && existing.severity !== "CRITICAL";
  const isSlaBreached = input.persistingHours && input.slaMaxHours ? input.persistingHours > input.slaMaxHours : false;

  if (isWorsened) {
    existing.lifecycleState = "WORSENED";
    existing.affectedUrls = input.affectedUrls;
    existing.severity = input.severity;
    existing.isSuppressed = false;
    existing.escalationReason = "Affected scope expanded materially.";
    return { alert: existing, shouldNotify: determineNotificationPermitted(existing) };
  }

  if (isSlaBreached || input.isMigrationCritical) {
    existing.escalationReason = input.isMigrationCritical
      ? "CRITICAL MIGRATION ESCALATION: Unresolved redirect/indexation blocker active during migration."
      : `SLA ESCALATION: Issue unresolved after ${input.persistingHours} hours (SLA limit: ${input.slaMaxHours}h).`;
    existing.isSuppressed = false;
    return { alert: existing, shouldNotify: determineNotificationPermitted(existing) };
  }

  // Ongoing with no material change: check cooldown
  const isCoolingDown = now.getTime() < new Date(existing.cooldownExpiresAt).getTime();
  existing.lifecycleState = "ONGOING";
  existing.isSuppressed = isCoolingDown;

  return { alert: existing, shouldNotify: !isCoolingDown && determineNotificationPermitted(existing) };
}

export function resetAlertRegistry(projectId?: string): void {
  if (projectId) {
    for (const [key, alert] of alertRegistry.entries()) {
      if (alert.projectId === projectId) alertRegistry.delete(key);
    }
  } else {
    alertRegistry.clear();
  }
}
