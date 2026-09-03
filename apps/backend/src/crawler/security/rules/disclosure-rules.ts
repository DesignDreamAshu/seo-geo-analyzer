/**
 * Information Disclosure Security Rules (SECURITY S2).
 * Evaluates Server headers, X-Powered-By, debug markers, and software version leakage.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const disclosureRules: SecurityRule[] = [
  {
    ruleId: "SEC_X_POWERED_BY_DISCLOSURE",
    title: "Technology Stack Disclosed in X-Powered-By Header",
    category: "information_disclosure",
    description: "The application returns an X-Powered-By header disclosing backend framework/runtime technologies.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_X_POWERED_BY_DISCLOSURE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_X_POWERED_BY_DISCLOSURE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-200" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const disclosedUrls: Array<{ url: string; header: string }> = [];

      for (const u of urls) {
        const xpb = facts.securityHeadersByUrl[u]?.serverDisclosure.rawXPoweredBy;
        if (xpb) {
          disclosedUrls.push({ url: u, header: xpb });
        }
      }

      const findings: SecurityFinding[] = [];
      if (disclosedUrls.length > 0) {
        const host = facts.targetDomain;
        const sampleHeader = disclosedUrls[0].header;
        const findingId = generateFindingId("SEC_X_POWERED_BY_DISCLOSURE", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_X_POWERED_BY_DISCLOSURE",
          category: "information_disclosure",
          title: `Technology Disclosed in X-Powered-By: ${sampleHeader}`,
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `The web server returns an "X-Powered-By: ${sampleHeader}" header on ${disclosedUrls.length} response(s), revealing backend application technology to potential attackers.`,
          evidence: {
            host,
            disclosedHeader: sampleHeader,
            affectedUrlCount: disclosedUrls.length,
          },
          affectedUrls: disclosedUrls.map((d) => d.url),
          affectedOccurrences: disclosedUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Disable X-Powered-By header in application / web server → removes disclosure on all ${disclosedUrls.length} URL(s)`,
        });
      }

      return {
        status: disclosedUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - disclosedUrls.length,
        failedTargets: disclosedUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: disclosedUrls.length > 0 ? `X-Powered-By disclosed on ${disclosedUrls.length} URL(s)` : "No X-Powered-By header exposed",
      };
    },
  },
  {
    ruleId: "SEC_SERVER_VERSION_DISCLOSURE",
    title: "Detailed Web Server Version Disclosed in Server Header",
    category: "information_disclosure",
    description: "The Server response header reveals exact software versions (e.g., Apache/2.4.51, nginx/1.18.0).",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_SERVER_VERSION_DISCLOSURE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_SERVER_VERSION_DISCLOSURE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-200" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const versionDisclosedUrls: Array<{ url: string; header: string }> = [];

      for (const u of urls) {
        const rawServer = facts.securityHeadersByUrl[u]?.serverDisclosure.rawServer;
        // Check if server header contains numbers/version string (e.g. Apache/2.4, nginx/1.24)
        if (rawServer && /\d+\.\d+/.test(rawServer)) {
          versionDisclosedUrls.push({ url: u, header: rawServer });
        }
      }

      const findings: SecurityFinding[] = [];
      if (versionDisclosedUrls.length > 0) {
        const host = facts.targetDomain;
        const sampleHeader = versionDisclosedUrls[0].header;
        const findingId = generateFindingId("SEC_SERVER_VERSION_DISCLOSURE", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_SERVER_VERSION_DISCLOSURE",
          category: "information_disclosure",
          title: `Detailed Server Version Disclosed: ${sampleHeader}`,
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `The web server discloses its exact version in the "Server: ${sampleHeader}" response header on ${versionDisclosedUrls.length} response(s). This simplifies automated vulnerability scanning for attackers.`,
          evidence: {
            host,
            serverHeader: sampleHeader,
            affectedUrlCount: versionDisclosedUrls.length,
          },
          affectedUrls: versionDisclosedUrls.map((d) => d.url),
          affectedOccurrences: versionDisclosedUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Configure "ServerTokens Prod" / "server_tokens off" → hides version on all ${versionDisclosedUrls.length} URL(s)`,
        });
      }

      return {
        status: versionDisclosedUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - versionDisclosedUrls.length,
        failedTargets: versionDisclosedUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: versionDisclosedUrls.length > 0 ? `Server version disclosed on ${versionDisclosedUrls.length} URL(s)` : "No detailed server version disclosed",
      };
    },
  },
  {
    ruleId: "SEC_DEBUG_HEADER_EXPOSURE",
    title: "Debug / Internal Diagnostic Headers Exposed",
    category: "information_disclosure",
    description: "Response headers contain internal diagnostic or debug markers (e.g. X-Debug, X-AspNet-Version, X-SourceMap).",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DEBUG_HEADER_EXPOSURE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DEBUG_HEADER_EXPOSURE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const debugUrls: Array<{ url: string; headers: string[] }> = [];

      for (const u of urls) {
        const rawHeaders = facts.urlFacts[u]?.rawHeaders || {};
        const foundDebug: string[] = [];
        for (const [k, v] of Object.entries(rawHeaders)) {
          const lower = k.toLowerCase();
          if (
            lower.includes("debug") ||
            lower === "x-aspnet-version" ||
            lower === "x-aspnetmvc-version" ||
            lower === "x-runtime" ||
            lower === "x-sourcemap"
          ) {
            foundDebug.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
          }
        }
        if (foundDebug.length > 0) {
          debugUrls.push({ url: u, headers: foundDebug });
        }
      }

      const findings: SecurityFinding[] = [];
      if (debugUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_DEBUG_HEADER_EXPOSURE", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_DEBUG_HEADER_EXPOSURE",
          category: "information_disclosure",
          title: "Internal Debug / Diagnostic Headers Exposed",
          severity: "informational",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "OBSERVED",
          description: `Observed internal debug headers (${debugUrls[0].headers.join("; ")}) on ${debugUrls.length} response(s).`,
          evidence: { host, sampleHeaders: debugUrls[0].headers, affectedUrlCount: debugUrls.length },
          affectedUrls: debugUrls.map((d) => d.url),
          affectedOccurrences: debugUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: debugUrls.length > 0 ? "OBSERVED" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - debugUrls.length,
        failedTargets: debugUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: debugUrls.length > 0 ? `Debug headers found on ${debugUrls.length} URL(s)` : "No internal debug headers exposed",
      };
    },
  },
];
