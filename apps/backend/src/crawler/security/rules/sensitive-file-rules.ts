/**
 * Sensitive File & Repository Exposure Rules (SECURITY S2).
 * Evaluates confirmed exposure of environment files, git metadata, and backup artifacts.
 * Strictly verifies signature and rejects soft-404 false positives.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const sensitiveFileRules: SecurityRule[] = [
  {
    ruleId: "SEC_ENV_FILE_EXPOSED",
    title: "Environment Configuration (.env) File Publicly Exposed",
    category: "sensitive_files",
    description: "A production .env file containing database credentials, API keys, or application secrets is publicly accessible.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_ENV_FILE_EXPOSED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_ENV_FILE_EXPOSED.confidence,
    scope: "SITE",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-552" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const probe = facts.safeProbes.find((p) => p.targetType === "ENV_FILE");
      const findings: SecurityFinding[] = [];

      if (probe && probe.isConfirmedExposed) {
        const findingId = generateFindingId("SEC_ENV_FILE_EXPOSED", "SITE", probe.requestedUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_ENV_FILE_EXPOSED",
          category: "sensitive_files",
          title: "Critical: .env Configuration File Publicly Accessible",
          severity: "critical",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `The application environment file at ${probe.requestedUrl} returned HTTP 200 with confirmed key-value configuration syntax. Sensitive credentials and secrets are directly exposed to the internet.`,
          evidence: {
            requestedUrl: probe.requestedUrl,
            httpStatus: probe.httpStatus,
            contentType: probe.contentType,
            byteLength: probe.byteLength,
            signatureType: probe.signatureType,
            sha256: probe.responseFingerprintSha256,
            redactedEvidence: probe.redactedEvidenceSnippet,
          },
          affectedUrls: [probe.requestedUrl],
          affectedOccurrences: 1,
          scope: "SITE",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Block public access to .env files in server / CDN configuration immediately`,
        });
      }

      return {
        status: findings.length > 0 ? "FAIL" : probe ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: probe ? 1 : 0,
        passedTargets: probe && !probe.isConfirmedExposed ? 1 : 0,
        failedTargets: findings.length,
        notApplicableTargets: probe ? 0 : 1,
        evidenceSummary: findings.length > 0 ? "CRITICAL: .env file is exposed and readable" : "No .env file exposure detected (soft-404 verified)",
      };
    },
  },
  {
    ruleId: "SEC_GIT_HEAD_EXPOSED",
    title: "Git Repository Metadata (.git/HEAD) Exposed",
    category: "sensitive_files",
    description: "The .git repository directory is publicly accessible, allowing source code extraction.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_GIT_HEAD_EXPOSED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_GIT_HEAD_EXPOSED.confidence,
    scope: "SITE",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-552" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const probe = facts.safeProbes.find((p) => p.targetType === "GIT_HEAD");
      const findings: SecurityFinding[] = [];

      if (probe && probe.isConfirmedExposed) {
        const findingId = generateFindingId("SEC_GIT_HEAD_EXPOSED", "SITE", probe.requestedUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_GIT_HEAD_EXPOSED",
          category: "sensitive_files",
          title: "Git Metadata (.git/HEAD) Publicly Accessible",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `The .git/HEAD file at ${probe.requestedUrl} is publicly readable with confirmed ref metadata (${probe.redactedEvidenceSnippet}). Attackers can reconstruct the complete source repository and commit history.`,
          evidence: {
            requestedUrl: probe.requestedUrl,
            httpStatus: probe.httpStatus,
            signatureType: probe.signatureType,
            redactedEvidence: probe.redactedEvidenceSnippet,
          },
          affectedUrls: [probe.requestedUrl],
          affectedOccurrences: 1,
          scope: "SITE",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Deny all web requests to "/.git/*" in web server / CDN configuration`,
        });
      }

      return {
        status: findings.length > 0 ? "FAIL" : probe ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: probe ? 1 : 0,
        passedTargets: probe && !probe.isConfirmedExposed ? 1 : 0,
        failedTargets: findings.length,
        notApplicableTargets: probe ? 0 : 1,
        evidenceSummary: findings.length > 0 ? ".git repository metadata is publicly exposed" : "No .git exposure detected",
      };
    },
  },
  {
    ruleId: "SEC_GIT_CONFIG_EXPOSED",
    title: "Git Configuration (.git/config) Exposed",
    category: "sensitive_files",
    description: "The .git/config file is publicly accessible, leaking repository origin and internal URLs.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_GIT_CONFIG_EXPOSED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_GIT_CONFIG_EXPOSED.confidence,
    scope: "SITE",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-552" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const probe = facts.safeProbes.find((p) => p.targetType === "BACKUP_CONFIG");
      const findings: SecurityFinding[] = [];

      if (probe && probe.isConfirmedExposed) {
        const findingId = generateFindingId("SEC_GIT_CONFIG_EXPOSED", "SITE", probe.requestedUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_GIT_CONFIG_EXPOSED",
          category: "sensitive_files",
          title: "Git Configuration (.git/config) Publicly Accessible",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `The .git/config file at ${probe.requestedUrl} is publicly accessible, exposing internal repository URLs and upstream origin details.`,
          evidence: {
            requestedUrl: probe.requestedUrl,
            httpStatus: probe.httpStatus,
            signatureType: probe.signatureType,
            redactedEvidence: probe.redactedEvidenceSnippet,
          },
          affectedUrls: [probe.requestedUrl],
          affectedOccurrences: 1,
          scope: "SITE",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: findings.length > 0 ? "FAIL" : probe ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: probe ? 1 : 0,
        passedTargets: probe && !probe.isConfirmedExposed ? 1 : 0,
        failedTargets: findings.length,
        notApplicableTargets: probe ? 0 : 1,
        evidenceSummary: findings.length > 0 ? ".git/config file is publicly exposed" : "No .git/config exposure detected",
      };
    },
  },
  {
    ruleId: "SEC_DS_STORE_EXPOSED",
    title: "macOS Desktop Services Store (.DS_Store) Exposed",
    category: "sensitive_files",
    description: "An Apple .DS_Store file is publicly accessible, disclosing directory structure and hidden file names.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DS_STORE_EXPOSED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DS_STORE_EXPOSED.confidence,
    scope: "SITE",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-552" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const probe = facts.safeProbes.find((p) => p.targetType === "DS_STORE");
      const findings: SecurityFinding[] = [];

      if (probe && probe.isConfirmedExposed) {
        const findingId = generateFindingId("SEC_DS_STORE_EXPOSED", "SITE", probe.requestedUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_DS_STORE_EXPOSED",
          category: "sensitive_files",
          title: "Apple .DS_Store File Publicly Accessible",
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `The .DS_Store file at ${probe.requestedUrl} returned HTTP 200 with verified Apple Desktop binary headers. It discloses directory listings and hidden system file names.`,
          evidence: {
            requestedUrl: probe.requestedUrl,
            httpStatus: probe.httpStatus,
            signatureType: probe.signatureType,
            byteLength: probe.byteLength,
          },
          affectedUrls: [probe.requestedUrl],
          affectedOccurrences: 1,
          scope: "SITE",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: findings.length > 0 ? "WARNING" : probe ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: probe ? 1 : 0,
        passedTargets: probe && !probe.isConfirmedExposed ? 1 : 0,
        failedTargets: findings.length,
        notApplicableTargets: probe ? 0 : 1,
        evidenceSummary: findings.length > 0 ? ".DS_Store file is publicly exposed" : "No .DS_Store exposure detected",
      };
    },
  },
];
