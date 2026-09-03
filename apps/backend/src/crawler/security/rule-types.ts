/**
 * Security Rule & Finding Contracts (SECURITY S2).
 * Defines metadata-driven rule schemas, deterministic finding formats, and coverage results.
 */

import type { FactScope, SecurityAuditFacts, SecurityCapabilityStatus } from "./types";

export type SecurityRuleCategory =
  | "transport"
  | "headers"
  | "hsts"
  | "csp"
  | "frame_protection"
  | "cookies"
  | "cors"
  | "information_disclosure"
  | "sensitive_files"
  | "forms"
  | "third_party"
  | "domain_email"
  | "manual_coverage";

export type SecuritySeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

export type SecurityConfidence =
  | "confirmed"
  | "high"
  | "medium"
  | "low";

export type SecurityVerificationClassification =
  | "confirmed"
  | "heuristic"
  | "requires_manual_verification";

export type SecurityExecutionStatus =
  | "PASS"
  | "FAIL"
  | "WARNING"
  | "OBSERVED"
  | "NOT_APPLICABLE"
  | "NOT_OBSERVABLE"
  | "REQUIRES_MANUAL_VERIFICATION"
  | "ERROR";

export type SecurityFixLevel =
  | "CONTENT"
  | "CODE"
  | "CMS"
  | "TEMPLATE"
  | "APPLICATION"
  | "SERVER"
  | "CDN"
  | "DNS"
  | "HOSTING_PROVIDER"
  | "THIRD_PARTY";

export interface SecurityStandardsMapping {
  owaspTop10?: string;
  owaspAsvs?: string;
  cwe?: string;
  cisBenchmark?: string;
  mdnGuidance?: string;
}

/**
 * Deterministic Security Finding Contract
 */
export interface SecurityFinding {
  id: string; // Deterministic namespaced fingerprint (e.g. security:HSTS_MISSING:host:example.com)
  ruleId: string;
  category: SecurityRuleCategory;
  title: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  verificationClassification: SecurityVerificationClassification;
  status: "FAIL" | "WARNING" | "OBSERVED";
  description: string;
  evidence: Record<string, any>;
  affectedUrls: string[];
  affectedResources?: string[];
  affectedOccurrences: number;
  scope: FactScope;
  fixLevel: SecurityFixLevel;
  deduplicationKey: string;
  globalEfficiencyText?: string; // e.g. "1 server fix → protects 108 URLs"
  standardsMapping?: SecurityStandardsMapping;
}

/**
 * Rule Execution & Coverage Record
 */
export interface SecurityCoverageRecord {
  ruleId: string;
  title: string;
  category: SecurityRuleCategory;
  status: SecurityExecutionStatus;
  verificationClassification: SecurityVerificationClassification;
  capabilityStatus: SecurityCapabilityStatus;
  testedTargets: number;
  passedTargets: number;
  failedTargets: number;
  notApplicableTargets: number;
  evidenceSummary: string;
  findingsGeneratedCount: number;
}

/**
 * Output of a single rule evaluator
 */
export interface SecurityRuleEvaluationResult {
  status: SecurityExecutionStatus;
  findings: SecurityFinding[];
  testedTargets: number;
  passedTargets: number;
  failedTargets: number;
  notApplicableTargets: number;
  evidenceSummary: string;
}

/**
 * Interface for all Security Rules in the registry
 */
export interface SecurityRule {
  ruleId: string;
  title: string;
  category: SecurityRuleCategory;
  description: string;
  verificationClassification: SecurityVerificationClassification;
  defaultSeverity: SecuritySeverity;
  defaultConfidence: SecurityConfidence;
  scope: FactScope;
  fixLevel: SecurityFixLevel;
  requiredCapability?: keyof SecurityAuditFacts["capabilities"];
  standardsMapping?: SecurityStandardsMapping;
  evaluate: (facts: SecurityAuditFacts) => SecurityRuleEvaluationResult;
}

/**
 * Complete Security Evaluation Output for S2
 */
export interface SecurityEvaluationResult {
  findings: SecurityFinding[];
  coverage: SecurityCoverageRecord[];
  summary: {
    totalRulesEvaluated: number;
    passedRulesCount: number;
    failedRulesCount: number;
    warningRulesCount: number;
    observedRulesCount: number;
    notApplicableRulesCount: number;
    notObservableRulesCount: number;
    manualVerificationRulesCount: number;
    totalFindingsCount: number;
    findingsBySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      informational: number;
    };
  };
}
