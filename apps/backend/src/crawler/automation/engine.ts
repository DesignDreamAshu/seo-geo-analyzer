/**
 * Phase 23: Master Automation & Autonomous-But-Safe Operations Engine.
 * Unified entrypoint for scheduling, DAG evaluation, provider tracking, action verification, and execution governance.
 */

export * from "./types";
export * from "./config";
export * from "./scheduler";
export * from "./dependency-dag";
export * from "./providers";
export * from "./alerts";
export * from "./verification";
export * from "./execution-governance";
export * from "./safe-mode";
export * from "./continuous-loop";
export * from "./snapshots";
export * from "./report-serializer";

import {
  AutomationSnapshot,
  OperationalHealthSummary,
  ProjectAutomationPolicy,
} from "./types";
import { DEFAULT_AUTOMATION_POLICY } from "./config";
import { generateOperationalHealthSummary } from "./continuous-loop";
import { createAutomationSnapshot } from "./snapshots";

export interface RunAutomationPipelineInput {
  projectId: string;
  policy?: ProjectAutomationPolicy;
}

export async function runAutomationPipeline(input: RunAutomationPipelineInput): Promise<{
  healthSummary: OperationalHealthSummary;
  snapshot: AutomationSnapshot;
}> {
  const policy = input.policy || DEFAULT_AUTOMATION_POLICY;
  const healthSummary = generateOperationalHealthSummary(input.projectId, policy);
  const snapshot = createAutomationSnapshot({
    projectId: input.projectId,
    healthSummary,
    policyVersion: policy.policyVersion,
  });

  return {
    healthSummary,
    snapshot,
  };
}
