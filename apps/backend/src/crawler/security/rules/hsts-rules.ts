/**
 * Strict-Transport-Security (HSTS) Rules (SECURITY S2).
 * Evaluates HSTS presence, duration, subdomain coverage, and preload readiness.
 * Deduplicates host-level configuration into single high-efficiency findings.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

const MIN_RECOMMENDED_HSTS_SECONDS = 15552000; // 180 days

export const hstsRules: SecurityRule[] = [
  {
    ruleId: "SEC_HSTS_MISSING",
    title: "Strict-Transport-Security (HSTS) Header Missing",
    category: "hsts",
    description: "The HTTPS server does not return a Strict-Transport-Security header to enforce encrypted connections.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-319", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const httpsUrls = Object.values(facts.urlFacts).filter((u) => u.isHttps);
      if (httpsUrls.length === 0) {
        return {
          status: "NOT_APPLICABLE",
          findings: [],
          testedTargets: 0,
          passedTargets: 0,
          failedTargets: 0,
          notApplicableTargets: Object.keys(facts.urlFacts).length,
          evidenceSummary: "HSTS evaluation not applicable (target is not served over HTTPS)",
        };
      }

      // Group URLs by hostname to deduplicate findings
      const hostMap = new Map<string, string[]>();
      for (const u of httpsUrls) {
        const list = hostMap.get(u.hostname) || [];
        list.push(u.requestedUrl);
        hostMap.set(u.hostname, list);
      }

      const findings: SecurityFinding[] = [];
      let passedCount = 0;
      let failedCount = 0;

      for (const [hostname, urls] of hostMap.entries()) {
        const sampleUrl = urls[0];
        const hsts = facts.securityHeadersByUrl[sampleUrl]?.hsts;

        if (!hsts || hsts.maxAgeSeconds === null || hsts.isZeroMaxAge) {
          failedCount++;
          const findingId = generateFindingId("SEC_HSTS_MISSING", "HOST", hostname);
          findings.push({
            id: findingId,
            ruleId: "SEC_HSTS_MISSING",
            category: "hsts",
            title: "Strict-Transport-Security (HSTS) Missing",
            severity: "medium",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `Host ${hostname} does not return an enforced Strict-Transport-Security header. Browsers will not automatically upgrade insecure HTTP requests, leaving users vulnerable to SSL-stripping man-in-the-middle attacks.`,
            evidence: {
              hostname,
              affectedUrlCount: urls.length,
              sampleUrl,
              observedHeader: hsts?.rawHeader || null,
            },
            affectedUrls: urls,
            affectedOccurrences: urls.length,
            scope: "HOST",
            fixLevel: "SERVER",
            deduplicationKey: findingId,
            globalEfficiencyText: `Add HSTS header to web server / CDN on ${hostname} → protects all ${urls.length} URL(s) on this host`,
            standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-319" },
          });
        } else {
          passedCount++;
        }
      }

      return {
        status: failedCount > 0 ? "FAIL" : "PASS",
        findings,
        testedTargets: hostMap.size,
        passedTargets: passedCount,
        failedTargets: failedCount,
        notApplicableTargets: 0,
        evidenceSummary: failedCount > 0 ? `HSTS missing on ${failedCount} host(s)` : "HSTS header present and enforced on all hosts",
      };
    },
  },
  {
    ruleId: "SEC_HSTS_SHORT_MAX_AGE",
    title: "HSTS max-age Duration Too Short (< 180 Days)",
    category: "hsts",
    description: "The Strict-Transport-Security max-age directive is shorter than the recommended minimum duration (180 days / 15,552,000 seconds).",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_SHORT_MAX_AGE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_SHORT_MAX_AGE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const httpsUrls = Object.values(facts.urlFacts).filter((u) => u.isHttps);
      const hostMap = new Map<string, string[]>();
      for (const u of httpsUrls) {
        const list = hostMap.get(u.hostname) || [];
        list.push(u.requestedUrl);
        hostMap.set(u.hostname, list);
      }

      const findings: SecurityFinding[] = [];
      let shortCount = 0;
      let evaluatedCount = 0;

      for (const [hostname, urls] of hostMap.entries()) {
        const sampleUrl = urls[0];
        const hsts = facts.securityHeadersByUrl[sampleUrl]?.hsts;
        if (hsts && hsts.maxAgeSeconds !== null && !hsts.isZeroMaxAge) {
          evaluatedCount++;
          if (hsts.maxAgeSeconds < MIN_RECOMMENDED_HSTS_SECONDS) {
            shortCount++;
            const findingId = generateFindingId("SEC_HSTS_SHORT_MAX_AGE", "HOST", hostname);
            findings.push({
              id: findingId,
              ruleId: "SEC_HSTS_SHORT_MAX_AGE",
              category: "hsts",
              title: "HSTS max-age Duration Too Short",
              severity: "medium",
              confidence: "confirmed",
              verificationClassification: "confirmed",
              status: "WARNING",
              description: `HSTS max-age on ${hostname} is set to ${hsts.maxAgeSeconds}s (~${hsts.maxAgeDays} days), which is shorter than the recommended 180 days (15,552,000s).`,
              evidence: { hostname, observedMaxAgeSeconds: hsts.maxAgeSeconds, observedMaxAgeDays: hsts.maxAgeDays, rawHeader: hsts.rawHeader },
              affectedUrls: urls,
              affectedOccurrences: urls.length,
              scope: "HOST",
              fixLevel: "SERVER",
              deduplicationKey: findingId,
              globalEfficiencyText: `Increase max-age to >= 31536000 on ${hostname} → strengthens transport security for ${urls.length} URLs`,
            });
          }
        }
      }

      if (evaluatedCount === 0) {
        return {
          status: "NOT_APPLICABLE",
          findings: [],
          testedTargets: 0,
          passedTargets: 0,
          failedTargets: 0,
          notApplicableTargets: hostMap.size,
          evidenceSummary: "No hosts with active HSTS to evaluate duration",
        };
      }

      return {
        status: shortCount > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: evaluatedCount,
        passedTargets: evaluatedCount - shortCount,
        failedTargets: shortCount,
        notApplicableTargets: hostMap.size - evaluatedCount,
        evidenceSummary: shortCount > 0 ? `HSTS duration too short on ${shortCount} host(s)` : "HSTS max-age meets or exceeds 180 days",
      };
    },
  },
  {
    ruleId: "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING",
    title: "HSTS includeSubDomains Directive Missing",
    category: "hsts",
    description: "The HSTS header does not include the includeSubDomains directive, leaving subdomains unprotected.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const httpsUrls = Object.values(facts.urlFacts).filter((u) => u.isHttps);
      const hostMap = new Map<string, string[]>();
      for (const u of httpsUrls) {
        const list = hostMap.get(u.hostname) || [];
        list.push(u.requestedUrl);
        hostMap.set(u.hostname, list);
      }

      const findings: SecurityFinding[] = [];
      let missingSubdomainCount = 0;
      let evaluatedCount = 0;

      for (const [hostname, urls] of hostMap.entries()) {
        const sampleUrl = urls[0];
        const hsts = facts.securityHeadersByUrl[sampleUrl]?.hsts;
        if (hsts && hsts.maxAgeSeconds !== null && !hsts.isZeroMaxAge) {
          evaluatedCount++;
          if (!hsts.includeSubDomains) {
            missingSubdomainCount++;
            const findingId = generateFindingId("SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING", "HOST", hostname);
            findings.push({
              id: findingId,
              ruleId: "SEC_HSTS_INCLUDE_SUBDOMAINS_MISSING",
              category: "hsts",
              title: "HSTS includeSubDomains Directive Missing",
              severity: "low",
              confidence: "confirmed",
              verificationClassification: "confirmed",
              status: "WARNING",
              description: `HSTS policy on ${hostname} does not include the includeSubDomains directive. Insecure connections to subdomains will not be automatically protected.`,
              evidence: { hostname, rawHeader: hsts.rawHeader },
              affectedUrls: urls,
              affectedOccurrences: urls.length,
              scope: "HOST",
              fixLevel: "SERVER",
              deduplicationKey: findingId,
            });
          }
        }
      }

      if (evaluatedCount === 0) {
        return {
          status: "NOT_APPLICABLE",
          findings: [],
          testedTargets: 0,
          passedTargets: 0,
          failedTargets: 0,
          notApplicableTargets: hostMap.size,
          evidenceSummary: "No hosts with active HSTS to evaluate subdomains directive",
        };
      }

      return {
        status: missingSubdomainCount > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: evaluatedCount,
        passedTargets: evaluatedCount - missingSubdomainCount,
        failedTargets: missingSubdomainCount,
        notApplicableTargets: hostMap.size - evaluatedCount,
        evidenceSummary: missingSubdomainCount > 0 ? `includeSubDomains missing on ${missingSubdomainCount} host(s)` : "HSTS includes subdomains directive",
      };
    },
  },
  {
    ruleId: "SEC_HSTS_PRELOAD_NOT_ENABLED",
    title: "HSTS Preload Directive Not Enabled",
    category: "hsts",
    description: "The HSTS header does not contain the preload directive required for global browser HSTS preload list inclusion.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_PRELOAD_NOT_ENABLED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HSTS_PRELOAD_NOT_ENABLED.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const httpsUrls = Object.values(facts.urlFacts).filter((u) => u.isHttps);
      const hostMap = new Map<string, string[]>();
      for (const u of httpsUrls) {
        const list = hostMap.get(u.hostname) || [];
        list.push(u.requestedUrl);
        hostMap.set(u.hostname, list);
      }

      const findings: SecurityFinding[] = [];
      let noPreloadCount = 0;
      let evaluatedCount = 0;

      for (const [hostname, urls] of hostMap.entries()) {
        const sampleUrl = urls[0];
        const hsts = facts.securityHeadersByUrl[sampleUrl]?.hsts;
        if (hsts && hsts.maxAgeSeconds !== null && !hsts.isZeroMaxAge) {
          evaluatedCount++;
          if (!hsts.preload) {
            noPreloadCount++;
            const findingId = generateFindingId("SEC_HSTS_PRELOAD_NOT_ENABLED", "HOST", hostname);
            findings.push({
              id: findingId,
              ruleId: "SEC_HSTS_PRELOAD_NOT_ENABLED",
              category: "hsts",
              title: "HSTS Preload Directive Not Enabled",
              severity: "informational",
              confidence: "confirmed",
              verificationClassification: "confirmed",
              status: "OBSERVED",
              description: `HSTS on ${hostname} does not declare the "preload" directive. Adding preload makes the domain eligible for the Chrome/Firefox/Safari hardcoded HSTS list (hstspreload.org).`,
              evidence: { hostname, rawHeader: hsts.rawHeader },
              affectedUrls: urls,
              affectedOccurrences: urls.length,
              scope: "HOST",
              fixLevel: "SERVER",
              deduplicationKey: findingId,
            });
          }
        }
      }

      if (evaluatedCount === 0) {
        return {
          status: "NOT_APPLICABLE",
          findings: [],
          testedTargets: 0,
          passedTargets: 0,
          failedTargets: 0,
          notApplicableTargets: hostMap.size,
          evidenceSummary: "No hosts with active HSTS to evaluate preload directive",
        };
      }

      return {
        status: noPreloadCount > 0 ? "OBSERVED" : "PASS",
        findings,
        testedTargets: evaluatedCount,
        passedTargets: evaluatedCount - noPreloadCount,
        failedTargets: noPreloadCount,
        notApplicableTargets: hostMap.size - evaluatedCount,
        evidenceSummary: noPreloadCount > 0 ? `HSTS preload not enabled on ${noPreloadCount} host(s)` : "HSTS preload directive is enabled",
      };
    },
  },
];
