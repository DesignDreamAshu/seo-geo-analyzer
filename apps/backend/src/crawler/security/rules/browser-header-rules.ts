/**
 * Browser Security Headers Rules (SECURITY S2).
 * Evaluates X-Content-Type-Options, Referrer-Policy, and MIME sniffing protection.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const browserHeaderRules: SecurityRule[] = [
  {
    ruleId: "SEC_X_CONTENT_TYPE_OPTIONS_MISSING",
    title: "X-Content-Type-Options Header Missing",
    category: "headers",
    description: "The response is missing the X-Content-Type-Options: nosniff header, allowing browsers to perform MIME-type sniffing.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_X_CONTENT_TYPE_OPTIONS_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_X_CONTENT_TYPE_OPTIONS_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-79", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const missingUrls: string[] = [];

      for (const u of urls) {
        const xcto = facts.securityHeadersByUrl[u]?.xContentTypeOptions;
        if (!xcto) {
          missingUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (missingUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_X_CONTENT_TYPE_OPTIONS_MISSING", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_X_CONTENT_TYPE_OPTIONS_MISSING",
          category: "headers",
          title: "X-Content-Type-Options: nosniff Header Missing",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `No X-Content-Type-Options header was observed on ${missingUrls.length} response(s). Adding "nosniff" instructs browsers to strictly adhere to declared MIME types and disable MIME-sniffing, preventing executable scripts from being executed as images or text.`,
          evidence: { host, affectedUrlCount: missingUrls.length, sampleUrls: missingUrls.slice(0, 5) },
          affectedUrls: missingUrls,
          affectedOccurrences: missingUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Add "X-Content-Type-Options: nosniff" to global server headers → protects all ${missingUrls.length} responses`,
        });
      }

      return {
        status: missingUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - missingUrls.length,
        failedTargets: missingUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: missingUrls.length > 0 ? `X-Content-Type-Options missing on ${missingUrls.length} URL(s)` : "X-Content-Type-Options: nosniff present",
      };
    },
  },
  {
    ruleId: "SEC_X_CONTENT_TYPE_OPTIONS_INVALID",
    title: "X-Content-Type-Options Header Invalid Value",
    category: "headers",
    description: "The X-Content-Type-Options header is set but contains an invalid value instead of 'nosniff'.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_X_CONTENT_TYPE_OPTIONS_INVALID.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_X_CONTENT_TYPE_OPTIONS_INVALID.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const invalidUrls: Array<{ url: string; raw: string }> = [];

      for (const u of urls) {
        const xcto = facts.securityHeadersByUrl[u]?.xContentTypeOptions;
        if (xcto && xcto.isMalformed) {
          invalidUrls.push({ url: u, raw: xcto.raw || "" });
        }
      }

      const findings: SecurityFinding[] = [];
      for (const item of invalidUrls) {
        const findingId = generateFindingId("SEC_X_CONTENT_TYPE_OPTIONS_INVALID", "URL", item.url);
        findings.push({
          id: findingId,
          ruleId: "SEC_X_CONTENT_TYPE_OPTIONS_INVALID",
          category: "headers",
          title: "X-Content-Type-Options Invalid Value",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `X-Content-Type-Options value "${item.raw}" is invalid. The only valid standard directive is "nosniff".`,
          evidence: { url: item.url, rawValue: item.raw },
          affectedUrls: [item.url],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: invalidUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - invalidUrls.length,
        failedTargets: invalidUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: invalidUrls.length > 0 ? `Invalid X-Content-Type-Options value on ${invalidUrls.length} URL(s)` : "X-Content-Type-Options valid",
      };
    },
  },
  {
    ruleId: "SEC_REFERRER_POLICY_MISSING",
    title: "Referrer-Policy Header Missing",
    category: "headers",
    description: "The application does not set an explicit Referrer-Policy header to control URL leakage in the Referer header.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_REFERRER_POLICY_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_REFERRER_POLICY_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const missingUrls: string[] = [];

      for (const u of urls) {
        const ref = facts.securityHeadersByUrl[u]?.referrerPolicy;
        if (!ref) {
          missingUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (missingUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_REFERRER_POLICY_MISSING", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_REFERRER_POLICY_MISSING",
          category: "headers",
          title: "Referrer-Policy Header Missing",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `No explicit Referrer-Policy header was observed on ${missingUrls.length} response(s). Configuring a strict policy (such as strict-origin-when-cross-origin) prevents internal paths and sensitive query parameters from leaking to external destinations.`,
          evidence: { host, affectedUrlCount: missingUrls.length, sampleUrls: missingUrls.slice(0, 5) },
          affectedUrls: missingUrls,
          affectedOccurrences: missingUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Set "Referrer-Policy: strict-origin-when-cross-origin" on ${host} → protects all ${missingUrls.length} URL(s)`,
        });
      }

      return {
        status: missingUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - missingUrls.length,
        failedTargets: missingUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: missingUrls.length > 0 ? `Referrer-Policy missing on ${missingUrls.length} URL(s)` : "Referrer-Policy header present",
      };
    },
  },
  {
    ruleId: "SEC_REFERRER_POLICY_OVERLY_PERMISSIVE",
    title: "Referrer-Policy Set to Overly Permissive 'unsafe-url'",
    category: "headers",
    description: "The Referrer-Policy header is configured with unsafe-url or no-referrer-when-downgrade, which leaks full URL paths to external origins.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_REFERRER_POLICY_OVERLY_PERMISSIVE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_REFERRER_POLICY_OVERLY_PERMISSIVE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const permissiveUrls: string[] = [];

      for (const u of urls) {
        const ref = facts.securityHeadersByUrl[u]?.referrerPolicy;
        if (ref && ref.hasUnsafeUrl) {
          permissiveUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (permissiveUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_REFERRER_POLICY_OVERLY_PERMISSIVE", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_REFERRER_POLICY_OVERLY_PERMISSIVE",
          category: "headers",
          title: "Referrer-Policy Set to Overly Permissive Policy",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `Referrer-Policy on ${host} is configured as "unsafe-url", which sends the full URL (including path and query parameters) with every request to any origin.`,
          evidence: { host, affectedUrlCount: permissiveUrls.length },
          affectedUrls: permissiveUrls,
          affectedOccurrences: permissiveUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: permissiveUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - permissiveUrls.length,
        failedTargets: permissiveUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: permissiveUrls.length > 0 ? `Overly permissive Referrer-Policy on ${permissiveUrls.length} URL(s)` : "Referrer-Policy is safely constrained",
      };
    },
  },
];
