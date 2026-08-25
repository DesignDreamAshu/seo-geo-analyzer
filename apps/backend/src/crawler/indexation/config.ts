/**
 * Phase 19: Indexation Intelligence Configuration & Freshness Policies.
 */

import { EvidenceFreshnessState } from "./types";

export interface IndexationPolicy {
  policyName: string;
  freshThresholdDays: number;
  agingThresholdDays: number;
  maxInspectionsPerBatch: number;
  cacheTtlHours: number;
  mapperVersion: string;
}

export const DEFAULT_INDEXATION_POLICY: IndexationPolicy = {
  policyName: "DEFAULT_INDEXATION_POLICY",
  freshThresholdDays: 14,
  agingThresholdDays: 45,
  maxInspectionsPerBatch: 2000,
  cacheTtlHours: 168, // 7 days
  mapperVersion: "1.0.0",
};

export function evaluateEvidenceFreshness(
  timestamp: string | undefined,
  policy: IndexationPolicy = DEFAULT_INDEXATION_POLICY
): EvidenceFreshnessState {
  if (!timestamp) return "UNKNOWN";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "UNKNOWN";

  const diffMs = Date.now() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= policy.freshThresholdDays) return "FRESH";
  if (diffDays <= policy.agingThresholdDays) return "AGING";
  return "STALE";
}
