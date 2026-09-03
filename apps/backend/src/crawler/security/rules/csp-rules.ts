/**
 * Content-Security-Policy (CSP) Rules (SECURITY S2).
 * Evaluates CSP presence, directive restrictions, unsafe keywords, and report-only configurations.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const cspRules: SecurityRule[] = [
  {
    ruleId: "SEC_CSP_MISSING",
    title: "Content-Security-Policy (CSP) Header Missing",
    category: "csp",
    description: "The application does not return an enforced Content-Security-Policy header to restrict content execution.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-1021", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const htmlUrls = Object.values(facts.urlFacts).filter(
        (u) => u.contentType.toLowerCase().includes("text/html") || u.contentType === ""
      );

      const missingUrls: string[] = [];
      for (const u of htmlUrls) {
        const cspList = facts.securityHeadersByUrl[u.requestedUrl]?.cspEnforced || [];
        if (cspList.length === 0) {
          missingUrls.push(u.requestedUrl);
        }
      }

      const findings: SecurityFinding[] = [];
      if (missingUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_MISSING", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_MISSING",
          category: "csp",
          title: "Content-Security-Policy (CSP) Header Missing",
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `No enforced Content-Security-Policy header was observed on ${missingUrls.length} response(s). Without a CSP, browsers have no site-defined policy to restrict executable scripts, styles, or plugins, increasing XSS and data-injection risks.`,
          evidence: {
            host,
            affectedUrlCount: missingUrls.length,
            sampleUrls: missingUrls.slice(0, 5),
          },
          affectedUrls: missingUrls,
          affectedOccurrences: missingUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Deploy an enforced CSP on web server / CDN → protects ${missingUrls.length} page(s)`,
        });
      }

      return {
        status: missingUrls.length > 0 ? "FAIL" : htmlUrls.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: htmlUrls.length,
        passedTargets: htmlUrls.length - missingUrls.length,
        failedTargets: missingUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: missingUrls.length > 0 ? `CSP missing on ${missingUrls.length} URL(s)` : "Enforced CSP header is present",
      };
    },
  },
  {
    ruleId: "SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY",
    title: "CSP in Report-Only Mode Without Enforced Policy",
    category: "csp",
    description: "The application defines a Content-Security-Policy-Report-Only header but does not enforce a live CSP.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const reportOnlyWithoutEnforced: string[] = [];

      for (const u of urls) {
        const secHeaders = facts.securityHeadersByUrl[u];
        const hasEnforced = (secHeaders?.cspEnforced || []).length > 0;
        const hasReportOnly = (secHeaders?.cspReportOnly || []).length > 0;

        if (hasReportOnly && !hasEnforced) {
          reportOnlyWithoutEnforced.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (reportOnlyWithoutEnforced.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_REPORT_ONLY_WITHOUT_ENFORCED_POLICY",
          category: "csp",
          title: "CSP in Report-Only Mode Without Enforced Policy",
          severity: "informational",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "OBSERVED",
          description: `Content-Security-Policy-Report-Only is configured, but no enforced policy is active. Violations are logged but not blocked.`,
          evidence: { host, affectedUrlCount: reportOnlyWithoutEnforced.length },
          affectedUrls: reportOnlyWithoutEnforced,
          affectedOccurrences: reportOnlyWithoutEnforced.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: reportOnlyWithoutEnforced.length > 0 ? "OBSERVED" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - reportOnlyWithoutEnforced.length,
        failedTargets: reportOnlyWithoutEnforced.length,
        notApplicableTargets: 0,
        evidenceSummary: reportOnlyWithoutEnforced.length > 0 ? `Report-Only CSP active without enforced policy on ${reportOnlyWithoutEnforced.length} URL(s)` : "No un-enforced Report-Only CSPs",
      };
    },
  },
  {
    ruleId: "SEC_CSP_UNSAFE_INLINE",
    title: "CSP Permissive 'unsafe-inline' Directive",
    category: "csp",
    description: "The Content-Security-Policy includes 'unsafe-inline', allowing arbitrary inline scripts or styles to execute.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_UNSAFE_INLINE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_UNSAFE_INLINE.confidence,
    scope: "HOST",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A03:2021-Injection", cwe: "CWE-79" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const unsafeInlineUrls: string[] = [];

      for (const u of urls) {
        const enforced = facts.securityHeadersByUrl[u]?.cspEnforced || [];
        const hasUnsafe = enforced.some(
          (c) =>
            c.directives["script-src"]?.hasUnsafeInline ||
            c.directives["default-src"]?.hasUnsafeInline
        );
        if (hasUnsafe) {
          unsafeInlineUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (unsafeInlineUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_UNSAFE_INLINE", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_UNSAFE_INLINE",
          category: "csp",
          title: "CSP Permissive 'unsafe-inline' Directive",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `The CSP on ${host} includes 'unsafe-inline' in script-src / default-src. This significantly reduces XSS protection by allowing inline script blocks and event handlers to execute.`,
          evidence: { host, affectedUrlCount: unsafeInlineUrls.length },
          affectedUrls: unsafeInlineUrls,
          affectedOccurrences: unsafeInlineUrls.length,
          scope: "HOST",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      return {
        status: unsafeInlineUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - unsafeInlineUrls.length,
        failedTargets: unsafeInlineUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: unsafeInlineUrls.length > 0 ? `'unsafe-inline' detected in CSP on ${unsafeInlineUrls.length} URL(s)` : "CSP does not allow 'unsafe-inline'",
      };
    },
  },
  {
    ruleId: "SEC_CSP_UNSAFE_EVAL",
    title: "CSP Permissive 'unsafe-eval' Directive",
    category: "csp",
    description: "The Content-Security-Policy includes 'unsafe-eval', allowing string-to-code execution functions like eval().",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_UNSAFE_EVAL.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_UNSAFE_EVAL.confidence,
    scope: "HOST",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A03:2021-Injection", cwe: "CWE-95" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const unsafeEvalUrls: string[] = [];

      for (const u of urls) {
        const enforced = facts.securityHeadersByUrl[u]?.cspEnforced || [];
        const hasEval = enforced.some(
          (c) =>
            c.directives["script-src"]?.hasUnsafeEval ||
            c.directives["default-src"]?.hasUnsafeEval
        );
        if (hasEval) {
          unsafeEvalUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (unsafeEvalUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_UNSAFE_EVAL", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_UNSAFE_EVAL",
          category: "csp",
          title: "CSP Permissive 'unsafe-eval' Directive",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `The CSP on ${host} includes 'unsafe-eval', permitting dynamic JavaScript code evaluation via eval() and Function constructor.`,
          evidence: { host, affectedUrlCount: unsafeEvalUrls.length },
          affectedUrls: unsafeEvalUrls,
          affectedOccurrences: unsafeEvalUrls.length,
          scope: "HOST",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      return {
        status: unsafeEvalUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - unsafeEvalUrls.length,
        failedTargets: unsafeEvalUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: unsafeEvalUrls.length > 0 ? `'unsafe-eval' detected in CSP on ${unsafeEvalUrls.length} URL(s)` : "CSP does not allow 'unsafe-eval'",
      };
    },
  },
  {
    ruleId: "SEC_CSP_BROAD_WILDCARD_SOURCE",
    title: "CSP Wildcard Source In Directive",
    category: "csp",
    description: "The CSP specifies wildcard '*' or unconstrained scheme sources in sensitive resource directives.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_BROAD_WILDCARD_SOURCE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_BROAD_WILDCARD_SOURCE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const wildcardUrls: string[] = [];

      for (const u of urls) {
        const enforced = facts.securityHeadersByUrl[u]?.cspEnforced || [];
        const hasWildcard = enforced.some(
          (c) =>
            c.directives["default-src"]?.hasWildcard ||
            c.directives["script-src"]?.hasWildcard ||
            c.directives["frame-src"]?.hasWildcard
        );
        if (hasWildcard) {
          wildcardUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      if (wildcardUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_BROAD_WILDCARD_SOURCE", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_BROAD_WILDCARD_SOURCE",
          category: "csp",
          title: "CSP Wildcard Source Directive",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `CSP allows wildcard (*) sources in default-src, script-src, or frame-src, allowing scripts or embeds from any external origin.`,
          evidence: { host, affectedUrlCount: wildcardUrls.length },
          affectedUrls: wildcardUrls,
          affectedOccurrences: wildcardUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: wildcardUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - wildcardUrls.length,
        failedTargets: wildcardUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: wildcardUrls.length > 0 ? `Wildcard source in CSP on ${wildcardUrls.length} URL(s)` : "CSP does not declare wildcard sources",
      };
    },
  },
  {
    ruleId: "SEC_CSP_OBJECT_SRC_UNRESTRICTED",
    title: "CSP object-src Directive Unrestricted",
    category: "csp",
    description: "The Content-Security-Policy does not restrict plugins via object-src 'none'.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_OBJECT_SRC_UNRESTRICTED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_OBJECT_SRC_UNRESTRICTED.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const unrestrictedUrls: string[] = [];

      for (const u of urls) {
        const enforced = facts.securityHeadersByUrl[u]?.cspEnforced || [];
        if (enforced.length > 0) {
          const hasObjectNone = enforced.some(
            (c) => c.directives["object-src"]?.hasNone || (c.directives["default-src"]?.hasNone && !c.hasObjectSrc)
          );
          if (!hasObjectNone) {
            unrestrictedUrls.push(u);
          }
        }
      }

      const findings: SecurityFinding[] = [];
      if (unrestrictedUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_OBJECT_SRC_UNRESTRICTED", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_OBJECT_SRC_UNRESTRICTED",
          category: "csp",
          title: "CSP object-src Directive Unrestricted",
          severity: "informational",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "OBSERVED",
          description: `CSP does not set object-src 'none' to restrict Flash, Java, or legacy browser plugin execution.`,
          evidence: { host, affectedUrlCount: unrestrictedUrls.length },
          affectedUrls: unrestrictedUrls,
          affectedOccurrences: unrestrictedUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: unrestrictedUrls.length > 0 ? "OBSERVED" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - unrestrictedUrls.length,
        failedTargets: unrestrictedUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: unrestrictedUrls.length > 0 ? `object-src unrestricted on ${unrestrictedUrls.length} URL(s)` : "object-src restricted in CSP",
      };
    },
  },
  {
    ruleId: "SEC_CSP_BASE_URI_MISSING",
    title: "CSP base-uri Directive Missing",
    category: "csp",
    description: "The Content-Security-Policy does not restrict the base-uri directive, allowing base tag hijacking.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_BASE_URI_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_BASE_URI_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const missingBaseUriUrls: string[] = [];

      for (const u of urls) {
        const enforced = facts.securityHeadersByUrl[u]?.cspEnforced || [];
        if (enforced.length > 0) {
          const hasBaseUri = enforced.some((c) => c.hasBaseUri);
          if (!hasBaseUri) {
            missingBaseUriUrls.push(u);
          }
        }
      }

      const findings: SecurityFinding[] = [];
      if (missingBaseUriUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_CSP_BASE_URI_MISSING", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_BASE_URI_MISSING",
          category: "csp",
          title: "CSP base-uri Directive Missing",
          severity: "informational",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "OBSERVED",
          description: `CSP does not specify base-uri (e.g. base-uri 'self'), which prevents attackers from altering relative URL resolution by injecting <base href="..."> tags.`,
          evidence: { host, affectedUrlCount: missingBaseUriUrls.length },
          affectedUrls: missingBaseUriUrls,
          affectedOccurrences: missingBaseUriUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: missingBaseUriUrls.length > 0 ? "OBSERVED" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - missingBaseUriUrls.length,
        failedTargets: missingBaseUriUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: missingBaseUriUrls.length > 0 ? `base-uri missing in CSP on ${missingBaseUriUrls.length} URL(s)` : "base-uri declared in CSP",
      };
    },
  },
  {
    ruleId: "SEC_CSP_MALFORMED",
    title: "Malformed CSP Header Syntax",
    category: "csp",
    description: "The Content-Security-Policy header contains invalid syntax or unrecognized directive tokens.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_MALFORMED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CSP_MALFORMED.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const urls = Object.keys(facts.urlFacts);
      const malformedUrls: string[] = [];

      for (const u of urls) {
        const enforced = facts.securityHeadersByUrl[u]?.cspEnforced || [];
        const reportOnly = facts.securityHeadersByUrl[u]?.cspReportOnly || [];
        const hasErrors = [...enforced, ...reportOnly].some((c) => !c.parsedSuccessfully || c.parseErrors.length > 0);
        if (hasErrors) {
          malformedUrls.push(u);
        }
      }

      const findings: SecurityFinding[] = [];
      for (const u of malformedUrls) {
        const secHeaders = facts.securityHeadersByUrl[u];
        const allErrors = [
          ...(secHeaders?.cspEnforced || []).flatMap((c) => c.parseErrors),
          ...(secHeaders?.cspReportOnly || []).flatMap((c) => c.parseErrors),
        ];
        const findingId = generateFindingId("SEC_CSP_MALFORMED", "URL", u);
        findings.push({
          id: findingId,
          ruleId: "SEC_CSP_MALFORMED",
          category: "csp",
          title: "Malformed CSP Header Syntax",
          severity: "low",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `CSP header contains syntax errors: ${allErrors.join("; ")}.`,
          evidence: { url: u, parseErrors: allErrors },
          affectedUrls: [u],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: malformedUrls.length > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: urls.length,
        passedTargets: urls.length - malformedUrls.length,
        failedTargets: malformedUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: malformedUrls.length > 0 ? `Malformed CSP syntax on ${malformedUrls.length} URL(s)` : "CSP syntax valid",
      };
    },
  },
];
