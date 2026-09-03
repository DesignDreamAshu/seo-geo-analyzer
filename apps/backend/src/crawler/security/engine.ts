/**
 * Security Audit Engine (SECURITY S2).
 * Single entry point for running complete security audits: consumes S1 facts and evaluates S2 deterministic rules.
 */

import type { SecurityAuditFacts } from "./types";
import type { SecurityEvaluationResult } from "./rule-types";
import { defaultSecurityRuleRegistry, SecurityRuleRegistry } from "./rule-registry";

export async function evaluateSecurityAudit(
  facts: SecurityAuditFacts,
  registry: SecurityRuleRegistry = defaultSecurityRuleRegistry
): Promise<SecurityEvaluationResult> {
  return registry.evaluate(facts);
}

export * from "./rule-types";
export * from "./rule-registry";
export * from "./severity-policy";
export * from "./fingerprint";
