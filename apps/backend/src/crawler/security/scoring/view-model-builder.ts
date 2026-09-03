/**
 * Security Audit View-Model Builder (SECURITY S5).
 * Prepares the complete, authoritative, self-contained view-model contract for the Security UI.
 */

import type { SecurityEvaluationResult, SecurityFinding, SecurityRuleCategory } from "../rule-types";
import type { SecurityAuditFacts } from "../types";
import { generateSecurityRemediation } from "../remediation/remediation-generator";
import { buildSecurityImplementationMap } from "../remediation/implementation-map";
import { calculateSecurityScore } from "./score-engine";
import type {
  SecurityAuditViewModel,
  SecurityCategoryHealth,
  SecurityTopRisk,
  SecurityQuickWin,
  SecurityPageSummary,
  SecurityPosture,
  SecurityCategoryPosture,
  SecurityCapabilityDetail,
  SanitizedSecurityTxtFact,
} from "./score-types";

const CATEGORY_DISPLAY_NAMES: Record<SecurityRuleCategory, string> = {
  transport: "Transport & HTTPS",
  hsts: "HSTS Transport Security",
  csp: "Content Security Policy",
  frame_protection: "Clickjacking & Framing",
  headers: "Browser Security Headers",
  cookies: "Cookies & Session Security",
  cors: "Cross-Origin Sharing (CORS)",
  information_disclosure: "Technology Disclosure",
  sensitive_files: "Sensitive Files & Probes",
  forms: "Forms & Input Security",
  third_party: "Third-Party & SRI",
  domain_email: "DNS & Email Authentication",
  manual_coverage: "Manual Penetration Testing",
};

/**
 * Builds the complete SecurityAuditViewModel from facts and evaluation results.
 */
