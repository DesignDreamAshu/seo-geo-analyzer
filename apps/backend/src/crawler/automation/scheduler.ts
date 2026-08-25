/**
 * Phase 23: Automation Scheduler & Concurrency Lock Engine.
 * Input-aware idempotency, fencing tokens, progress deltas, and stalled job detection.
 */

import {
  AutomationJob,
  AutomationTrigger,
  AutomationUnit,
  ProjectAutomationPolicy,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";

export interface CreateJobInput {
  projectId: string;
  automationType: string;
  trigger: AutomationTrigger;
  unit: AutomationUnit;
  unitId?: string;
  actionVersion?: string;
  inputDigest?: string;
  executionIntentDigest?: string;
  dependsOnJobIds?: string[];
  inputSnapshotIds?: string[];
  policy?: ProjectAutomationPolicy;
  scheduledAt?: string;
}

export interface ConcurrencyLock {
  lockKey: string;
  projectId: string;
  ownerJobId: string;
  fencingToken: number;
  acquiredAt: string;
  expiresAt: string;
}

let globalFencingCounter = 1000;
const activeLocks = new Map<string, ConcurrencyLock>();
const jobRegistry = new Map<string, AutomationJob>();

export function generateInputAwareIdempotencyKey(
  projectId: string,
  automationType: string,
  unit: AutomationUnit,
  unitId = "global",
  inputDigest = "default_digest",
  policyVersion = "1.1.0"
): string {
  return `idem_${projectId}_${automationType}_${unit}_${unitId}_${inputDigest}_${policyVersion}`;
}

export function createAutomationJob(input: CreateJobInput): { job: AutomationJob; isDuplicateSuppressed: boolean } {
  const policy = input.policy || DEFAULT_AUTOMATION_POLICY;
  const scheduledAt = input.scheduledAt || new Date().toISOString();
  const idempotencyKey = generateInputAwareIdempotencyKey(
    input.projectId,
    input.automationType,
    input.unit,
    input.unitId,
    input.inputDigest || input.executionIntentDigest || "v1_digest",
    policy.policyVersion
  );

  // Check for existing running or queued job with identical idempotency key
  const existingJob = Array.from(jobRegistry.values()).find(
    (j) => j.idempotencyKey === idempotencyKey && (j.status === "QUEUED" || j.status === "RUNNING")
  );

  if (existingJob) {
    return {
      job: existingJob,
      isDuplicateSuppressed: true,
    };
  }

  globalFencingCounter += 1;
  const jobId = `job_${input.projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const job: AutomationJob = {
    jobId,
    projectId: input.projectId,
    automationType: input.automationType,
    trigger: input.trigger,
    unit: input.unit,
    unitId: input.unitId,
    scheduledAt,
    status: "QUEUED",
    idempotencyKey,
    dependsOnJobIds: input.dependsOnJobIds || [],
    retryCount: 0,
    maxRetries: policy.maxRetryAttempts,
    policyVersion: policy.policyVersion,
    inputSnapshotIds: input.inputSnapshotIds || [],
    outputSnapshotIds: [],
    heartbeatAt: new Date().toISOString(),
    progressPercent: 0,
    fencingToken: globalFencingCounter,
  };

  jobRegistry.set(jobId, job);
  return { job, isDuplicateSuppressed: false };
}

export function acquireConcurrencyLock(
  projectId: string,
  lockScope: string,
  ownerJobId: string,
  ttlSeconds = 300
): { acquired: boolean; currentLock?: ConcurrencyLock; fencingToken?: number } {
  const lockKey = `${projectId}::${lockScope}`;
  const now = new Date().getTime();
  const existing = activeLocks.get(lockKey);

  if (existing) {
    const expiresAt = new Date(existing.expiresAt).getTime();
    if (now < expiresAt) {
      if (existing.ownerJobId === ownerJobId) {
        return { acquired: true, currentLock: existing, fencingToken: existing.fencingToken };
      }
      return { acquired: false, currentLock: existing, fencingToken: existing.fencingToken };
    }
    // Lock expired, reclaim
    activeLocks.delete(lockKey);
  }

  globalFencingCounter += 1;
  const newLock: ConcurrencyLock = {
    lockKey,
    projectId,
    ownerJobId,
    fencingToken: globalFencingCounter,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
  };
  activeLocks.set(lockKey, newLock);
  return { acquired: true, currentLock: newLock, fencingToken: newLock.fencingToken };
}

export function releaseConcurrencyLock(projectId: string, lockScope: string, ownerJobId: string): boolean {
  const lockKey = `${projectId}::${lockScope}`;
  const existing = activeLocks.get(lockKey);
  if (existing && existing.ownerJobId === ownerJobId) {
    activeLocks.delete(lockKey);
    return true;
  }
  return false;
}

export function detectStalledJobs(stalledTimeoutSeconds = 600, minProgressDelta = 0): AutomationJob[] {
  const now = new Date().getTime();
  const stalled: AutomationJob[] = [];

  for (const job of jobRegistry.values()) {
    if (job.status === "RUNNING") {
      const lastHeartbeat = job.heartbeatAt ? new Date(job.heartbeatAt).getTime() : 0;
      const isHeartbeatExpired = now - lastHeartbeat > stalledTimeoutSeconds * 1000;
      const isProgressStuck = minProgressDelta > 0 && (job.progressPercent || 0) === 0;

      if (isHeartbeatExpired || isProgressStuck) {
        job.isStalled = true;
        job.status = "FAILED";
        job.errorMessage = `Job stalled: Heartbeat elapsed ${stalledTimeoutSeconds}s without progress update.`;
        stalled.push(job);
      }
    }
  }
  return stalled;
}

export function resetSchedulerStore(projectId?: string): void {
  if (projectId) {
    for (const [id, job] of jobRegistry.entries()) {
      if (job.projectId === projectId) jobRegistry.delete(id);
    }
    for (const [key, lock] of activeLocks.entries()) {
      if (lock.projectId === projectId) activeLocks.delete(key);
    }
  } else {
    jobRegistry.clear();
    activeLocks.clear();
  }
}
