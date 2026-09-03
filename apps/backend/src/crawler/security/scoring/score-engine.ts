/**
 * Deterministic Security Posture Scoring Engine (SECURITY S5).
 * Transparent, category-normalized, deduplication-safe risk deduction model.
 */

import type { SecurityEvaluationResult, SecurityFinding, SecurityRuleCategory } from "../rule-types";
import type { SecurityAuditFacts } from "../types";
import type {
  SecurityScoreBreakdown,
  SecurityScoreDeduction,
  SecurityPosture,
  SecurityScoringConfig,
} from "./score-types";

export interface CriticalGuardrailRulePolicy {
  ruleId: string;
  maxPosture: SecurityPosture;
  rationale: string;
}

export const DEFAULT_CRITICAL_GUARDRAILS: Record<string, CriticalGuardrailRulePolicy> = {
  SEC_ENV_FILE_EXPOSED: {
    ruleId: "SEC_ENV_FILE_EXPOSED",
    maxPosture: "Weak",
    rationale: "Confirmed environment file exposure leaks production database and API credentials.",
  },
  SEC_GIT_HEAD_EXPOSED: {
    ruleId: "SEC_GIT_HEAD_EXPOSED",
    maxPosture: "Moderate",
    rationale: "Public Git repository metadata enables reconstruction of backend source code.",
  },
  SEC_FORM_PASSWORD_INSECURE_TRANSPORT: {
    ruleId: "SEC_FORM_PASSWORD_INSECURE_TRANSPORT",
    maxPosture: "Moderate",
    rationale: "Submitting passwords over unencrypted HTTP exposes credentials to plaintext interception.",
  },
  SEC_CERT_EXPIRED: {
    ruleId: "SEC_CERT_EXPIRED",
    maxPosture: "Moderate",
    rationale: "Expired TLS certificates cause immediate full-page browser security warnings for all visitors.",
  },
  SEC_CERT_HOSTNAME_MISMATCH: {
    ruleId: "SEC_CERT_HOSTNAME_MISMATCH",
    maxPosture: "Moderate",
    rationale: "TLS certificate hostname mismatch causes browser connection rejection.",
  },
  SEC_TLS_CERTIFICATE_UNVERIFIED: {
    ruleId: "SEC_TLS_CERTIFICATE_UNVERIFIED",
    maxPosture: "Moderate",
    rationale: "Untrusted or self-signed certificates fail standard browser trust chains.",
  },
};

export const DEFAULT_SECURITY_SCORING_CONFIG: SecurityScoringConfig = {
  severityWeights: {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2,
    informational: 0,
  },
  confidenceModifiers: {
    confirmed: 1.0,
    high: 0.85,
    medium: 0.6,
    low: 0.35,
  },
  categoryDeductionCaps: {
    domain_email: 12,
    information_disclosure: 8,
    third_party: 10,
    headers: 25,
  },
};

/**
 * Calculates the Security Posture Score (0-100) and full breakdown.
 */
