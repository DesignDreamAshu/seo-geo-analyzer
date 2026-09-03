/**
 * Cross-Origin Resource Sharing (CORS) Rules (SECURITY S2).
 * Evaluates CORS configurations, credentials handling, and wildcard allowances.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const corsRules: SecurityRule[] = [
  {
    ruleId: "SEC_CORS_WILDCARD_WITH_CREDENTIALS",
    title: "CORS Wildcard Origin Combined with Allow-Credentials",
    category: "cors",
    description: "The response declares Access-Control-Allow-Origin: * along with Access-Control-Allow-Credentials: true, violating the CORS specification.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CORS_WILDCARD_WITH_CREDENTIALS.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CORS_WILDCARD_WITH_CREDENTIALS.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-942" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const dangerousCorsUrls: string[] = [];

      for (const u of urls) {
        const cors = facts.securityHeadersByUrl[u]?.cors;
        if (cors && cors.isDangerousWildcardCredentialsCombination) {
          dangerousCorsUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      for (const u of dangerousCorsUrls) {
        const findingId = generateFindingId("SEC_CORS_WILDCARD_WITH_CREDENTIALS", "URL", u);
        findings.push({
          id: findingId,
          ruleId: "SEC_CORS_WILDCARD_WITH_CREDENTIALS",
          category: "cors",
          title: "Invalid CORS Wildcard with Credentials Misconfiguration",
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `URL ${u} returns Access-Control-Allow-Origin: * together with Access-Control-Allow-Credentials: true. Browsers disallow credentialed cross-origin requests when a wildcard origin is specified. This represents an invalid server misconfiguration that indicates contradictory access control intent.`,
          evidence: {
            url: u,
            allowOrigin: "*",
            allowCredentials: "true",
          },
          affectedUrls: [u],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: dangerousCorsUrls.length > 0 ? "FAIL" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - dangerousCorsUrls.length,
        failedTargets: dangerousCorsUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: dangerousCorsUrls.length > 0 ? `Dangerous CORS configuration on ${dangerousCorsUrls.length} URL(s)` : "No dangerous wildcard CORS with credentials",
      };
    },
  },
  {
    ruleId: "SEC_CORS_WILDCARD",
    title: "CORS Wildcard Allowed Origin (Public Resource)",
    category: "cors",
    description: "The response declares Access-Control-Allow-Origin: *, allowing any third-party domain to read the response.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CORS_WILDCARD.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CORS_WILDCARD.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const wildcardUrls: string[] = [];

      for (const u of urls) {
        const cors = facts.securityHeadersByUrl[u]?.cors;
        if (cors && cors.isWildcardOrigin && !cors.isAllowCredentialsTrue) {
          wildcardUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (wildcardUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CORS_WILDCARD", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CORS_WILDCARD",
          category: "cors",
          title: "CORS Wildcard Access-Control-Allow-Origin Allowed",
          severity: "informational",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "OBSERVED",
          description: `Observed Access-Control-Allow-Origin: * on ${wildcardUrls.length} response(s). This is appropriate for public assets and public APIs, but ensure sensitive user data is not exposed.`,
          evidence: { host, affectedUrlCount: wildcardUrls.length, sampleUrls: wildcardUrls.slice(0, 5) },
          affectedUrls: wildcardUrls,
          affectedOccurrences: wildcardUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: wildcardUrls.length > 0 ? "OBSERVED" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - wildcardUrls.length,
        failedTargets: wildcardUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: wildcardUrls.length > 0 ? `Wildcard CORS observed on ${wildcardUrls.length} URL(s)` : "No wildcard CORS observed",
      };
    },
  },
];
