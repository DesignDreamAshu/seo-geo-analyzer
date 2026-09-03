/**
 * Transport & HTTPS Security Rules (SECURITY S2).
 */

import type { SecurityRule, SecurityRuleEvaluationResult, SecurityFinding } from "../rule-types";
import { generateFindingId } from "../fingerprint";
import { CENTRAL_SECURITY_SEVERITY_POLICY } from "../severity-policy";

export const transportRules: SecurityRule[] = [
  {
    ruleId: "SEC_HTTPS_UNAVAILABLE",
    title: "HTTPS Transport Unavailable",
    category: "transport",
    description: "The website cannot be securely accessed over HTTPS transport.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HTTPS_UNAVAILABLE.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HTTPS_UNAVAILABLE.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319", cisBenchmark: "CIS-Apache-2.1" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const hosts = Object.keys(facts.tlsByHost);
      const findings: SecurityFinding[] = [];
      let passedCount = 0;
      let failedCount = 0;

      for (const host of hosts) {
        const tlsFact = facts.tlsByHost[host];
        if (!tlsFact.isHttpsAvailable && !tlsFact.inspectedSuccessfully) {
          failedCount++;
          const findingId = generateFindingId("SEC_HTTPS_UNAVAILABLE", "HOST", host);
          findings.push({
            id: findingId,
            ruleId: "SEC_HTTPS_UNAVAILABLE",
            category: "transport",
            title: "HTTPS Transport Unavailable",
            severity: "high",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `Host ${host} does not respond to HTTPS TLS handshakes. Plaintext HTTP transport leaves all network traffic vulnerable to interception and tampering.`,
            evidence: { host, port: tlsFact.port, error: tlsFact.inspectionError },
            affectedUrls: Object.keys(facts.urlFacts).filter((u) => u.includes(host)),
            affectedOccurrences: 1,
            scope: "HOST",
            fixLevel: "SERVER",
            deduplicationKey: findingId,
            globalEfficiencyText: `Enable TLS on host ${host} → protects all endpoints on this domain`,
            standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
          });
        } else {
          passedCount++;
        }
      }

      const status = failedCount > 0 ? "FAIL" : hosts.length > 0 ? "PASS" : "NOT_APPLICABLE";
      return {
        status,
        findings,
        testedTargets: hosts.length,
        passedTargets: passedCount,
        failedTargets: failedCount,
        notApplicableTargets: 0,
        evidenceSummary: failedCount > 0 ? `HTTPS unavailable on ${failedCount} host(s)` : "HTTPS connection available",
      };
    },
  },
  {
    ruleId: "SEC_HTTP_NO_HTTPS_REDIRECT",
    title: "HTTP Does Not Redirect to HTTPS",
    category: "transport",
    description: "Insecure plaintext HTTP requests do not automatically redirect to secure HTTPS.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HTTP_NO_HTTPS_REDIRECT.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HTTP_NO_HTTPS_REDIRECT.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const insecureUrls = Object.values(facts.urlFacts).filter(
        (u) => u.isInsecureHttp && !u.isRedirect && u.httpStatus >= 200 && u.httpStatus < 400
      );
      const findings: SecurityFinding[] = [];

      if (insecureUrls.length > 0) {
        const host = facts.targetDomain;
        const findingId = generateFindingId("SEC_HTTP_NO_HTTPS_REDIRECT", "HOST", host);
        findings.push({
          id: findingId,
          ruleId: "SEC_HTTP_NO_HTTPS_REDIRECT",
          category: "transport",
          title: "HTTP Does Not Redirect to HTTPS",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `${insecureUrls.length} URL(s) were served over plaintext HTTP (status 200) without redirecting to HTTPS.`,
          evidence: { unredirectedCount: insecureUrls.length, sampleUrls: insecureUrls.map((u) => u.requestedUrl).slice(0, 5) },
          affectedUrls: insecureUrls.map((u) => u.requestedUrl),
          affectedOccurrences: insecureUrls.length,
          scope: "HOST",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
          globalEfficiencyText: `Configure HTTP→HTTPS 301 redirect on ${host} → secures ${insecureUrls.length} URL(s)`,
        });
      }

      const totalUrls = Object.keys(facts.urlFacts).length;
      return {
        status: insecureUrls.length > 0 ? "FAIL" : "PASS",
        findings,
        testedTargets: totalUrls,
        passedTargets: totalUrls - insecureUrls.length,
        failedTargets: insecureUrls.length,
        notApplicableTargets: 0,
        evidenceSummary: insecureUrls.length > 0 ? `${insecureUrls.length} HTTP URLs do not redirect to HTTPS` : "All HTTP requests redirect to HTTPS",
      };
    },
  },
  {
    ruleId: "SEC_HTTP_REDIRECTS_TO_INSECURE_DESTINATION",
    title: "Redirect Chain Leads to Insecure Destination",
    category: "transport",
    description: "A redirect chain directs clients to an unencrypted HTTP destination.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HTTP_REDIRECTS_TO_INSECURE_DESTINATION.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_HTTP_REDIRECTS_TO_INSECURE_DESTINATION.confidence,
    scope: "URL",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const dangerousRedirects = Object.values(facts.urlFacts).filter(
        (u) => u.isHttps && u.finalUrl.startsWith("http://")
      );
      const findings: SecurityFinding[] = [];

      for (const page of dangerousRedirects) {
        const findingId = generateFindingId("SEC_HTTP_REDIRECTS_TO_INSECURE_DESTINATION", "URL", page.requestedUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_HTTP_REDIRECTS_TO_INSECURE_DESTINATION",
          category: "transport",
          title: "Redirect Chain Leads to Insecure Destination",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `HTTPS URL ${page.requestedUrl} redirected to insecure HTTP final destination ${page.finalUrl}.`,
          evidence: { requestedUrl: page.requestedUrl, finalUrl: page.finalUrl, redirectHops: page.redirectChain },
          affectedUrls: [page.requestedUrl],
          affectedOccurrences: 1,
          scope: "URL",
          fixLevel: "SERVER",
          deduplicationKey: findingId,
        });
      }

      const totalUrls = Object.keys(facts.urlFacts).length;
      return {
        status: dangerousRedirects.length > 0 ? "FAIL" : "PASS",
        findings,
        testedTargets: totalUrls,
        passedTargets: totalUrls - dangerousRedirects.length,
        failedTargets: dangerousRedirects.length,
        notApplicableTargets: 0,
        evidenceSummary: dangerousRedirects.length > 0 ? `${dangerousRedirects.length} URL(s) redirect to insecure HTTP` : "No HTTPS URLs redirect to plaintext HTTP",
      };
    },
  },
  {
    ruleId: "SEC_MIXED_ACTIVE_CONTENT",
    title: "Mixed Active Content (HTTP Script/Style/Iframe on HTTPS)",
    category: "transport",
    description: "An encrypted HTTPS page embeds active, executable resources (scripts, stylesheets, iframes) loaded over insecure HTTP.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_MIXED_ACTIVE_CONTENT.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_MIXED_ACTIVE_CONTENT.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319", mdnGuidance: "https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const activeMixed = facts.mixedContentOccurrences.filter((r) => r.isMixedActiveContent);
      const findings: SecurityFinding[] = [];

      // Group by page URL
      const byPage = new Map<string, typeof activeMixed>();
      for (const res of activeMixed) {
        const list = byPage.get(res.sourcePageUrl) || [];
        list.push(res);
        byPage.set(res.sourcePageUrl, list);
      }

      for (const [pageUrl, items] of byPage.entries()) {
        const findingId = generateFindingId("SEC_MIXED_ACTIVE_CONTENT", "URL", pageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_MIXED_ACTIVE_CONTENT",
          category: "transport",
          title: "Mixed Active Content Detected",
          severity: "high",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "FAIL",
          description: `HTTPS page embeds ${items.length} active resource(s) (scripts, stylesheets, or iframes) loaded over unencrypted HTTP. Modern browsers will block these resources, breaking page functionality and security.`,
          evidence: {
            pageUrl,
            resources: items.map((i) => ({ url: i.resolvedAbsoluteUrl, type: i.resourceType })),
          },
          affectedUrls: [pageUrl],
          affectedResources: items.map((i) => i.resolvedAbsoluteUrl),
          affectedOccurrences: items.length,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalHttpsPages = Object.values(facts.urlFacts).filter((u) => u.isHttps).length;
      return {
        status: activeMixed.length > 0 ? "FAIL" : totalHttpsPages > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalHttpsPages,
        passedTargets: totalHttpsPages - byPage.size,
        failedTargets: byPage.size,
        notApplicableTargets: 0,
        evidenceSummary: activeMixed.length > 0 ? `${activeMixed.length} mixed active resource(s) on ${byPage.size} page(s)` : "No mixed active content detected",
      };
    },
  },
  {
    ruleId: "SEC_MIXED_PASSIVE_CONTENT",
    title: "Mixed Passive Content (HTTP Images/Media on HTTPS)",
    category: "transport",
    description: "An encrypted HTTPS page embeds passive resources (images, audio, video) loaded over insecure HTTP.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_MIXED_PASSIVE_CONTENT.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_MIXED_PASSIVE_CONTENT.confidence,
    scope: "URL",
    fixLevel: "CODE",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-319" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const passiveMixed = facts.mixedContentOccurrences.filter((r) => r.isMixedPassiveContent);
      const findings: SecurityFinding[] = [];

      const byPage = new Map<string, typeof passiveMixed>();
      for (const res of passiveMixed) {
        const list = byPage.get(res.sourcePageUrl) || [];
        list.push(res);
        byPage.set(res.sourcePageUrl, list);
      }

      for (const [pageUrl, items] of byPage.entries()) {
        const findingId = generateFindingId("SEC_MIXED_PASSIVE_CONTENT", "URL", pageUrl);
        findings.push({
          id: findingId,
          ruleId: "SEC_MIXED_PASSIVE_CONTENT",
          category: "transport",
          title: "Mixed Passive Content Detected",
          severity: "medium",
          confidence: "confirmed",
          verificationClassification: "confirmed",
          status: "WARNING",
          description: `HTTPS page embeds ${items.length} passive resource(s) (images or media) loaded over unencrypted HTTP.`,
          evidence: {
            pageUrl,
            resources: items.map((i) => ({ url: i.resolvedAbsoluteUrl, type: i.resourceType })),
          },
          affectedUrls: [pageUrl],
          affectedResources: items.map((i) => i.resolvedAbsoluteUrl),
          affectedOccurrences: items.length,
          scope: "URL",
          fixLevel: "CODE",
          deduplicationKey: findingId,
        });
      }

      const totalHttpsPages = Object.values(facts.urlFacts).filter((u) => u.isHttps).length;
      return {
        status: passiveMixed.length > 0 ? "WARNING" : totalHttpsPages > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: totalHttpsPages,
        passedTargets: totalHttpsPages - byPage.size,
        failedTargets: byPage.size,
        notApplicableTargets: 0,
        evidenceSummary: passiveMixed.length > 0 ? `${passiveMixed.length} mixed passive resource(s) on ${byPage.size} page(s)` : "No mixed passive content detected",
      };
    },
  },
  {
    ruleId: "SEC_CERT_EXPIRED",
    title: "TLS/SSL Certificate Expired",
    category: "transport",
    description: "The host's TLS/SSL certificate validity period has expired.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CERT_EXPIRED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CERT_EXPIRED.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-295" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const hosts = Object.keys(facts.tlsByHost);
      const findings: SecurityFinding[] = [];
      let failedCount = 0;

      for (const host of hosts) {
        const cert = facts.tlsByHost[host]?.certificate;
        if (cert && cert.isExpired) {
          failedCount++;
          const findingId = generateFindingId("SEC_CERT_EXPIRED", "HOST", host);
          findings.push({
            id: findingId,
            ruleId: "SEC_CERT_EXPIRED",
            category: "transport",
            title: "TLS/SSL Certificate Expired",
            severity: "critical",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `The TLS certificate for host ${host} expired on ${cert.validTo}. Browsers will block visitors with severe security warnings.`,
            evidence: { host, validTo: cert.validTo, issuer: cert.issuer, subject: cert.subject },
            affectedUrls: Object.keys(facts.urlFacts).filter((u) => u.includes(host)),
            affectedOccurrences: 1,
            scope: "HOST",
            fixLevel: "SERVER",
            deduplicationKey: findingId,
            globalEfficiencyText: `Renew TLS certificate on ${host} → restores trust for all URLs on this host`,
          });
        }
      }

      return {
        status: failedCount > 0 ? "FAIL" : hosts.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: hosts.length,
        passedTargets: hosts.length - failedCount,
        failedTargets: failedCount,
        notApplicableTargets: 0,
        evidenceSummary: failedCount > 0 ? `Certificate expired on ${failedCount} host(s)` : "TLS certificate is currently valid",
      };
    },
  },
  {
    ruleId: "SEC_CERT_EXPIRING_SOON",
    title: "TLS/SSL Certificate Expiring Soon (≤ 30 Days)",
    category: "transport",
    description: "The host's TLS/SSL certificate is expiring within 30 days.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CERT_EXPIRING_SOON.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CERT_EXPIRING_SOON.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-295" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const hosts = Object.keys(facts.tlsByHost);
      const findings: SecurityFinding[] = [];
      let expiringCount = 0;

      for (const host of hosts) {
        const cert = facts.tlsByHost[host]?.certificate;
        if (cert && cert.isExpiringSoon && !cert.isExpired) {
          expiringCount++;
          const findingId = generateFindingId("SEC_CERT_EXPIRING_SOON", "HOST", host);
          findings.push({
            id: findingId,
            ruleId: "SEC_CERT_EXPIRING_SOON",
            category: "transport",
            title: "TLS/SSL Certificate Expiring Soon",
            severity: "low",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "WARNING",
            description: `The TLS certificate for host ${host} expires in ${cert.daysRemaining} days (on ${cert.validTo}). Renew soon to avoid service disruption.`,
            evidence: { host, daysRemaining: cert.daysRemaining, validTo: cert.validTo, issuer: cert.issuer },
            affectedUrls: Object.keys(facts.urlFacts).filter((u) => u.includes(host)),
            affectedOccurrences: 1,
            scope: "HOST",
            fixLevel: "SERVER",
            deduplicationKey: findingId,
          });
        }
      }

      return {
        status: expiringCount > 0 ? "WARNING" : hosts.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: hosts.length,
        passedTargets: hosts.length - expiringCount,
        failedTargets: expiringCount,
        notApplicableTargets: 0,
        evidenceSummary: expiringCount > 0 ? `Certificate expiring soon on ${expiringCount} host(s)` : "TLS certificate has ample validity (> 30 days)",
      };
    },
  },
  {
    ruleId: "SEC_CERT_HOSTNAME_MISMATCH",
    title: "TLS/SSL Certificate Hostname Mismatch",
    category: "transport",
    description: "The host's certificate Common Name (CN) and Subject Alternative Names (SANs) do not match the requested hostname.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CERT_HOSTNAME_MISMATCH.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_CERT_HOSTNAME_MISMATCH.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-297" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const hosts = Object.keys(facts.tlsByHost);
      const findings: SecurityFinding[] = [];
      let mismatchCount = 0;

      for (const host of hosts) {
        const cert = facts.tlsByHost[host]?.certificate;
        if (cert && !cert.isHostnameMatch) {
          mismatchCount++;
          const findingId = generateFindingId("SEC_CERT_HOSTNAME_MISMATCH", "HOST", host);
          findings.push({
            id: findingId,
            ruleId: "SEC_CERT_HOSTNAME_MISMATCH",
            category: "transport",
            title: "TLS/SSL Certificate Hostname Mismatch",
            severity: "critical",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `The TLS certificate presented by ${host} does not match the hostname. Certificate CN is "${cert.subject.commonName}" and SANs are [${cert.subjectAltNames.join(", ")}].`,
            evidence: { host, commonName: cert.subject.commonName, subjectAltNames: cert.subjectAltNames },
            affectedUrls: Object.keys(facts.urlFacts).filter((u) => u.includes(host)),
            affectedOccurrences: 1,
            scope: "HOST",
            fixLevel: "SERVER",
            deduplicationKey: findingId,
            globalEfficiencyText: `Install certificate matching ${host} → restores secure access for all URLs on this host`,
          });
        }
      }

      return {
        status: mismatchCount > 0 ? "FAIL" : hosts.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: hosts.length,
        passedTargets: hosts.length - mismatchCount,
        failedTargets: mismatchCount,
        notApplicableTargets: 0,
        evidenceSummary: mismatchCount > 0 ? `Certificate hostname mismatch on ${mismatchCount} host(s)` : "Certificate matches target hostname",
      };
    },
  },
  {
    ruleId: "SEC_TLS_CERTIFICATE_UNVERIFIED",
    title: "TLS Certificate Verification / Chain Error",
    category: "transport",
    description: "The TLS socket connection failed standard certificate chain authorization or CA trust verification.",
    verificationClassification: "confirmed",
    defaultSeverity: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_TLS_CERTIFICATE_UNVERIFIED.severity,
    defaultConfidence: CENTRAL_SECURITY_SEVERITY_POLICY.SEC_TLS_CERTIFICATE_UNVERIFIED.confidence,
    scope: "HOST",
    fixLevel: "SERVER",
    standardsMapping: { owaspTop10: "A02:2021-Cryptographic Failures", cwe: "CWE-295" },
    evaluate: (facts): SecurityRuleEvaluationResult => {
      const hosts = Object.keys(facts.tlsByHost);
      const findings: SecurityFinding[] = [];
      let unverifiedCount = 0;

      for (const host of hosts) {
        const conn = facts.tlsByHost[host]?.connection;
        if (conn && !conn.authorized && conn.authorizationError) {
          unverifiedCount++;
          const findingId = generateFindingId("SEC_TLS_CERTIFICATE_UNVERIFIED", "HOST", host);
          findings.push({
            id: findingId,
            ruleId: "SEC_TLS_CERTIFICATE_UNVERIFIED",
            category: "transport",
            title: "TLS Certificate Chain Unverified",
            severity: "high",
            confidence: "confirmed",
            verificationClassification: "confirmed",
            status: "FAIL",
            description: `TLS certificate verification failed for ${host}: ${conn.authorizationError}.`,
            evidence: { host, authorizationError: conn.authorizationError },
            affectedUrls: Object.keys(facts.urlFacts).filter((u) => u.includes(host)),
            affectedOccurrences: 1,
            scope: "HOST",
            fixLevel: "SERVER",
            deduplicationKey: findingId,
          });
        }
      }

      return {
        status: unverifiedCount > 0 ? "FAIL" : hosts.length > 0 ? "PASS" : "NOT_APPLICABLE",
        findings,
        testedTargets: hosts.length,
        passedTargets: hosts.length - unverifiedCount,
        failedTargets: unverifiedCount,
        notApplicableTargets: 0,
        evidenceSummary: unverifiedCount > 0 ? `TLS verification failed on ${unverifiedCount} host(s)` : "TLS certificate chain verified",
      };
    },
  },
];
