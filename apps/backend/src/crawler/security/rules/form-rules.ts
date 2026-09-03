/**
 * HTML Form & Input Security Rules (SECURITY S2).
 * Evaluates transport protocol integrity, password transmission safety, GET forms with sensitive data, and cross-origin actions.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const formRules: SecurityRule[] = [
  {
    ruleId: "SEC_FORM_HTTPS_TO_HTTP",
    title: "Secure HTTPS Page Submits Form to Insecure HTTP Endpoint",
    category: "forms",
    description: "A form hosted on an HTTPS page posts user input to an unencrypted HTTP action URL.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_FORM_HTTPS_TO_HTTP.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_FORM_HTTPS_TO_HTTP.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const insecureActionForms = facts.forms.filter(
        (f) => f.sourcePageIsHttps && f.resolvedAbsoluteActionUrl.startsWith("http://")
      );

      const findings: SecurityFinding[] = [];
      const seenPages = new Set<string>();

      for (const form of insecureActionForms) {
        if (seenPages.has(form.sourcePageUrl)) continue;
        seenPages.add(form.sourcePageUrl);

        const findingId = generateFindingId("SEC_FORM_HTTPS_TO_HTTP", "URL", form.sourcePageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_FORM_HTTPS_TO_HTTP",
          category: "forms",
          title: "Form Action Submits to Insecure HTTP Endpoint",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `An HTML form on HTTPS page ${form.sourcePageUrl} submits user data to plaintext HTTP endpoint ${form.resolvedAbsoluteActionUrl}. Modern browsers will block or warn users against this insecure form submission.`,
          evidence: {
            sourcePageUrl: form.sourcePageUrl,
            actionUrl: form.resolvedAbsoluteActionUrl,
            method: form.method,
            inputsCount: form.inputs.length,
          },
          affectedUrls: [form.sourcePageUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalForms = facts.forms.length;
      return {
        status: insecureActionForms.length > 0 ? "FAIL" : totalForms > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalForms,
        passedTargets: totalForms - insecureActionForms.length,
        failedTargets: insecureActionForms.length,
        notApplicableTargets: 0,
        evidenceSummary: insecureActionForms.length > 0 ? `${insecureActionForms.length} form(s) submit to unencrypted HTTP` : "All forms submit to secure HTTPS endpoints",
      };
    },
  },
  {
    ruleId: "SEC_PASSWORD_FORM_OVER_HTTP",
    title: "Password Input Form Served Over Unencrypted Plaintext HTTP",
    category: "forms",
    description: "A page containing password inputs is served or submitted over unencrypted HTTP.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_PASSWORD_FORM_OVER_HTTP.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_PASSWORD_FORM_OVER_HTTP.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const plaintextPasswordForms = facts.forms.filter(
        (f) => f.hasPasswordInput && (!f.sourcePageIsHttps || f.resolvedAbsoluteActionUrl.startsWith("http://"))
      );

      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const form of plaintextPasswordForms) {
        if (seen.has(form.sourcePageUrl)) continue;
        seen.add(form.sourcePageUrl);

        const findingId = generateFindingId("SEC_PASSWORD_FORM_OVER_HTTP", "URL", form.sourcePageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_PASSWORD_FORM_OVER_HTTP",
          category: "forms",
          title: "Critical: Password Form Transmitted Over Insecure HTTP",
          severity: "critical",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `A password form on ${form.sourcePageUrl} is hosted or submitted over unencrypted HTTP. User authentication credentials can be intercepted in transit by any observer on the network.`,
          evidence: {
            pageUrl: form.sourcePageUrl,
            actionUrl: form.resolvedAbsoluteActionUrl,
            pageIsHttps: form.sourcePageIsHttps,
          },
          affectedUrls: [form.sourcePageUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      const passwordFormsCount = facts.forms.filter((f) => f.hasPasswordInput).length;
      return {
        status: plaintextPasswordForms.length > 0 ? "FAIL" : passwordFormsCount > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: passwordFormsCount,
        passedTargets: passwordFormsCount - plaintextPasswordForms.length,
        failedTargets: plaintextPasswordForms.length,
        notApplicableTargets: facts.forms.length - passwordFormsCount,
        evidenceSummary: plaintextPasswordForms.length > 0 ? `${plaintextPasswordForms.length} password form(s) served over plaintext HTTP` : "All password forms are protected by HTTPS",
      };
    },
  },
  {
    ruleId: "SEC_PASSWORD_FIELD_USING_GET",
    title: "Password Form Uses HTTP Method GET",
    category: "forms",
    description: "An HTML form with password input fields uses the GET method, appending passwords to the URL query string.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_PASSWORD_FIELD_USING_GET.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_PASSWORD_FIELD_USING_GET.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-598" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const getPasswordForms = facts.forms.filter(
        (f) => f.hasPasswordInput && f.method.toUpperCase() === "GET"
      );

      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const form of getPasswordForms) {
        if (seen.has(form.sourcePageUrl)) continue;
        seen.add(form.sourcePageUrl);

        const findingId = generateFindingId("SEC_PASSWORD_FIELD_USING_GET", "URL", form.sourcePageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_PASSWORD_FIELD_USING_GET",
          category: "forms",
          title: "Password Form Uses HTTP GET Method",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Form on ${form.sourcePageUrl} contains password inputs but submits via method="GET". Passwords will be exposed in browser history, server logs, web analytics, and the Referer header.`,
          evidence: {
            pageUrl: form.sourcePageUrl,
            actionUrl: form.resolvedAbsoluteActionUrl,
            method: form.method,
          },
          affectedUrls: [form.sourcePageUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const passwordFormsCount = facts.forms.filter((f) => f.hasPasswordInput).length;
      return {
        status: getPasswordForms.length > 0 ? "FAIL" : passwordFormsCount > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: passwordFormsCount,
        passedTargets: passwordFormsCount - getPasswordForms.length,
        failedTargets: getPasswordForms.length,
        notApplicableTargets: facts.forms.length - passwordFormsCount,
        evidenceSummary: getPasswordForms.length > 0 ? `${getPasswordForms.length} password form(s) use method="GET"` : "No password forms use method='GET'",
      };
    },
  },
  {
    ruleId: "SEC_SENSITIVE_GET_FORM",
    title: "Sensitive Form Inputs Submitted via HTTP Method GET",
    category: "forms",
    description: "An HTML form with sensitive inputs (token, secret, card, ssn) uses method GET.",
    verificationClassification: "heuristic",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_SENSITIVE_GET_FORM.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_SENSITIVE_GET_FORM.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-598" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const sensitiveGetForms = facts.forms.filter(
        (f) => f.hasSensitiveInputInGetForm && !f.hasPasswordInput
      );

      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const form of sensitiveGetForms) {
        if (seen.has(form.sourcePageUrl)) continue;
        seen.add(form.sourcePageUrl);

        const findingId = generateFindingId("SEC_SENSITIVE_GET_FORM", "URL", form.sourcePageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_SENSITIVE_GET_FORM",
          category: "forms",
          title: "Sensitive Form Fields Submitted via GET Method",
          severity: "medium",
          confidence: "medium",
          verificationClassification: "heuristic",
          status: "WARNING",
          description: `Form on ${form.sourcePageUrl} contains sensitive field names but uses method="GET", leaking parameters into URL strings.`,
          evidence: {
            pageUrl: form.sourcePageUrl,
            actionUrl: form.resolvedAbsoluteActionUrl,
            method: form.method,
          },
          affectedUrls: [form.sourcePageUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      return {
        status: sensitiveGetForms.length > 0 ? "WARNING" : facts.forms.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: facts.forms.length,
        passedTargets: facts.forms.length - sensitiveGetForms.length,
        failedTargets: sensitiveGetForms.length,
        notApplicableTargets: 0,
        evidenceSummary: sensitiveGetForms.length > 0 ? `${sensitiveGetForms.length} sensitive form(s) use method="GET"` : "No sensitive inputs in GET forms",
      };
    },
  },
  {
    ruleId: "SEC_EXTERNAL_FORM_SUBMISSION",
    title: "Form Submits to External Third-Party Origin",
    category: "forms",
    description: "An HTML form submits data to a different external origin.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_EXTERNAL_FORM_SUBMISSION.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_EXTERNAL_FORM_SUBMISSION.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const crossDomainForms = facts.forms.filter((f) => f.isCrossDomainAction);
      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const form of crossDomainForms) {
        if (seen.has(form.sourcePageUrl)) continue;
        seen.add(form.sourcePageUrl);

        const findingId = generateFindingId("SEC_EXTERNAL_FORM_SUBMISSION", "URL", form.sourcePageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_EXTERNAL_FORM_SUBMISSION",
          category: "forms",
          title: "Form Submits to External Third-Party Action URL",
          severity: "informational",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "OBSERVED",
          description: `Form on ${form.sourcePageUrl} submits data to external origin ${form.resolvedAbsoluteActionUrl}. Verify this third-party destination is intended (e.g. payment gateway, CRM, or newsletter provider).`,
          evidence: {
            pageUrl: form.sourcePageUrl,
            actionUrl: form.resolvedAbsoluteActionUrl,
          },
          affectedUrls: [form.sourcePageUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      return {
        status: crossDomainForms.length > 0 ? "OBSERVED" : facts.forms.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: facts.forms.length,
        passedTargets: facts.forms.length - crossDomainForms.length,
        failedTargets: crossDomainForms.length,
        notApplicableTargets: 0,
        evidenceSummary: crossDomainForms.length > 0 ? `${crossDomainForms.length} form(s) post to external endpoints` : "No external form actions observed",
      };
    },
  },
];
