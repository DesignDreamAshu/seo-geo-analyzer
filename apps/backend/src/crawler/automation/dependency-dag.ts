/**
 * Phase 23: Dependency DAG & Execution Graph Engine.
 * Manages job dependency graphs, circular dependency detection, and graceful branch execution.
 */

import { AutomationJob, JobStatus } from "./types";

export interface ExecutionNode {
  jobId: string;
  automationType: string;
  status: JobStatus;
  dependsOnJobIds: string[];
  isOptionalBranch?: boolean;
}

export interface DagEvaluationResult {
  isValidDag: boolean;
  canExecuteJobIds: string[];
  blockedJobIds: string[];
  failedJobIds: string[];
  dagErrors: string[];
}

export function validateAndEvaluateDag(nodes: ExecutionNode[]): DagEvaluationResult {
  const nodeMap = new Map<string, ExecutionNode>();
  for (const n of nodes) {
    nodeMap.set(n.jobId, n);
  }

  const dagErrors: string[] = [];
  const canExecuteJobIds: string[] = [];
  const blockedJobIds: string[] = [];
  const failedJobIds: string[] = [];

  // Check 1: Missing dependencies & Circular dependencies
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function checkCircular(id: string): boolean {
    visited.add(id);
    recursionStack.add(id);

    const node = nodeMap.get(id);
    if (node) {
      for (const depId of node.dependsOnJobIds) {
        if (!nodeMap.has(depId)) {
          dagErrors.push(`MISSING_DEPENDENCY: Job ${id} depends on non-existent job ${depId}`);
        } else if (recursionStack.has(depId)) {
          dagErrors.push(`CIRCULAR_DEPENDENCY: Circular dependency detected between ${id} and ${depId}`);
          return true;
        } else if (!visited.has(depId)) {
          if (checkCircular(depId)) return true;
        }
      }
    }

    recursionStack.delete(id);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.jobId)) {
      checkCircular(node.jobId);
    }
  }

  if (dagErrors.length > 0) {
    return {
      isValidDag: false,
      canExecuteJobIds: [],
      blockedJobIds: nodes.map((n) => n.jobId),
      failedJobIds: [],
      dagErrors,
    };
  }

  // Check 2: Evaluate readiness
  for (const node of nodes) {
    if (node.status === "FAILED") {
      failedJobIds.push(node.jobId);
      continue;
    }
    if (node.status === "SUCCEEDED") {
      continue; // already finished
    }

    let isBlocked = false;
    for (const depId of node.dependsOnJobIds) {
      const depNode = nodeMap.get(depId);
      if (!depNode) {
        isBlocked = true;
        break;
      }
      if (depNode.status === "FAILED") {
        if (!node.isOptionalBranch) {
          isBlocked = true;
          dagErrors.push(`FAILED_DEPENDENCY: Job ${node.jobId} blocked because required dependency ${depId} failed.`);
          break;
        }
      } else if (depNode.status !== "SUCCEEDED" && depNode.status !== "PARTIALLY_SUCCEEDED") {
        isBlocked = true;
        break;
      }
    }

    if (isBlocked) {
      blockedJobIds.push(node.jobId);
    } else if (node.status === "QUEUED") {
      canExecuteJobIds.push(node.jobId);
    }
  }

  return {
    isValidDag: true,
    canExecuteJobIds,
    blockedJobIds,
    failedJobIds,
    dagErrors,
  };
}
