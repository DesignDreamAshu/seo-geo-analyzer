/**
 * Third-Party & Subresource Integrity (SRI) Rules (SECURITY S2).
 * Evaluates external script/style transport encryption and Subresource Integrity attributes.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const thirdPartyRules: SecurityRule[] = [
  {
    ruleId: "SEC_THIRD_PARTY_HTTP_SCRIPT",
    title: "Third-Party JavaScript Loaded Over Plaintext HTTP",
    category: "third_party",
    description: "An external script from a third-party domain is loaded over unencrypted HTTP transport.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_THIRD_PARTY_HTTP_SCRIPT.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_THIRD_PARTY_HTTP_SCRIPT.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const insecureScripts = facts.resources.filter(
        (r) => r.isThirdParty && r.resourceType === "script" && r.resolvedAbsoluteUrl.startsWith("http://")
      );

      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const res of insecureScripts) {
        const key = `${res.sourcePageUrl}:${res.resolvedAbsoluteUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const findingId = generateFindingId("SEC_THIRD_PARTY_HTTP_SCRIPT", "PAGE", res.sourcePageUrl, res.resolvedAbsoluteUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_THIRD_PARTY_HTTP_SCRIPT",
          category: "third_party",
          title: "Third-Party Script Loaded Over Insecure HTTP",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Third-party script ${res.resolvedAbsoluteUrl} is loaded over unencrypted HTTP on ${res.sourcePageUrl}. Attackers can modify the script in transit to execute malicious code in visitors' browsers.`,
          evidence: {
            sourcePageUrl: res.sourcePageUrl,
            resourceUrl: res.resolvedAbsoluteUrl,
            origin: res.resourceOrigin,
          },
          affectedUrls: [res.sourcePageUrl],
          affectedResources: [res.resolvedAbsoluteUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalThirdPartyScripts = facts.resources.filter(
        (r) => r.isThirdParty && r.resourceType === "script"
      ).length;

      return {
        status: insecureScripts.length > 0 ? "FAIL" : totalThirdPartyScripts > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalThirdPartyScripts,
        passedTargets: totalThirdPartyScripts - insecureScripts.length,
        failedTargets: insecureScripts.length,
        notApplicableTargets: 0,
        evidenceSummary: insecureScripts.length > 0 ? `${insecureScripts.length} third-party script(s) loaded over plaintext HTTP` : "All third-party scripts loaded over HTTPS",
      };
    },
  },
  {
    ruleId: "SEC_THIRD_PARTY_HTTP_STYLESHEET",
    title: "Third-Party Stylesheet Loaded Over Plaintext HTTP",
    category: "third_party",
    description: "An external CSS stylesheet from a third-party origin is loaded over unencrypted HTTP transport.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_THIRD_PARTY_HTTP_STYLESHEET.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_THIRD_PARTY_HTTP_STYLESHEET.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const insecureStyles = facts.resources.filter(
        (r) => r.isThirdParty && r.resourceType === "stylesheet" && r.resolvedAbsoluteUrl.startsWith("http://")
      );

      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const res of insecureStyles) {
        const key = `${res.sourcePageUrl}:${res.resolvedAbsoluteUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const findingId = generateFindingId("SEC_THIRD_PARTY_HTTP_STYLESHEET", "PAGE", res.sourcePageUrl, res.resolvedAbsoluteUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_THIRD_PARTY_HTTP_STYLESHEET",
          category: "third_party",
          title: "Third-Party Stylesheet Loaded Over Insecure HTTP",
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `Third-party stylesheet ${res.resolvedAbsoluteUrl} is loaded over unencrypted HTTP on ${res.sourcePageUrl}.`,
          evidence: {
            sourcePageUrl: res.sourcePageUrl,
            resourceUrl: res.resolvedAbsoluteUrl,
            origin: res.resourceOrigin,
          },
          affectedUrls: [res.sourcePageUrl],
          affectedResources: [res.resolvedAbsoluteUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalThirdPartyStyles = facts.resources.filter(
        (r) => r.isThirdParty && r.resourceType === "stylesheet"
      ).length;

      return {
        status: insecureStyles.length > 0 ? "FAIL" : totalThirdPartyStyles > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalThirdPartyStyles,
        passedTargets: totalThirdPartyStyles - insecureStyles.length,
        failedTargets: insecureStyles.length,
        notApplicableTargets: 0,
        evidenceSummary: insecureStyles.length > 0 ? `${insecureStyles.length} third-party stylesheet(s) loaded over HTTP` : "All third-party stylesheets loaded over HTTPS",
      };
    },
  },
  {
    ruleId: "SEC_THIRD_PARTY_SRI_MISSING",
    title: "Subresource Integrity (SRI) Hash Missing on Third-Party Resource",
    category: "third_party",
    description: "External third-party scripts or stylesheets are loaded without an integrity hash attribute.",
    verificationClassification: "heuristic",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_THIRD_PARTY_SRI_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_THIRD_PARTY_SRI_MISSING.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A08:2021-Software and Data Integrity Failures", cwe: "CWE-353", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const cdnResources = facts.resources.filter(
        (r) =>
          r.isThirdParty &&
          (r.resourceType === "script" || r.resourceType === "stylesheet") &&
          !r.hasIntegrity &&
          (r.resourceOrigin.includes("cdn") || r.resourceOrigin.includes("cdnjs") || r.resourceOrigin.includes("unpkg") || r.resourceOrigin.includes("jsdelivr"))
      );

      const findings: SecurityFinding[] = [];
      const seen = new Set<string>();

      for (const res of cdnResources) {
        if (seen.has(res.resolvedAbsoluteUrl)) continue;
        seen.add(res.resolvedAbsoluteUrl);

        const findingId = generateFindingId("SEC_THIRD_PARTY_SRI_MISSING", "RESOURCE", res.resolvedAbsoluteUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_THIRD_PARTY_SRI_MISSING",
          category: "third_party",
          title: "Subresource Integrity (SRI) Missing on CDN Asset",
          severity: "informational",
          confidence: "medium",
          verificationClassification: "heuristic",
          status: "OBSERVED",
          description: `External CDN asset ${res.resolvedAbsoluteUrl} is loaded without an integrity (SRI sha256/384/512) attribute. Adding SRI ensures browsers reject the asset if the CDN is compromised or altered.`,
          evidence: {
            resourceUrl: res.resolvedAbsoluteUrl,
            resourceType: res.resourceType,
            origin: res.resourceOrigin,
            sourcePageUrl: res.sourcePageUrl,
          },
          affectedUrls: [res.sourcePageUrl],
          affectedResources: [res.resolvedAbsoluteUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalCdn = facts.resources.filter(
        (r) => r.isThirdParty && (r.resourceType === "script" || r.resourceType === "stylesheet")
      ).length;

      return {
        status: cdnResources.length > 0 ? "OBSERVED" : totalCdn > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalCdn,
        passedTargets: totalCdn - cdnResources.length,
        failedTargets: cdnResources.length,
        notApplicableTargets: 0,
        evidenceSummary: cdnResources.length > 0 ? `SRI hash omitted on ${cdnResources.length} third-party CDN asset(s)` : "SRI attributes present or no external CDN assets",
      };
    },
  },
];
