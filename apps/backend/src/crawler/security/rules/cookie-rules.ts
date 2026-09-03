/**
 * Cookie Security Rules (SECURITY S2).
 * Evaluates Secure, HttpOnly, SameSite, cookie prefix integrity, and transport security.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const cookieRules: SecurityRule[] = [
  {
    ruleId: "SEC_COOKIE_SECURE_MISSING",
    title: "Secure Attribute Missing on HTTPS / Session Cookie",
    category: "cookies",
    description: "A cookie set on an HTTPS connection or containing session data lacks the Secure attribute, allowing plaintext transmission.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SECURE_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SECURE_MISSING.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-614", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const insecureCookies = facts.cookies.filter(
        (c) => (!c.isSecure && !c.setOverInsecureTransport) || (!c.isSecure && c.isSuspectedSessionOrAuth)
      );

      const findings: SecurityFinding[] = [];
      const seenKeys = new Set<string>();

      for (const cookie of insecureCookies) {
        const dedupeKey = `${cookie.cookieName}:${cookie.domain || ""}:${cookie.path || ""}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const findingId = generateFindingId("SEC_COOKIE_SECURE_MISSING", "COOKIE", cookie.cookieName);
        findings.push({
          id: findingId,
          ruleId: "SEC_COOKIE_SECURE_MISSING",
          category: "cookies",
          title: `Cookie "${cookie.cookieName}" Missing Secure Flag`,
          severity: cookie.isSuspectedSessionOrAuth ? "high" : "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Cookie "${cookie.cookieName}" was set without the "Secure" flag on ${cookie.sourceUrl}. Browsers will transmit this cookie over unencrypted HTTP connections if requested.`,
          evidence: {
            cookieName: cookie.cookieName,
            redactedValue: cookie.redactedValue,
            isSuspectedSessionOrAuth: cookie.isSuspectedSessionOrAuth,
            sourceUrl: cookie.sourceUrl,
          },
          affectedUrls: [cookie.sourceUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalCookies = facts.cookies.length;
      return {
        status: insecureCookies.length > 0 ? "FAIL" : totalCookies > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalCookies,
        passedTargets: totalCookies - insecureCookies.length,
        failedTargets: insecureCookies.length,
        notApplicableTargets: 0,
        evidenceSummary: insecureCookies.length > 0 ? `Secure flag missing on ${insecureCookies.length} cookie(s)` : "All evaluated HTTPS cookies have Secure flag",
      };
    },
  },
  {
    ruleId: "SEC_COOKIE_HTTPONLY_MISSING",
    title: "HttpOnly Attribute Missing on Session Cookie",
    category: "cookies",
    description: "A sensitive session/authentication cookie lacks the HttpOnly attribute, exposing it to client-side script theft via XSS.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_HTTPONLY_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_HTTPONLY_MISSING.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-1004" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      // Only evaluate for session/auth sensitive cookies to avoid false positives on analytics/UI cookies
      const vulnerableSessionCookies = facts.cookies.filter(
        (c) => c.isSuspectedSessionOrAuth && !c.isHttpOnly
      );

      const findings: SecurityFinding[] = [];
      const seenKeys = new Set<string>();

      for (const cookie of vulnerableSessionCookies) {
        const dedupeKey = `${cookie.cookieName}:${cookie.domain || ""}:${cookie.path || ""}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const findingId = generateFindingId("SEC_COOKIE_HTTPONLY_MISSING", "COOKIE", cookie.cookieName);
        findings.push({
          id: findingId,
          ruleId: "SEC_COOKIE_HTTPONLY_MISSING",
          category: "cookies",
          title: `Session Cookie "${cookie.cookieName}" Missing HttpOnly Flag`,
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Authentication/session cookie "${cookie.cookieName}" was set without the "HttpOnly" attribute. It is accessible via JavaScript document.cookie, enabling session hijacking in the event of an XSS vulnerability.`,
          evidence: {
            cookieName: cookie.cookieName,
            redactedValue: cookie.redactedValue,
            sourceUrl: cookie.sourceUrl,
          },
          affectedUrls: [cookie.sourceUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const sessionCookiesCount = facts.cookies.filter((c) => c.isSuspectedSessionOrAuth).length;
      return {
        status: vulnerableSessionCookies.length > 0 ? "FAIL" : sessionCookiesCount > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: sessionCookiesCount,
        passedTargets: sessionCookiesCount - vulnerableSessionCookies.length,
        failedTargets: vulnerableSessionCookies.length,
        notApplicableTargets: facts.cookies.length - sessionCookiesCount,
        evidenceSummary: vulnerableSessionCookies.length > 0 ? `HttpOnly missing on ${vulnerableSessionCookies.length} session cookie(s)` : "All identified session cookies declare HttpOnly",
      };
    },
  },
  {
    ruleId: "SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE",
    title: "SameSite=None Cookie Missing Secure Attribute",
    category: "cookies",
    description: "A cookie declares SameSite=None without the Secure attribute, which modern browsers reject.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-1275" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const invalidCookies = facts.cookies.filter((c) => c.isSameSiteNoneWithoutSecure);
      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const cookie of invalidCookies) {
        if (seen.has(cookie.cookieName)) continue;
        seen.add(cookie.cookieName);

        const findingId = generateFindingId("SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE", "COOKIE", cookie.cookieName);
        findings.push({
          id: findingId,
          ruleId: "SEC_COOKIE_SAMESITE_NONE_WITHOUT_SECURE",
          category: "cookies",
          title: `SameSite=None Cookie "${cookie.cookieName}" Missing Secure`,
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Cookie "${cookie.cookieName}" specifies SameSite=None without the Secure attribute. Modern browsers (Chrome, Firefox, Safari) strictly reject cookies with SameSite=None unless they are marked Secure.`,
          evidence: { cookieName: cookie.cookieName, sameSite: cookie.sameSite, isSecure: cookie.isSecure },
          affectedUrls: [cookie.sourceUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      return {
        status: invalidCookies.length > 0 ? "FAIL" : facts.cookies.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: facts.cookies.length,
        passedTargets: facts.cookies.length - invalidCookies.length,
        failedTargets: invalidCookies.length,
        notApplicableTargets: 0,
        evidenceSummary: invalidCookies.length > 0 ? `SameSite=None without Secure on ${invalidCookies.length} cookie(s)` : "SameSite=None cookies are properly secured",
      };
    },
  },
  {
    ruleId: "SEC_COOKIE_HOST_PREFIX_INVALID",
    title: "__Host- Cookie Prefix Specification Violation",
    category: "cookies",
    description: "A cookie using the __Host- prefix does not meet RFC requirements (must be Secure, Path=/, and have no Domain attribute).",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_HOST_PREFIX_INVALID.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_HOST_PREFIX_INVALID.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const invalidHostCookies = facts.cookies.filter((c) => c.hasHostPrefix && !c.isHostPrefixValid);
      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const cookie of invalidHostCookies) {
        if (seen.has(cookie.cookieName)) continue;
        seen.add(cookie.cookieName);

        const findingId = generateFindingId("SEC_COOKIE_HOST_PREFIX_INVALID", "COOKIE", cookie.cookieName);
        findings.push({
          id: findingId,
          ruleId: "SEC_COOKIE_HOST_PREFIX_INVALID",
          category: "cookies",
          title: `Invalid __Host- Cookie Prefix on "${cookie.cookieName}"`,
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Cookie "${cookie.cookieName}" uses the __Host- prefix but violates browser prefix rules: it must have Secure flag, Path=/, and must NOT contain a Domain attribute. Browsers will reject this cookie.`,
          evidence: { cookieName: cookie.cookieName, isSecure: cookie.isSecure, path: cookie.path, domain: cookie.domain },
          affectedUrls: [cookie.sourceUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const hostPrefixCookiesCount = facts.cookies.filter((c) => c.hasHostPrefix).length;
      return {
        status: invalidHostCookies.length > 0 ? "FAIL" : hostPrefixCookiesCount > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: hostPrefixCookiesCount,
        passedTargets: hostPrefixCookiesCount - invalidHostCookies.length,
        failedTargets: invalidHostCookies.length,
        notApplicableTargets: facts.cookies.length - hostPrefixCookiesCount,
        evidenceSummary: invalidHostCookies.length > 0 ? `Invalid __Host- prefix on ${invalidHostCookies.length} cookie(s)` : "All __Host- cookies comply with RFC specifications",
      };
    },
  },
  {
    ruleId: "SEC_COOKIE_SECURE_PREFIX_INVALID",
    title: "__Secure- Cookie Prefix Missing Secure Attribute",
    category: "cookies",
    description: "A cookie using the __Secure- prefix does not declare the Secure attribute.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SECURE_PREFIX_INVALID.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SECURE_PREFIX_INVALID.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const invalidSecurePrefix = facts.cookies.filter((c) => c.hasSecurePrefix && !c.isSecurePrefixValid);
      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const cookie of invalidSecurePrefix) {
        if (seen.has(cookie.cookieName)) continue;
        seen.add(cookie.cookieName);

        const findingId = generateFindingId("SEC_COOKIE_SECURE_PREFIX_INVALID", "COOKIE", cookie.cookieName);
        findings.push({
          id: findingId,
          ruleId: "SEC_COOKIE_SECURE_PREFIX_INVALID",
          category: "cookies",
          title: `__Secure- Cookie "${cookie.cookieName}" Missing Secure Flag`,
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Cookie "${cookie.cookieName}" uses the __Secure- prefix but is missing the Secure attribute. Browsers will reject this cookie.`,
          evidence: { cookieName: cookie.cookieName, isSecure: cookie.isSecure },
          affectedUrls: [cookie.sourceUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const securePrefixCount = facts.cookies.filter((c) => c.hasSecurePrefix).length;
      return {
        status: invalidSecurePrefix.length > 0 ? "FAIL" : securePrefixCount > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: securePrefixCount,
        passedTargets: securePrefixCount - invalidSecurePrefix.length,
        failedTargets: invalidSecurePrefix.length,
        notApplicableTargets: facts.cookies.length - securePrefixCount,
        evidenceSummary: invalidSecurePrefix.length > 0 ? `Invalid __Secure- prefix on ${invalidSecurePrefix.length} cookie(s)` : "All __Secure- cookies are valid",
      };
    },
  },
  {
    ruleId: "SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT",
    title: "Cookie Set Over Plaintext HTTP Transport",
    category: "cookies",
    description: "A cookie was set in a response delivered over unencrypted HTTP transport.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const plaintextCookies = facts.cookies.filter((c) => c.setOverInsecureTransport);
      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const cookie of plaintextCookies) {
        if (seen.has(cookie.cookieName)) continue;
        seen.add(cookie.cookieName);

        const findingId = generateFindingId("SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT", "COOKIE", cookie.cookieName);
        findings.push({
          id: findingId,
          ruleId: "SEC_COOKIE_SENT_OVER_INSECURE_TRANSPORT",
          category: "cookies",
          title: `Cookie "${cookie.cookieName}" Transmitted Over Insecure HTTP`,
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Cookie "${cookie.cookieName}" was set via unencrypted HTTP on ${cookie.sourceUrl}, exposing the cookie to passive network sniffing.`,
          evidence: { cookieName: cookie.cookieName, sourceUrl: cookie.sourceUrl },
          affectedUrls: [cookie.sourceUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      return {
        status: plaintextCookies.length > 0 ? "FAIL" : facts.cookies.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: facts.cookies.length,
        passedTargets: facts.cookies.length - plaintextCookies.length,
        failedTargets: plaintextCookies.length,
        notApplicableTargets: 0,
        evidenceSummary: plaintextCookies.length > 0 ? `${plaintextCookies.length} cookie(s) set over plaintext HTTP` : "All cookies set over encrypted HTTPS transport",
      };
    },
  },
];
