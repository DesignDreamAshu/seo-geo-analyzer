/**
 * Manual Verification / Pen-Testing Coverage Rules (SECURITY S2).
 * Establishes explicit coverage boundaries for critical vulnerability classes that
 * Dream SEO's non-intrusive automated audit does not actively exploit.
 * Never produces automated findings or impacts automated scores.
 */

import type { SecurityRule, SecurityRuleEvaluationResult } from "../rule-types";

function createManualCoverageRule(
  ruleId: string,
  title: string,
  description: string,
  owaspTop10: string,
  cwe: string
): SecurityRule {
  return {
    ruleId,
    title,
    category: "manual_coverage",
    description,
    verificationClassification: "requires_manual_verification",
    defaultSeverity: "high",
    defaultConfidence: "low",
    scope: "SITE",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10, cwe },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      return {
        status: "REQUIRES_MANUAL_VERIFICATION",
        findings: [],
        testedTargets: 0,
        passedTargets: 0,
        failedTargets: 0,
        notApplicableTargets: 0,
        evidenceSummary: `Automated non-intrusive crawler does not actively probe or exploit ${title}. Professional penetration testing required.`,
      };
    },
  };
}

export const manualCoverageRules: SecurityRule[] = [
  createManualCoverageRule(
    "SEC_MANUAL_SQL_INJECTION",
    "SQL Injection (SQLi) Active Validation",
    "Active payload injection against backend SQL database endpoints.",
    "A03:2021-Injection",
    "CWE-89"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_XSS",
    "Cross-Site Scripting (XSS) Active Exploitation",
    "Active DOM and reflective payload execution testing.",
    "A03:2021-Injection",
    "CWE-79"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_AUTH_BYPASS",
    "Authentication Bypass & Session Flaws",
    "Multi-step authentication bypass, token forgery, and brute-force vulnerability testing.",
    "A07:2021-Identification and Authentication Failures",
    "CWE-287"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_BROKEN_ACCESS_CONTROL",
    "Broken Object-Level & Function Access Control",
    "Privileged API endpoint access without authorized role tokens.",
    "A01:2021-Broken Access Control",
    "CWE-284"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_IDOR",
    "Insecure Direct Object References (IDOR)",
    "Horizontal object identifier tampering across tenant accounts.",
    "A01:2021-Broken Access Control",
    "CWE-639"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_SSRF",
    "Server-Side Request Forgery (SSRF)",
    "Out-of-band network interaction testing via user-supplied URLs.",
    "A10:2021-Server-Side Request Forgery (SSRF)",
    "CWE-918"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_COMMAND_INJECTION",
    "Remote OS Command Injection",
    "Operating system command shell execution testing.",
    "A03:2021-Injection",
    "CWE-78"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_BUSINESS_LOGIC",
    "Business Logic & State Machine Flaws",
    "Multi-step checkout tampering, race conditions, and workflow bypasses.",
    "A04:2021-Insecure Design",
    "CWE-840"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_PRIVILEGE_ESCALATION",
    "Vertical & Horizontal Privilege Escalation",
    "Role escalation from standard user to system administrator.",
    "A01:2021-Broken Access Control",
    "CWE-269"
  ),
  createManualCoverageRule(
    "SEC_MANUAL_CSRF_ACTIVE_TEST",
    "Cross-Site Request Forgery (CSRF) State-Changing Execution",
    "Active state-changing forged request submission testing.",
    "A01:2021-Broken Access Control",
    "CWE-352"
  ),
];
