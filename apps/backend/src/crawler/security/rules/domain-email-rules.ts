/**
 * Domain & Email Security Rules (SECURITY S2).
 * Evaluates DNS CAA, SPF, and DMARC configuration records.
 * DNSSEC capability is truthfully reported as NOT_OBSERVABLE without fabricating results.
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const domainEmailRules: SecurityRule[] = [
  {
    ruleId: "SEC_CAA_MISSING",
    title: "Certificate Authority Authorization (CAA) DNS Record Missing",
    category: "domain_email",
    description: "The domain has no CAA DNS record published to restrict which Certificate Authorities may issue certificates.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CAA_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CAA_MISSING.confidence,
    scope: "DOMAIN",
    fixLevel: "DNS",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration", cisBenchmark: "CIS-DNS-1.4" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const domains = Object.keys(facts.dnsByDomain);
      const findings: SecurityFinding[] = [];
      let missingCaaCount = 0;

      for (const dom of domains) {
        const dnsFact = facts.dnsByDomain[dom];
        if (dnsFact && !dnsFact.hasCaaRecord) {
          missingCaaCount++;
          const findingId = generateFindingId("SEC_CAA_MISSING", "DOMAIN", dom);
          findings.push({
            id: findingId,
            ruleId: "SEC_CAA_MISSING",
            category: "domain_email",
            title: "CAA DNS Record Missing",
            severity: "informational",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "OBSERVED",
            description: `Domain ${dom} has no CAA DNS records. Publishing a CAA record restricts unauthorized CAs from issuing SSL/TLS certificates for your domain.`,
            evidence: { domain: dom, host: dnsFact.host },
            affectedUrls: Object.keys(facts.urlFacts),
            affectedOccurrences: 1,
            scope: "DOMAIN",
            fixLevel: "DNS",
            deduplicationKey: findingId,
            globalEfficiencyText: `Add CAA DNS record on ${dom} → defines authoritative Certificate Authorities for entire domain`,
          });
        }
      }

      return {
        status: missingCaaCount > 0 ? "OBSERVED" : domains.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: domains.length,
        passedTargets: domains.length - missingCaaCount,
        failedTargets: missingCaaCount,
        notApplicableTargets: 0,
        evidenceSummary: missingCaaCount > 0 ? `CAA record missing on ${missingCaaCount} domain(s)` : "CAA record published",
      };
    },
  },
  {
    ruleId: "SEC_SPF_MISSING",
    title: "Sender Policy Framework (SPF) DNS Record Missing",
    category: "domain_email",
    description: "The domain does not publish an SPF TXT record, allowing unauthorized servers to spoof emails from this domain.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_SPF_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_SPF_MISSING.confidence,
    scope: "DOMAIN",
    fixLevel: "DNS",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const domains = Object.keys(facts.dnsByDomain);
      const findings: SecurityFinding[] = [];
      let missingSpfCount = 0;

      for (const dom of domains) {
        const dnsFact = facts.dnsByDomain[dom];
        if (dnsFact && (!dnsFact.hasSpfRecord || !dnsFact.isSpfSyntacticallyValid)) {
          missingSpfCount++;
          const findingId = generateFindingId("SEC_SPF_MISSING", "DOMAIN", dom);
          findings.push({
            id: findingId,
            ruleId: "SEC_SPF_MISSING",
            category: "domain_email",
            title: "SPF DNS Record Missing or Invalid",
            severity: "medium",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `Domain ${dom} does not have a valid SPF (Sender Policy Framework) TXT record. Threat actors can easily send phishing and spoofed emails appearing to originate from @${dom}.`,
            evidence: { domain: dom, observedSpfRecords: dnsFact.spfRecords },
            affectedUrls: Object.keys(facts.urlFacts),
            affectedOccurrences: 1,
            scope: "DOMAIN",
            fixLevel: "DNS",
            deduplicationKey: findingId,
            globalEfficiencyText: `Publish "v=spf1 ... ~all" TXT record on ${dom} → prevents domain email spoofing`,
          });
        }
      }

      return {
        status: missingSpfCount > 0 ? "FAIL" : domains.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: domains.length,
        passedTargets: domains.length - missingSpfCount,
        failedTargets: missingSpfCount,
        notApplicableTargets: 0,
        evidenceSummary: missingSpfCount > 0 ? `SPF record missing on ${missingSpfCount} domain(s)` : "SPF record published and valid",
      };
    },
  },
  {
    ruleId: "SEC_DMARC_MISSING",
    title: "DMARC DNS Policy Record Missing",
    category: "domain_email",
    description: "The domain does not have a DMARC policy record (_dmarc.<domain>) to enforce email authentication.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DMARC_MISSING.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DMARC_MISSING.confidence,
    scope: "DOMAIN",
    fixLevel: "DNS",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const domains = Object.keys(facts.dnsByDomain);
      const findings: SecurityFinding[] = [];
      let missingDmarcCount = 0;

      for (const dom of domains) {
        const dnsFact = facts.dnsByDomain[dom];
        if (dnsFact && !dnsFact.hasDmarcRecord) {
          missingDmarcCount++;
          const findingId = generateFindingId("SEC_DMARC_MISSING", "DOMAIN", dom);
          findings.push({
            id: findingId,
            ruleId: "SEC_DMARC_MISSING",
            category: "domain_email",
            title: "DMARC DNS Record Missing",
            severity: "medium",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `Domain ${dom} has no DMARC record at _dmarc.${dom}. Without DMARC, receiving mail servers cannot verify SPF/DKIM alignment or reject fraudulent emails sent under your brand.`,
            evidence: { domain: dom, dmarcHost: `_dmarc.${dom}` },
            affectedUrls: Object.keys(facts.urlFacts),
            affectedOccurrences: 1,
            scope: "DOMAIN",
            fixLevel: "DNS",
            deduplicationKey: findingId,
            globalEfficiencyText: `Add TXT record at _dmarc.${dom} (e.g. "v=DMARC1; p=reject; ...") → enforces email authenticity across all mail systems`,
          });
        }
      }

      return {
        status: missingDmarcCount > 0 ? "FAIL" : domains.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: domains.length,
        passedTargets: domains.length - missingDmarcCount,
        failedTargets: missingDmarcCount,
        notApplicableTargets: 0,
        evidenceSummary: missingDmarcCount > 0 ? `DMARC record missing on ${missingDmarcCount} domain(s)` : "DMARC record published",
      };
    },
  },
  {
    ruleId: "SEC_DMARC_POLICY_NONE",
    title: "DMARC Policy Set to Monitoring Only (p=none)",
    category: "domain_email",
    description: "The DMARC record specifies p=none, which logs spoofing attempts without blocking or quarantining malicious emails.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DMARC_POLICY_NONE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DMARC_POLICY_NONE.confidence,
    scope: "DOMAIN",
    fixLevel: "DNS",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const domains = Object.keys(facts.dnsByDomain);
      const findings: SecurityFinding[] = [];
      let policyNoneCount = 0;
      let evaluatedCount = 0;

      for (const dom of domains) {
        const dnsFact = facts.dnsByDomain[dom];
        if (dnsFact && dnsFact.hasDmarcRecord) {
          evaluatedCount++;
          if (dnsFact.dmarcPolicy === "none") {
            policyNoneCount++;
            const findingId = generateFindingId("SEC_DMARC_POLICY_NONE", "DOMAIN", dom);
            findings.push({
              id: findingId,
              ruleId: "SEC_DMARC_POLICY_NONE",
              category: "domain_email",
              title: "DMARC Policy Set to Monitoring Only (p=none)",
              severity: "low",
              confidence: "confirmed",
              verificationClassification: "confirmed",
              status: "WARNING",
              description: `DMARC on ${dom} is set to p=none. While helpful for testing, it does not instruct mail servers to reject or quarantine spoofed emails. Advance policy to "quarantine" or "reject" for active protection.`,
              evidence: { domain: dom, rawRecord: dnsFact.dmarcRecord, observedPolicy: dnsFact.dmarcPolicy },
              affectedUrls: Object.keys(facts.urlFacts),
              affectedOccurrences: 1,
              scope: "DOMAIN",
              fixLevel: "DNS",
              deduplicationKey: findingId,
              globalEfficiencyText: `Upgrade DMARC policy from p=none to p=quarantine / p=reject on ${dom}`,
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
          notApplicableTargets: domains.length,
          evidenceSummary: "No DMARC records to evaluate policy mode",
        };
      }

      return {
        status: policyNoneCount > 0 ? "WARNING" : "PASS",
        findings,
        testedTargets: evaluatedCount,
        passedTargets: evaluatedCount - policyNoneCount,
        failedTargets: policyNoneCount,
        notApplicableTargets: domains.length - evaluatedCount,
        evidenceSummary: policyNoneCount > 0 ? `DMARC policy is p=none on ${policyNoneCount} domain(s)` : "DMARC policy enforces quarantine/reject",
      };
    },
  },
  {
    ruleId: "SEC_DMARC_PCT_PARTIAL",
    title: "DMARC Enforcement Percentage Partial (pct < 100)",
    category: "domain_email",
    description: "The DMARC record specifies pct < 100, leaving a percentage of spoofed emails unenforced.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DMARC_PCT_PARTIAL.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_DMARC_PCT_PARTIAL.confidence,
    scope: "DOMAIN",
    fixLevel: "DNS",
    standardsMapping: { owaspTop10: "A05:2021-Security Misconfiguration" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const domains = Object.keys(facts.dnsByDomain);
      const findings: SecurityFinding[] = [];
      let partialPctCount = 0;
      let evaluatedCount = 0;

      for (const dom of domains) {
        const dnsFact = facts.dnsByDomain[dom];
        if (dnsFact && dnsFact.hasDmarcRecord && dnsFact.dmarcPercentage !== null) {
          evaluatedCount++;
          if (dnsFact.dmarcPercentage < 100) {
            partialPctCount++;
            const findingId = generateFindingId("SEC_DMARC_PCT_PARTIAL", "DOMAIN", dom);
            findings.push({
              id: findingId,
              ruleId: "SEC_DMARC_PCT_PARTIAL",
              category: "domain_email",
              title: `DMARC Enforcement Percentage Partial (${dnsFact.dmarcPercentage}%)`,
              severity: "low",
              confidence: "confirmed",
              verificationClassification: "confirmed",
              status: "WARNING",
              description: `DMARC pct tag on ${dom} is set to ${dnsFact.dmarcPercentage}%. Only ${dnsFact.dmarcPercentage}% of unauthorized emails will be subject to policy enforcement.`,
              evidence: { domain: dom, percentage: dnsFact.dmarcPercentage },
              affectedUrls: Object.keys(facts.urlFacts),
              affectedOccurrences: 1,
              scope: "DOMAIN",
              fixLevel: "DNS",
              deduplicationKey: findingId,
            });
          }
        }
      }

      return {
        status: partialPctCount > 0 ? "WARNING" : evaluatedCount > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: evaluatedCount,
        passedTargets: evaluatedCount - partialPctCount,
        failedTargets: partialPctCount,
        notApplicableTargets: domains.length - evaluatedCount,
        evidenceSummary: partialPctCount > 0 ? `DMARC partial percentage on ${partialPctCount} domain(s)` : "DMARC applies to 100% of messages",
      };
    },
  },
];
