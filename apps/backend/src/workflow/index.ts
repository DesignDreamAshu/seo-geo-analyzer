/**
 * Phase 28K: Unified Remediation Workflow Module Exports.
 */

export * from "./types";
export * from "./client-labels";
export * from "./engine";
export * from "./invariants";
export * from "./persistence/sqlite-workflow-repo";

import { RemediationWorkflowEngine } from "./engine";

export const globalRemediationWorkflowEngine = new RemediationWorkflowEngine();
