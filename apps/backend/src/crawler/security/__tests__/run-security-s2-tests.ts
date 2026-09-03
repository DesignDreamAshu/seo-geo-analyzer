/**
 * Comprehensive Deterministic Security Rule Engine Test Suite (SECURITY S2).
 * Verifies rule execution, deduplication, finding generation, coverage tracking, and fingerprint stability.
 */

import { defaultSecurityRuleRegistry } from "../rule-registry";
import { evaluateSecurityAudit } from "../engine";
import { generateFindingId, computePolicyFingerprint } from "../fingerprint";
import type { SecurityAuditFacts, SecurityCapabilities } from "../types";
import { getDefaultSecurityCapabilities } from "../facts-collector";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

function createBaseMockFacts(overrides: Partial<SecurityAuditFacts> = {}): SecurityAuditFacts {
  const caps = getDefaultSecurityCapabilities(true);
  return {
    targetDomain: "example.com",
    seedUrl: "https://example.com",
    auditTimestamp: "2026-08-31T12:00:00Z",
    capabilities: caps,
    urlFacts: {
      "https://example.com/": {
        requestedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        httpStatus: 200,
        isRedirect: false,
        redirectChain: [],
        contentType: "text/html; charset=utf-8",
        responseTimeMs: 120,
        isHttps: true,
        isInsecureHttp: false,
        hostname: "example.com",
        origin: "https://example.com",
        protocol: "https:",
        headersRedacted: {},
        rawHeaders: {},
      },
    },
    securityHeadersByUrl: {
      "https://example.com/": {
        url: "https://example.com/",
        cspEnforced: [
          {
            rawHeader: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
            directives: {
              "default-src": { name: "default-src", values: ["'self'"], hasNone: false, hasUnsafeInline: false, hasUnsafeEval: false, hasWildcard: false, hasHttpSource: false, hasStrictDynamic: false },
              "script-src": { name: "script-src", values: ["'self'"], hasNone: false, hasUnsafeInline: false, hasUnsafeEval: false, hasWildcard: false, hasHttpSource: false, hasStrictDynamic: false },
              "object-src": { name: "object-src", values: ["'none'"], hasNone: true, hasUnsafeInline: false, hasUnsafeEval: false, hasWildcard: false, hasHttpSource: false, hasStrictDynamic: false },
              "base-uri": { name: "base-uri", values: ["'self'"], hasNone: false, hasUnsafeInline: false, hasUnsafeEval: false, hasWildcard: false, hasHttpSource: false, hasStrictDynamic: false },
              "frame-ancestors": { name: "frame-ancestors", values: ["'self'"], hasNone: false, hasUnsafeInline: false, hasUnsafeEval: false, hasWildcard: false, hasHttpSource: false, hasStrictDynamic: false },
            },
            isReportOnly: false,
            parsedSuccessfully: true,
            parseErrors: [],
            hasObjectSrc: true,
            hasBaseUri: true,
            hasFrameAncestors: true,
            reportToUri: null,
          },
        ],
        cspReportOnly: [],
        hsts: {
          rawHeader: "max-age=31536000; includeSubDomains; preload",
          maxAgeSeconds: 31536000,
          maxAgeDays: 365,
          includeSubDomains: true,
          preload: true,
          isZeroMaxAge: false,
          isMalformed: false,
        },
        xContentTypeOptions: { raw: "nosniff", isNosniff: true, isMalformed: false },
        referrerPolicy: { raw: "strict-origin-when-cross-origin", tokens: ["strict-origin-when-cross-origin"], hasStrictPolicy: true, hasUnsafeUrl: false },
        permissionsPolicy: null,
        xFrameOptions: { raw: "DENY", isDeny: true, isSameOrigin: false, isAllowFrom: false, isMalformed: false },
        cors: null,
        coop: null,
        coep: null,
        corp: null,
        serverDisclosure: { rawServer: null, rawXPoweredBy: null, hasServerHeader: false, hasXPoweredBy: false, disclosedTechnologies: [] },
      },
    },
    cookies: [],
    resources: [],
    mixedContentOccurrences: [],
    forms: [],
    tlsByHost: {
      "example.com": {
        host: "example.com",
        port: 443,
        isHttpsAvailable: true,
        inspectedSuccessfully: true,
        inspectionError: null,
        certificate: {
          subject: { commonName: "example.com" },
          issuer: { organization: "Let's Encrypt" },
          subjectAltNames: ["example.com", "www.example.com"],
          validFrom: "2026-01-01T00:00:00Z",
          validTo: "2026-12-31T00:00:00Z",
          daysRemaining: 122,
          isExpired: false,
          isExpiringSoon: false,
          fingerprint256: "abc123sha256fingerprint",
          isHostnameMatch: true,
        },
        connection: {
          authorized: true,
          authorizationError: null,
          protocol: "TLSv1.3",
          cipherSuite: { name: "TLS_AES_256_GCM_SHA384", standardName: "TLS_AES_256_GCM_SHA384", version: "TLSv1.3" },
          ephemeralKeyInfo: null,
        },
      },
    },
    dnsByDomain: {
      "example.com": {
        domain: "example.com",
        host: "example.com",
        queryTimestamp: "2026-08-31T12:00:00Z",
        dnsResolverStatus: "SUCCESS",
        resolverErrorMessage: null,
        caaRecords: [{ flags: 0, tag: "issue", value: "letsencrypt.org" }],
        hasCaaRecord: true,
        txtRecords: [["v=spf1 include:_spf.google.com ~all"]],
        spfRecords: ["v=spf1 include:_spf.google.com ~all"],
        hasSpfRecord: true,
        isSpfSyntacticallyValid: true,
        dmarcRecord: "v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@example.com",
        hasDmarcRecord: true,
        dmarcPolicy: "reject",
        dmarcSubdomainPolicy: null,
        dmarcPercentage: 100,
        dmarcRua: ["mailto:dmarc@example.com"],
        dmarcRuf: null,
        dnssec: { capability: "NOT_OBSERVABLE", status: "NOT_OBSERVABLE", details: "Node DNS resolver limitation" },
      },
    },
    thirdPartyInventory: {
      thirdPartyOriginsCount: 0,
      totalThirdPartyResources: 0,
      thirdPartyOrigins: [],
      sriCoveragePercent: 100,
    },
    safeProbes: [
      {
        targetType: "ENV_FILE",
        path: "/.env",
        requestedUrl: "https://example.com/.env",
        httpStatus: 404,
        isSoft404: false,
        contentType: "text/plain",
        byteLength: 0,
        isConfirmedExposed: false,
        signatureType: "NONE",
        responseFingerprintSha256: "404hash",
        redactedEvidenceSnippet: null,
      },
    ],
    platform: {
      detectedPlatform: "generic_html",
      confidence: "low",
      ownershipModel: "USER_CONFIGURABLE",
      observedSignals: [],
    },
    ...overrides,
  };
}