export function calculateSecurityScore(
  evaluation: SecurityEvaluationResult,
  facts: SecurityAuditFacts,
  customConfig?: Partial<SecurityScoringConfig>
): SecurityScoreBreakdown {
  const config: SecurityScoringConfig = {
    severityWeights: { ...DEFAULT_SECURITY_SCORING_CONFIG.severityWeights, ...customConfig?.severityWeights },
    confidenceModifiers: { ...DEFAULT_SECURITY_SCORING_CONFIG.confidenceModifiers, ...customConfig?.confidenceModifiers },
    categoryDeductionCaps: { ...DEFAULT_SECURITY_SCORING_CONFIG.categoryDeductionCaps, ...customConfig?.categoryDeductionCaps },
  };

  const rawDeductionsByCategory: Record<SecurityRuleCategory, number> = {
    transport: 0,
    hsts: 0,
    csp: 0,
    frame_protection: 0,
    headers: 0,
    cookies: 0,
    cors: 0,
    information_disclosure: 0,
    sensitive_files: 0,
    forms: 0,
    third_party: 0,
    domain_email: 0,
    manual_coverage: 0,
  };

  const deductions: SecurityScoreDeduction[] = [];
  let excludedNonScoringCount = 0;
  let hasCriticalFinding = false;

  // Process each logical finding
  for (const finding of evaluation.findings) {
    // Exclude manual coverage or informational observations from score penalties
    if (
      finding.category === "manual_coverage" ||
      finding.severity === "informational" ||
      finding.status === "OBSERVED" ||
      finding.verificationClassification === "requires_manual_verification"
    ) {
      excludedNonScoringCount++;
      continue;
    }

    if (finding.severity === "critical") {
      hasCriticalFinding = true;
    }

    const baseWeight = config.severityWeights[finding.severity] || 0;
    const confidenceModifier = config.confidenceModifiers[finding.confidence] || 1.0;

    // Bounded exposure modifier: logarithmic scaling that never multiplies global issues linearly
    const affectedCount = Math.max(1, finding.affectedUrls?.length || 1);
    let exposureModifier = 1.0;
    if (finding.scope === "HOST" || finding.scope === "DOMAIN" || finding.scope === "SITE") {
      // Host-level issues: bounded between 1.0 and 1.25 max regardless of page count
      exposureModifier = Math.min(1.25, 1.0 + Math.log10(affectedCount) * 0.1);
    } else if (affectedCount > 1) {
      // Page/Resource issues: sub-linear scaling
      exposureModifier = Math.min(1.5, 1.0 + Math.log10(affectedCount) * 0.2);
    }

    const rawDeduction = Number((baseWeight * confidenceModifier * exposureModifier).toFixed(1));

    deductions.push({
      ruleId: finding.ruleId,
      findingId: finding.id,
      category: finding.category,
      title: finding.title,
      severity: finding.severity,
      confidence: finding.confidence,
      baseWeight,
      confidenceModifier,
      exposureModifier: Number(exposureModifier.toFixed(2)),
      finalDeduction: rawDeduction,
      reason: `${finding.severity.toUpperCase()} (${baseWeight}pts) × ${finding.confidence} confidence (${confidenceModifier})`,
    });

    rawDeductionsByCategory[finding.category] = (rawDeductionsByCategory[finding.category] || 0) + rawDeduction;
  }

  // Apply Category Deduction Caps
  const cappedDeductionsByCategory: Record<SecurityRuleCategory, number> = { ...rawDeductionsByCategory };
  let totalDeductions = 0;

  for (const [cat, val] of Object.entries(rawDeductionsByCategory)) {
    const category = cat as SecurityRuleCategory;
    const cap = config.categoryDeductionCaps[category];
    if (cap !== undefined && val > cap) {
      cappedDeductionsByCategory[category] = cap;
    } else {
      cappedDeductionsByCategory[category] = Number(val.toFixed(1));
    }
    totalDeductions += cappedDeductionsByCategory[category];
  }

  const rawScore = Math.max(0, Math.min(100, Math.round(100 - totalDeductions)));

  // Posture Determination
  let posture: SecurityPosture;
  if (rawScore >= 90) posture = "Excellent";
  else if (rawScore >= 80) posture = "Strong";
  else if (rawScore >= 65) posture = "Moderate";
  else if (rawScore >= 40) posture = "Weak";
  else posture = "High Risk";

  // Critical finding guardrail: apply strictest maxPosture from active guardrail policies
  const postureHierarchy: Record<SecurityPosture, number> = {
    "High Risk": 1,
    "Weak": 2,
    "Moderate": 3,
    "Strong": 4,
    "Excellent": 5,
  };

  for (const finding of evaluation.findings) {
    const policy = DEFAULT_CRITICAL_GUARDRAILS[finding.ruleId];
    if (policy && finding.status === "FAIL") {
      const currentRank = postureHierarchy[posture];
      const maxRank = postureHierarchy[policy.maxPosture];
      if (currentRank > maxRank) {
        posture = policy.maxPosture;
      }
    }
  }

  // Automated Coverage Assessment
  const availableAutomatedChecks = evaluation.coverage.filter(
    c => c.status !== "NOT_OBSERVABLE" && c.verificationClassification !== "requires_manual_verification"
  ).length;
  const totalAutomatedChecks = 54; // 52 confirmed + 2 heuristic
  const coveragePercent = Math.round((availableAutomatedChecks / totalAutomatedChecks) * 100);

  return {
    score: rawScore,
    posture,
    baseScore: 100,
    totalDeductions: Number(totalDeductions.toFixed(1)),
    deductionsByCategory: cappedDeductionsByCategory,
    deductions,
    excludedNonScoringCount,
    observableAutomatedCoverage: {
      availableChecks: availableAutomatedChecks,
      totalAutomatedChecks,
      coveragePercent,
    },
    scoreDisclaimer: "The Security Posture Score evaluates observable security controls and configuration. It is not a penetration-test certification and does not prove the absence of application vulnerabilities.",
  };
}