export function buildSecurityAuditViewModel(
  facts: SecurityAuditFacts,
  evaluation: SecurityEvaluationResult
): SecurityAuditViewModel {
  // 1. Calculate Score & Posture
  const scoreBreakdown = calculateSecurityScore(evaluation, facts);

  // 2. Enrich Findings with Full Remediation
  const enrichedFindings = evaluation.findings.map(f => ({
    ...f,
    remediation: generateSecurityRemediation(f, facts),
  }));

  // 3. Build Implementation Map
  const implementationMap = buildSecurityImplementationMap(
    evaluation.findings,
    enrichedFindings.map(f => f.remediation)
  );

  // 4. Calculate Category Health
  const categoryHealth: SecurityCategoryHealth[] = [];
  const categories = Object.keys(CATEGORY_DISPLAY_NAMES) as SecurityRuleCategory[];

  for (const cat of categories) {
    const rulesInCat = evaluation.coverage.filter(c => c.category === cat);
    const passedCount = rulesInCat.filter(c => c.status === "PASS").length;
    const failedCount = rulesInCat.filter(c => c.status === "FAIL").length;
    const warningCount = rulesInCat.filter(c => c.status === "WARNING").length;
    const observedCount = rulesInCat.filter(c => c.status === "OBSERVED").length;
    const notApplicableCount = rulesInCat.filter(c => c.status === "NOT_APPLICABLE").length;
    const notObservableCount = rulesInCat.filter(c => c.status === "NOT_OBSERVABLE").length;
    const manualCount = rulesInCat.filter(c => c.status === "REQUIRES_MANUAL_VERIFICATION").length;
    const deduction = scoreBreakdown.deductionsByCategory[cat] || 0;

    let catPosture: SecurityCategoryPosture = "Strong";
    let summaryExplanation = "";

    if (cat === "manual_coverage" || (manualCount === rulesInCat.length && rulesInCat.length > 0)) {
      catPosture = "Manual Assessment";
      summaryExplanation = `${manualCount} manual verification procedures (requires specialized pentest).`;
    } else if (failedCount > 0 && deduction >= 10) {
      catPosture = "Weak";
      summaryExplanation = `${failedCount} failing security control(s) detected (-${deduction} pts).`;
    } else if (failedCount > 0 || warningCount > 1) {
      catPosture = "Moderate";
      summaryExplanation = `${failedCount} finding(s) / ${warningCount} warning(s) detected.`;
    } else if (passedCount > 0 && failedCount === 0) {
      catPosture = passedCount === rulesInCat.length ? "Excellent" : "Strong";
      summaryExplanation = `${passedCount} automated checks verified with 0 findings.`;
    } else if (passedCount === 0 && failedCount === 0) {
      if (notApplicableCount === rulesInCat.length && rulesInCat.length > 0) {
        catPosture = "Not Applicable";
        summaryExplanation = `All ${notApplicableCount} rules N/A (features/inputs not detected on target).`;
      } else if (notObservableCount === rulesInCat.length && rulesInCat.length > 0) {
        catPosture = "Not Observable";
        summaryExplanation = `All ${notObservableCount} rules require internal server/hosting telemetry.`;
      } else if (notObservableCount + notApplicableCount === rulesInCat.length && rulesInCat.length > 0) {
        catPosture = notApplicableCount >= notObservableCount ? "Not Applicable" : "Not Observable";
        summaryExplanation = `${notApplicableCount} N/A, ${notObservableCount} unobserved; 0 findings.`;
      } else {
        catPosture = "No Findings";
        summaryExplanation = `0 security findings detected across ${rulesInCat.length} checks.`;
      }
    }

    categoryHealth.push({
      category: cat,
      categoryName: CATEGORY_DISPLAY_NAMES[cat],
      posture: catPosture,
      totalRules: rulesInCat.length,
      passedCount,
      failedCount,
      warningCount,
      observedCount,
      notApplicableCount,
      notObservableCount,
      manualCount,
      scoreDeduction: deduction,
      summaryExplanation,
    });
  }

  // 5. Prioritize Top Risks
  const topRisks: SecurityTopRisk[] = [];
  const actionableFindings = enrichedFindings.filter(
    f => f.severity !== "informational" && f.status !== "OBSERVED" && f.category !== "manual_coverage"
  );

  // Sort by severity (critical > high > medium > low), then occurrences
  const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortedRisks = [...actionableFindings].sort((a, b) => {
    const diff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (diff !== 0) return diff;
    return (b.affectedOccurrences || 1) - (a.affectedOccurrences || 1);
  });

  for (const f of sortedRisks.slice(0, 5)) {
    topRisks.push({
      findingId: f.id,
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity as "critical" | "high" | "medium",
      category: f.category,
      affectedOccurrences: f.affectedOccurrences || 1,
      summary: f.remediation.simpleExplanation || f.description,
      leverageText: f.remediation.globalEfficiency.isGlobalFix
        ? `1 global fix resolves ${f.affectedUrls?.length || 1} URL(s)`
        : `${f.affectedOccurrences || 1} occurrence(s) on target page`,
    });
  }

  // 6. Identify Quick Wins (Easy/Moderate effort + High impact)
  const quickWins: SecurityQuickWin[] = [];
  for (const f of enrichedFindings) {
    if (
      (f.remediation.difficulty === "EASY" || f.remediation.difficulty === "MODERATE") &&
      (f.remediation.estimatedEffortClass === "MINUTES" || f.remediation.estimatedEffortClass === "UNDER_1_HOUR") &&
      f.severity !== "informational" &&
      f.status !== "OBSERVED"
    ) {
      const deductionObj = scoreBreakdown.deductions.find(d => d.findingId === f.id);
      quickWins.push({
        findingId: f.id,
        ruleId: f.ruleId,
        title: f.title,
        difficulty: f.remediation.difficulty,
        estimatedEffortClass: f.remediation.estimatedEffortClass,
        summary: f.remediation.simpleExplanation,
        implementationHint: f.remediation.exactRecommendedChange,
        scoreImpact: deductionObj?.finalDeduction || 2,
      });
      if (quickWins.length >= 4) break;
    }
  }

  // 7. Per-Page Explorer Aggregation
  const pages: SecurityPageSummary[] = [];
  const hostFindings = evaluation.findings.filter(f => f.scope === "HOST" || f.scope === "DOMAIN" || f.scope === "SITE");
  const urlKeys = Object.keys(facts.urlFacts);

  for (const url of urlKeys) {
    const uFact = facts.urlFacts[url];
    const pageSpecificFindings = evaluation.findings.filter(
      f => f.scope !== "HOST" && f.scope !== "DOMAIN" && f.scope !== "SITE" && f.affectedUrls?.includes(url)
    );
    const mixedForPage = facts.mixedContentOccurrences.filter(m => m.sourcePageUrl === url);
    const formsForPage = facts.forms.filter(fm => fm.sourcePageUrl === url);
    const resourcesForPage = facts.resources.filter(r => r.sourcePageUrl === url && r.isThirdParty);

    pages.push({
      url,
      httpStatus: uFact.httpStatus,
      protocol: uFact.protocol,
      isHttps: uFact.isHttps,
      pageFindings: pageSpecificFindings,
      inheritedHostFindings: hostFindings,
      passedControlsCount: evaluation.coverage.filter(c => c.status === "PASS").length,
      mixedContentCount: mixedForPage.length,
      formsCount: formsForPage.length,
      thirdPartyResourcesCount: resourcesForPage.length,
    });
  }

  // 8. Third-Party Summary
  const origins = facts.thirdPartyInventory.thirdPartyOrigins || [];
  const totalSriApplicable = origins.reduce((sum, o) => sum + (o.sriCoverage?.totalApplicableResources || 0), 0);
  const totalSriWith = origins.reduce((sum, o) => sum + (o.sriCoverage?.resourcesWithSri || 0), 0);
  const sriCoveragePercent = totalSriApplicable > 0 ? Math.round((totalSriWith / totalSriApplicable) * 100) : 100;

  const thirdParties = {
    totalThirdPartyOrigins: facts.thirdPartyInventory.thirdPartyOriginsCount,
    totalThirdPartyResources: facts.thirdPartyInventory.totalThirdPartyResources,
    sriCoveragePercent,
    origins,
  };

  // 9. Stats Summary
  const stats = {
    totalRulesRegistered: 64,
    testsExecuted: evaluation.coverage.filter(c => c.status !== "NOT_OBSERVABLE" && c.status !== "REQUIRES_MANUAL_VERIFICATION").length,
    passedControls: evaluation.coverage.filter(c => c.status === "PASS").length,
    criticalFindings: evaluation.findings.filter(f => f.severity === "critical").length,
    highFindings: evaluation.findings.filter(f => f.severity === "high").length,
    mediumFindings: evaluation.findings.filter(f => f.severity === "medium").length,
    lowFindings: evaluation.findings.filter(f => f.severity === "low").length,
    informationalObservations: evaluation.findings.filter(f => f.severity === "informational" || f.status === "OBSERVED").length,
    manualAreasCount: 10,
    totalAffectedUrls: Array.from(new Set(evaluation.findings.flatMap(f => f.affectedUrls || []))).length,
  };

  // 10. Capabilities & Limitations (S6 / S6.1)
  const rawCaps = facts.capabilities || ({} as any);
  const capabilities: Record<string, SecurityCapabilityDetail> = {
    tlsCertificateInspection: {
      status: rawCaps.tlsCertificateInspection || "AVAILABLE",
      explanation: rawCaps.tlsCertificateInspection === "AVAILABLE" ? "Passive TLS certificate chain & SAN verification available." : "TLS certificate network probe skipped.",
      category: "Transport & Encryption",
    },
    tlsNegotiatedCipher: {
      status: rawCaps.tlsNegotiatedCipher || "AVAILABLE",
      explanation: rawCaps.tlsNegotiatedCipher === "AVAILABLE" ? "Observed negotiated TLS cipher suite recorded." : "Negotiated cipher probe not available.",
      category: "Transport & Encryption",
    },
    deprecatedTlsProtocolProbing: {
      status: (rawCaps.tlsDeprecatedProtocolProbing || "NOT_AVAILABLE") as any,
      explanation: "Passive posture audit does not execute deprecated multi-protocol SSLv2/SSLv3/TLS 1.0 handshake probes.",
      category: "Transport & Encryption",
    },
    securityHeaderAnalysis: {
      status: rawCaps.securityHeaderAnalysis || "AVAILABLE",
      explanation: "HTTP response headers parsed for security baseline directives.",
      category: "Security Headers",
    },
    cspDirectiveParsing: {
      status: rawCaps.cspDirectiveParsing || "AVAILABLE",
      explanation: "Content-Security-Policy AST grammar directive parser enabled.",
      category: "Security Headers",
    },
    hstsDirectiveParsing: {
      status: rawCaps.hstsDirectiveParsing || "AVAILABLE",
      explanation: "Strict-Transport-Security parser with max-age, includeSubDomains, and preload verification.",
      category: "Security Headers",
    },
    cookieAttributeInspection: {
      status: rawCaps.cookieAttributeInspection || "AVAILABLE",
      explanation: "Set-Cookie flags (Secure, HttpOnly, SameSite, __Host- prefix) inspected.",
      category: "Cookies & Session Security",
    },
    mixedContentDetection: {
      status: rawCaps.mixedContentDetection || "AVAILABLE",
      explanation: "DOM resource elements and inline assets evaluated for insecure HTTP origins.",
      category: "Transport & Encryption",
    },
    formTransportInspection: {
      status: rawCaps.formTransportInspection || "AVAILABLE",
      explanation: "Form action targets, HTTP transport, and password input methods audited.",
      category: "Forms & Input Security",
    },
    thirdPartyOriginInventory: {
      status: rawCaps.thirdPartyOriginInventory || "AVAILABLE",
      explanation: "External asset origins inventoried and categorized.",
      category: "Third-Party & Resource Integrity",
    },
    subresourceIntegrityObservation: {
      status: rawCaps.subresourceIntegrityObservation || "AVAILABLE",
      explanation: "Subresource Integrity (SRI) integrity hashes evaluated across third-party scripts/stylesheets.",
      category: "Third-Party & Resource Integrity",
    },
    dnsCaaInspection: {
      status: rawCaps.dnsCaaInspection || "AVAILABLE",
      explanation: rawCaps.dnsCaaInspection === "AVAILABLE" ? "DNS CAA (Certification Authority Authorization) record inspection active." : "DNS network query skipped.",
      category: "Domain & DNS Hygiene",
    },
    dnsSpfDmarcInspection: {
      status: rawCaps.dnsSpfDmarcInspection || "AVAILABLE",
      explanation: rawCaps.dnsSpfDmarcInspection === "AVAILABLE" ? "DNS SPF/DMARC authentication records parsed." : "DNS network query skipped.",
      category: "Domain & DNS Hygiene",
    },
    dnssecValidation: {
      status: (rawCaps.dnssecValidation || "NOT_OBSERVABLE") as any,
      explanation: "Standard non-validating DNS resolver lacks DNSSEC DO-flag cryptographic trust chain telemetry.",
      category: "Domain & DNS Hygiene",
    },
    safeSensitiveFileProbing: {
      status: rawCaps.safeSensitiveFileProbing || "AVAILABLE",
      explanation: rawCaps.safeSensitiveFileProbing === "AVAILABLE" ? "Deterministic safe probing for public configuration exposures (.env, .git, config backups)." : "Sensitive file probing skipped.",
      category: "Information Disclosure & Exposure",
    },
    frameworkVersionObservation: {
      status: rawCaps.frameworkVersionObservation || "AVAILABLE",
      explanation: "Passive signature detection for client/server framework and CMS platform.",
      category: "Information Disclosure & Exposure",
    },
    sourceMapObservation: {
      status: "AVAILABLE",
      explanation: "Public source map declarations and .map asset disclosures inspected.",
      category: "Information Disclosure & Exposure",
    },
    vulnerabilityAdvisoryLookup: {
      status: "PROVIDER_REQUIRED",
      explanation: "Live CVE/GHSA advisory lookup requires an authenticated National Vulnerability Database or OSV provider connection.",
      category: "Third-Party & Resource Integrity",
    },
    securityTxtInspection: {
      status: (facts.securityTxt !== undefined ? "AVAILABLE" : "NOT_AVAILABLE") as any,
      explanation: "RFC 9116 /.well-known/security.txt discovery and structured contact directive parsing.",
      category: "Domain & DNS Hygiene",
    },
    activeExploitationTesting: {
      status: (rawCaps.activeExploitationTesting || "NOT_AVAILABLE") as any,
      explanation: "Active penetration testing, payload injection, and exploitation are prohibited in non-destructive posture auditing.",
      category: "Manual Penetration Testing",
    },
  };

  // 11. Security.txt Sanitization (RFC 9116) - Strictly omit rawText
  let sanitizedSecurityTxt: SanitizedSecurityTxtFact | null = null;
  if (facts.securityTxt) {
    sanitizedSecurityTxt = {
      hasSecurityTxt: Boolean(facts.securityTxt.hasSecurityTxt),
      requestedUrl: facts.securityTxt.requestedUrl || "",
      httpStatus: facts.securityTxt.httpStatus || 0,
      isHttps: Boolean(facts.securityTxt.isHttps),
      contact: Array.isArray(facts.securityTxt.contact) ? facts.securityTxt.contact : [],
      expires: facts.securityTxt.expires || null,
      isExpired: Boolean(facts.securityTxt.isExpired),
      canonical: facts.securityTxt.canonical || null,
      policy: facts.securityTxt.policy || null,
      encryption: facts.securityTxt.encryption || null,
      acknowledgments: facts.securityTxt.acknowledgments || null,
      preferredLanguages: facts.securityTxt.preferredLanguages || null,
    };
  }

  return {
    targetDomain: facts.targetDomain,
    auditTimestamp: facts.auditTimestamp,
    isPartialAudit: false,
    scoreBreakdown,
    stats,
    categoryHealth,
    topRisks,
    quickWins,
    implementationMap,
    findings: enrichedFindings,
    coverage: evaluation.coverage,
    capabilities,
    securityTxt: sanitizedSecurityTxt,
    pages,
    thirdParties,
    disclaimer: {
      title: "Website Security Posture & Configuration Audit",
      description: "Dream SEO performs non-intrusive, automated evaluation of observable web security controls, transport encryption, and HTTP response headers. It is not an active penetration test and does not certify the absence of internal application vulnerabilities.",
      auditType: "AUTOMATED_CONFIGURATION_ASSESSMENT",
    },
  };
}