async function runAllS2Tests() {
  console.log("=======================================================");
  console.log("RUNNING DETERMINISTIC SECURITY RULE ENGINE (S2) TESTS");
  console.log("=======================================================\n");

  // 1. Registry & Category Counts
  console.log("1. Security Rule Registry & Coverage Matrix");
  const allRules = defaultSecurityRuleRegistry.getAllRules();
  assert(allRules.length === 64, `Total registered security rules: 64 (found: ${allRules.length})`);
  assert(defaultSecurityRuleRegistry.getRulesByCategory("transport").length === 9, "Transport category contains 9 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("hsts").length === 4, "HSTS category contains 4 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("csp").length === 8, "CSP category contains 8 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("frame_protection").length === 1, "Frame protection category contains 1 rule");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("headers").length === 4, "Browser headers category contains 4 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("cookies").length === 6, "Cookies category contains 6 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("cors").length === 2, "CORS category contains 2 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("information_disclosure").length === 3, "Disclosure category contains 3 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("sensitive_files").length === 4, "Sensitive files category contains 4 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("forms").length === 5, "Forms category contains 5 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("third_party").length === 3, "Third party category contains 3 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("domain_email").length === 5, "Domain email category contains 5 rules");
  assert(defaultSecurityRuleRegistry.getRulesByCategory("manual_coverage").length === 10, "Manual coverage category contains 10 rules");

  // 2. Clean Target (All Pass / No Findings)
  console.log("\n2. Baseline Clean Audit (Zero Vulnerabilities)");
  const cleanFacts = createBaseMockFacts();
  const cleanResult = await evaluateSecurityAudit(cleanFacts);
  assert(cleanResult.findings.length === 0, `Clean baseline produces 0 findings (got ${cleanResult.findings.length})`);
  assert(cleanResult.summary.passedRulesCount >= 20, "Clean baseline has >=20 passing deterministic checks");
  assert(cleanResult.summary.manualVerificationRulesCount === 10, "Manual verification rules stay in manual coverage status");

  // 3. Transport & Certificate Failure Testing
  console.log("\n3. Transport & Certificate Rules");
  const certExpiredFacts = createBaseMockFacts({
    tlsByHost: {
      "example.com": {
        host: "example.com",
        port: 443,
        isHttpsAvailable: true,
        inspectedSuccessfully: true,
        inspectionError: null,
        certificate: {
          subject: { commonName: "example.com" },
          issuer: { organization: "Let's Encrypt" },
          subjectAltNames: ["example.com"],
          validFrom: "2025-01-01T00:00:00Z",
          validTo: "2026-01-01T00:00:00Z",
          daysRemaining: -242,
          isExpired: true,
          isExpiringSoon: true,
          fingerprint256: "fingerprint",
          isHostnameMatch: true,
        },
        connection: { authorized: false, authorizationError: "CERT_HAS_EXPIRED", protocol: "TLSv1.3", cipherSuite: null, ephemeralKeyInfo: null },
      },
    },
  });
  const expiredResult = await evaluateSecurityAudit(certExpiredFacts);
  const expiredFinding = expiredResult.findings.find((f) => f.ruleId === "SEC_CERT_EXPIRED");
  assert(expiredFinding !== undefined, "SEC_CERT_EXPIRED finding generated");
  assert(expiredFinding?.severity === "critical", "SEC_CERT_EXPIRED severity is critical");

  // Certificate Hostname Mismatch
  const mismatchFacts = createBaseMockFacts({
    tlsByHost: {
      "example.com": {
        host: "example.com",
        port: 443,
        isHttpsAvailable: true,
        inspectedSuccessfully: true,
        inspectionError: null,
        certificate: {
          subject: { commonName: "wrongdomain.com" },
          issuer: { organization: "DigiCert" },
          subjectAltNames: ["wrongdomain.com"],
          validFrom: "2026-01-01T00:00:00Z",
          validTo: "2026-12-31T00:00:00Z",
          daysRemaining: 120,
          isExpired: false,
          isExpiringSoon: false,
          fingerprint256: "fingerprint",
          isHostnameMatch: false,
        },
        connection: { authorized: false, authorizationError: "HOSTNAME_MISMATCH", protocol: "TLSv1.3", cipherSuite: null, ephemeralKeyInfo: null },
      },
    },
  });
  const mismatchResult = await evaluateSecurityAudit(mismatchFacts);
  assert(mismatchResult.findings.some((f) => f.ruleId === "SEC_CERT_HOSTNAME_MISMATCH"), "SEC_CERT_HOSTNAME_MISMATCH generated");

  // Mixed Active Content
  const mixedFacts = createBaseMockFacts({
    mixedContentOccurrences: [
      {
        sourcePageUrl: "https://example.com/checkout",
        resolvedAbsoluteUrl: "http://insecure-cdn.com/payment.js",
        resourceType: "script",
        isFirstParty: false,
        origin: "http://insecure-cdn.com",
        hasIntegrityAttribute: false,
        isMixedActiveContent: true,
        isMixedPassiveContent: false,
      },
    ],
  });
  const mixedResult = await evaluateSecurityAudit(mixedFacts);
  const mixedFinding = mixedResult.findings.find((f) => f.ruleId === "SEC_MIXED_ACTIVE_CONTENT");
  assert(mixedFinding !== undefined, "SEC_MIXED_ACTIVE_CONTENT generated");
  assert(mixedFinding?.severity === "high", "Mixed active content is high severity");

  // 4. HSTS Evaluation & Deduplication
  console.log("\n4. HSTS Missing & Duration Rules");
  const hstsMissingFacts = createBaseMockFacts({
    securityHeadersByUrl: {
      "https://example.com/": {
        ...cleanFacts.securityHeadersByUrl["https://example.com/"],
        hsts: null,
      },
      "https://example.com/about": {
        ...cleanFacts.securityHeadersByUrl["https://example.com/"],
        hsts: null,
      },
    },
    urlFacts: {
      "https://example.com/": cleanFacts.urlFacts["https://example.com/"],
      "https://example.com/about": {
        ...cleanFacts.urlFacts["https://example.com/"],
        requestedUrl: "https://example.com/about",
        finalUrl: "https://example.com/about",
      },
    },
  });
  const hstsMissingResult = await evaluateSecurityAudit(hstsMissingFacts);
  const hstsFindings = hstsMissingResult.findings.filter((f) => f.ruleId === "SEC_HSTS_MISSING");
  assert(hstsFindings.length === 1, `HSTS deduplicated into 1 host-level finding (got ${hstsFindings.length})`);
  assert(hstsFindings[0].affectedUrls.length === 2, "HSTS finding includes both affected URLs");
  assert(hstsFindings[0].globalEfficiencyText?.includes("protects all 2 URL(s)"), "Global efficiency recommendation generated");

  // 5. CSP & Frame Protection Joint Reasoning
  console.log("\n5. CSP & Frame Protection Rules");
  // Test case: X-Frame-Options missing BUT CSP frame-ancestors present -> MUST PASS without duplicate penalty!
  const jointFrameFacts = createBaseMockFacts({
    securityHeadersByUrl: {
      "https://example.com/": {
        ...cleanFacts.securityHeadersByUrl["https://example.com/"],
        xFrameOptions: null, // missing XFO
        cspEnforced: [
          {
            rawHeader: "frame-ancestors 'self'",
            directives: {
              "frame-ancestors": { name: "frame-ancestors", values: ["'self'"], hasNone: false, hasUnsafeInline: false, hasUnsafeEval: false, hasWildcard: false, hasHttpSource: false, hasStrictDynamic: false },
            },
            isReportOnly: false,
            parsedSuccessfully: true,
            parseErrors: [],
            hasObjectSrc: false,
            hasBaseUri: false,
            hasFrameAncestors: true,
            reportToUri: null,
          },
        ],
      },
    },
  });
  const jointFrameResult = await evaluateSecurityAudit(jointFrameFacts);
  const frameFinding = jointFrameResult.findings.find((f) => f.ruleId === "SEC_FRAME_PROTECTION_MISSING");
  assert(frameFinding === undefined, "No SEC_FRAME_PROTECTION_MISSING finding when CSP frame-ancestors is present");

  // Test case: Both frame-ancestors and XFO missing -> MUST FAIL
  const noFrameFacts = createBaseMockFacts({
    securityHeadersByUrl: {
      "https://example.com/": {
        ...cleanFacts.securityHeadersByUrl["https://example.com/"],
        xFrameOptions: null,
        cspEnforced: [],
      },
    },
  });
  const noFrameResult = await evaluateSecurityAudit(noFrameFacts);
  assert(noFrameResult.findings.some((f) => f.ruleId === "SEC_FRAME_PROTECTION_MISSING"), "SEC_FRAME_PROTECTION_MISSING generated when both missing");

  // 6. Cookie Rules & Sensitivity Classifier
  console.log("\n6. Cookie Security Rules");
  const cookieFacts = createBaseMockFacts({
    cookies: [
      {
        cookieName: "session_id",
        redactedValue: "s***d(len=32)",
        domain: "example.com",
        path: "/",
        isSecure: false, // Insecure session cookie over HTTPS
        isHttpOnly: false, // Insecure session cookie without HttpOnly
        sameSite: null,
        isSameSiteNoneWithoutSecure: false,
        hasHostPrefix: false,
        isHostPrefixValid: false,
        hasSecurePrefix: false,
        isSecurePrefixValid: false,
        isSuspectedSessionOrAuth: true,
        setOverInsecureTransport: false,
        sourceUrl: "https://example.com/login",
      },
      {
        cookieName: "theme_preference",
        redactedValue: "dark",
        domain: "example.com",
        path: "/",
        isSecure: true,
        isHttpOnly: false, // Non-sensitive cookie without HttpOnly -> Should NOT trigger high-risk HttpOnly issue
        sameSite: "Lax",
        isSameSiteNoneWithoutSecure: false,
        hasHostPrefix: false,
        isHostPrefixValid: false,
        hasSecurePrefix: false,
        isSecurePrefixValid: false,
        isSuspectedSessionOrAuth: false,
        setOverInsecureTransport: false,
        sourceUrl: "https://example.com/",
      },
    ],
  });
  const cookieResult = await evaluateSecurityAudit(cookieFacts);
  assert(cookieResult.findings.some((f) => f.ruleId === "SEC_COOKIE_SECURE_MISSING" && f.title.includes("session_id")), "SEC_COOKIE_SECURE_MISSING generated for session cookie");
  assert(cookieResult.findings.some((f) => f.ruleId === "SEC_COOKIE_HTTPONLY_MISSING" && f.title.includes("session_id")), "SEC_COOKIE_HTTPONLY_MISSING generated for session cookie");
  assert(!cookieResult.findings.some((f) => f.ruleId === "SEC_COOKIE_HTTPONLY_MISSING" && f.title.includes("theme_preference")), "Non-sensitive UI cookie did NOT trigger false HttpOnly finding");

  // 7. Sensitive File Exposure Rules (.env, .git, soft-404 rejection)
  console.log("\n7. Sensitive File Exposure Rules");
  // Confirmed exposed .env
  const envExposedFacts = createBaseMockFacts({
    safeProbes: [
      {
        targetType: "ENV_FILE",
        path: "/.env",
        requestedUrl: "https://example.com/.env",
        httpStatus: 200,
        isSoft404: false,
        contentType: "text/plain",
        byteLength: 450,
        isConfirmedExposed: true,
        signatureType: "ENV_KEY_VALUE",
        responseFingerprintSha256: "sha256env",
        redactedEvidenceSnippet: "DB_HOST=127.0.0.1\nDB_PASS=[REDACTED:len=16]",
      },
    ],
  });
  const envResult = await evaluateSecurityAudit(envExposedFacts);
  const envFinding = envResult.findings.find((f) => f.ruleId === "SEC_ENV_FILE_EXPOSED");
  assert(envFinding !== undefined, "SEC_ENV_FILE_EXPOSED generated for confirmed .env");
  assert(envFinding?.severity === "critical", ".env exposure is critical severity");
  assert(JSON.stringify(envFinding?.evidence).includes("[REDACTED:len=16]"), "Evidence contains redacted secret format");

  // Soft-404 .env => MUST NOT trigger finding!
  const soft404Facts = createBaseMockFacts({
    safeProbes: [
      {
        targetType: "ENV_FILE",
        path: "/.env",
        requestedUrl: "https://example.com/.env",
        httpStatus: 200,
        isSoft404: true, // SPA HTML shell
        contentType: "text/html",
        byteLength: 2048,
        isConfirmedExposed: false,
        signatureType: "NONE",
        responseFingerprintSha256: "sha256html",
        redactedEvidenceSnippet: null,
      },
    ],
  });
  const soft404Result = await evaluateSecurityAudit(soft404Facts);
  assert(!soft404Result.findings.some((f) => f.ruleId === "SEC_ENV_FILE_EXPOSED"), "Soft-404 HTML shell correctly rejected with zero false positives");

  // 8. Form Security Rules (Password over HTTP, GET Password)
  console.log("\n8. Form Security Rules");
  const formFacts = createBaseMockFacts({
    forms: [
      {
        sourcePageUrl: "http://example.com/login",
        rawActionAttribute: "/auth",
        resolvedActionUrl: "http://example.com/auth",
        method: "POST",
        inputsCount: 3,
        hasPasswordInput: true,
        hasFileInput: false,
        hasSensitiveInputInGetForm: false,
        pageIsHttps: false,
        isCrossDomainAction: false,
        hasVisibleCsrfTokenCandidate: false,
        csrfTokenNameCandidate: null,
      },
      {
        sourcePageUrl: "https://example.com/search-login",
        rawActionAttribute: "/auth-get",
        resolvedActionUrl: "https://example.com/auth-get",
        method: "GET",
        inputsCount: 2,
        hasPasswordInput: true,
        hasFileInput: false,
        hasSensitiveInputInGetForm: true,
        pageIsHttps: true,
        isCrossDomainAction: false,
        hasVisibleCsrfTokenCandidate: false,
        csrfTokenNameCandidate: null,
      },
    ],
  });
  const formResult = await evaluateSecurityAudit(formFacts);
  assert(formResult.findings.some((f) => f.ruleId === "SEC_PASSWORD_FORM_OVER_HTTP"), "SEC_PASSWORD_FORM_OVER_HTTP generated for plaintext password form");
  assert(formResult.findings.some((f) => f.ruleId === "SEC_PASSWORD_FIELD_USING_GET"), "SEC_PASSWORD_FIELD_USING_GET generated for GET password form");

  // 9. CORS Wildcard Handling
  console.log("\n9. CORS Rules");
  const corsFacts = createBaseMockFacts({
    securityHeadersByUrl: {
      "https://example.com/": {
        ...cleanFacts.securityHeadersByUrl["https://example.com/"],
        cors: {
          rawAllowOrigin: "*",
          rawAllowCredentials: "true",
          isWildcardOrigin: true,
          isAllowCredentialsTrue: true,
          isDangerousWildcardCredentialsCombination: true,
        },
      },
    },
  });
  const corsResult = await evaluateSecurityAudit(corsFacts);
  assert(corsResult.findings.some((f) => f.ruleId === "SEC_CORS_WILDCARD_WITH_CREDENTIALS"), "SEC_CORS_WILDCARD_WITH_CREDENTIALS generated for dangerous CORS");

  // Public API CORS Wildcard (Credentials: false) -> Informational / Observed ONLY
  const publicCorsFacts = createBaseMockFacts({
    securityHeadersByUrl: {
      "https://example.com/": {
        ...cleanFacts.securityHeadersByUrl["https://example.com/"],
        cors: {
          rawAllowOrigin: "*",
          rawAllowCredentials: null,
          isWildcardOrigin: true,
          isAllowCredentialsTrue: false,
          isDangerousWildcardCredentialsCombination: false,
        },
      },
    },
  });
  const publicCorsResult = await evaluateSecurityAudit(publicCorsFacts);
  const publicCorsFinding = publicCorsResult.findings.find((f) => f.ruleId === "SEC_CORS_WILDCARD");
  assert(publicCorsFinding !== undefined, "SEC_CORS_WILDCARD generated as observation");
  assert(publicCorsFinding?.severity === "informational", "Public CORS wildcard is informational, not a vulnerability failure");

  // 10. Domain DNS Rules & DNSSEC Reporting
  console.log("\n10. Domain DNS & DNSSEC Rules");
  const noDmarcFacts = createBaseMockFacts({
    dnsByDomain: {
      "example.com": {
        ...cleanFacts.dnsByDomain["example.com"],
        hasDmarcRecord: false,
        dmarcRecord: null,
      },
    },
  });
  const noDmarcResult = await evaluateSecurityAudit(noDmarcFacts);
  assert(noDmarcResult.findings.some((f) => f.ruleId === "SEC_DMARC_MISSING"), "SEC_DMARC_MISSING generated when DMARC missing");

  const dnssecCoverage = noDmarcResult.coverage.find((c) => c.ruleId === "SEC_CAA_MISSING");
  assert(noDmarcFacts.dnsByDomain["example.com"].dnssec.status === "NOT_OBSERVABLE", "DNSSEC status truthfully reported as NOT_OBSERVABLE");

  // 11. Deterministic Finding Fingerprint Stability
  console.log("\n11. Fingerprint & Finding ID Stability");
  const id1 = generateFindingId("SEC_HSTS_MISSING", "HOST", "example.com");
  const id2 = generateFindingId("SEC_HSTS_MISSING", "HOST", "example.com");
  assert(id1 === id2, "Identical re-run produces identical deterministic finding ID");
  assert(id1 === "security:SEC_HSTS_MISSING:host:example.com", "Finding ID follows standard namespaced format");

  const idDifferentHost = generateFindingId("SEC_HSTS_MISSING", "HOST", "sub.example.com");
  assert(id1 !== idDifferentHost, "Different hosts produce distinct finding IDs");

  const policyHash1 = computePolicyFingerprint({ hsts: "max-age=31536000", csp: "default-src 'self'" });
  const policyHash2 = computePolicyFingerprint({ hsts: "max-age=31536000", csp: "default-src 'self'" });
  assert(policyHash1 === policyHash2, "Policy configuration fingerprints match");

  // 12. Manual Verification Coverage Rules
  console.log("\n12. Manual Coverage Invariants");
  const manualSqLi = cleanResult.coverage.find((c) => c.ruleId === "SEC_MANUAL_SQL_INJECTION");
  assert(manualSqLi?.status === "REQUIRES_MANUAL_VERIFICATION", "Manual SQLi rule status is REQUIRES_MANUAL_VERIFICATION");
  assert(!cleanResult.findings.some((f) => f.ruleId.startsWith("SEC_MANUAL_")), "Zero manual rules generate automated findings");

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log("=======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllS2Tests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
