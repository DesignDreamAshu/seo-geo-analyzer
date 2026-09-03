/**
 * Frame Protection / Clickjacking Prevention Rules (SECURITY S2).
 * Jointly reasons across CSP frame-ancestors and X-Frame-Options to eliminate contradictory findings.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const frameProtectionRules: SecurityRule[] = [
  {
    ruleId: "SEC_FRAME_PROTECTION_MISSING",
    title: "Clickjacking Frame Protection Missing",
    category: "frame_protection",
    description: "The webpage lacks effective clickjacking defense (neither CSP frame-ancestors nor X-Frame-Options is configured).",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_FRAME_PROTECTION_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_FRAME_PROTECTION_MISSING.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cwe: "CWE-1021", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const htmlUrls = Object.values(facts.urlFacts).filter(
        (u) => u.contentType.toLowerCase().includes("text/html") || u.contentType === ""
      );

      const missingFrameProtectionUrls: string[] = [];

      for (const u of htmlUrls) {
        const secHeaders = facts.securityHeadersByUrl[u.requestedUrl];
        const cspEnforced = secHeaders?.cspEnforced || [];
        const hasCspFrameAncestors = cspEnforced.some((c) => c.hasFrameAncestors);
        const xfo = secHeaders?.xFrameOptions;
        const hasEffectiveXfo = xfo && (xfo.isDeny || xfo.isSameOrigin);

        // Effective protection exists if EITHER modern CSP frame-ancestors OR legacy X-Frame-Options is configured
        if (!hasCspFrameAncestors && !hasEffectiveXfo) {
          missingFrameProtectionUrls.push(u.requestedUrl);
        }
      }

      const findings: SecurityFinding[] = [];
      if (missingFrameProtectionUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_FRAME_PROTECTION_MISSING", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_FRAME_PROTECTION_MISSING",
          category: "frame_protection",
          title: "Clickjacking Frame Protection Missing",
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `No framing restriction was observed on ${missingFrameProtectionUrls.length} HTML page(s). Neither Content-Security-Policy frame-ancestors nor X-Frame-Options is set, allowing third-party websites to embed this site in an invisible iframe and execute clickjacking attacks.`,
          evidence: {
            host,
            affectedUrlCount: missingFrameProtectionUrls.length,
            sampleUrls: missingFrameProtectionUrls.slice(0, 5),
          },
          affectedUrls: missingFrameProtectionUrls,
          affectedOccurrences: missingFrameProtectionUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Configure "frame-ancestors 'self'" or "X-Frame-Options: SAMEORIGIN" in web server / CDN → protects ${missingFrameProtectionUrls.length} page(s)`,
        });
      }

      return {
        status: missingFrameProtectionUrls.length > 0 ? "FAIL" : htmlUrls.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: htmlUrls.length,
        passedTargets: htmlUrls.length - missingFrameProtectionUrls.length,
        failedTargets: missingFrameProtectionUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: missingFrameProtectionUrls.length > 0 ? `Frame protection missing on ${missingFrameProtectionUrls.length} page(s)` : "Frame protection configured (CSP frame-ancestors / X-Frame-Options)",
      };
    },
  },
];
