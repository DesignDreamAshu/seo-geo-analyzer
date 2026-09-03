/**
 * SECURITY S5 — Scoring & View-Model Test Suite.
 * Certifies transparent weighted scoring, global deduplication bounds,
 * category deduction caps, and complete frontend view-model generation.
 */

import { evaluateSecurityAudit } from "../engine";
import { calculateSecurityScore } from "../scoring/score-engine";
import { buildSecurityAuditViewModel } from "../scoring/view-model-builder";
import type { SecurityAuditFacts } from "../types";
import { getDefaultSecurityCapabilities } from "../facts-collector";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${msg}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function createMockFacts(overrides: Partial<SecurityAuditFacts> = {}): SecurityAuditFacts {
  return {
    targetDomain: "example.com",
    seedUrl: "https://example.com",
    auditTimestamp: "2026-08-31T12:00:00Z",
    capabilities: getDefaultSecurityCapabilities(true),
    urlFacts: {
      "https://example.com/": {
        requestedUrl: "https://example.com/", finalUrl: "https://example.com/", httpStatus: 200, isRedirect: false, redirectChain: [], contentType: "text/html", responseTimeMs: 100, isHttps: true, isInsecureHttp: false, hostname: "example.com", origin: "https://example.com", protocol: "https:", headersRedacted: {}, rawHeaders: {}
      }
    },
    securityHeadersByUrl: {
      "https://example.com/": {
        url: "https://example.com/",
        cspEnforced: [{ rawHeader: "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'", directives: {}, isReportOnly: false, parsedSuccessfully: true, parseErrors: [], hasObjectSrc: true, hasBaseUri: true, hasFrameAncestors: true, reportToUri: null }],
        cspReportOnly: [],
        hsts: { rawHeader: "max-age=31536000; includeSubDomains; preload", maxAgeSeconds: 31536000, maxAgeDays: 365, includeSubDomains: true, preload: true, isZeroMaxAge: false, isMalformed: false },
        xContentTypeOptions: { raw: "nosniff", isNoSniff: true, isMalformed: false },
        referrerPolicy: { raw: "strict-origin-when-cross-origin", tokens: ["strict-origin-when-cross-origin"], hasNoReferrer: false, hasStrictOriginWhenCrossOrigin: true, hasUnsafeUrl: false, hasNoReferrerWhenDowngrade: false },
        permissionsPolicy: null,
        xFrameOptions: { raw: "DENY", normalized: "DENY", isDeny: true, isSameOrigin: false, isMalformed: false, isAllowFrom: false },
        cors: null,
        coop: null,
        coep: null,
        corp: null,
        serverDisclosure: { rawServer: null, rawXPoweredBy: null, hasServerHeader: false, hasXPoweredBy: false, disclosedTechnologies: [] },
      }
    },
    cookies: [],
    resources: [],
    mixedContentOccurrences: [],
    forms: [],
    tlsByHost: {
      "example.com": {
        host: "example.com", port: 443, isHttpsAvailable: true, inspectedSuccessfully: true, inspectionError: null,
        certificate: { subject: { commonName: "example.com" }, issuer: { organization: "Let's Encrypt" }, subjectAltNames: ["example.com"], validFrom: "2026-01-01", validTo: "2026-12-31", daysRemaining: 120, isExpired: false, isExpiringSoon: false, fingerprint256: "sha256", isHostnameMatch: true },
        connection: { authorized: true, authorizationError: null, protocol: "TLSv1.3", cipherSuite: null, ephemeralKeyInfo: null }
      }
    },
    dnsByDomain: {
      "example.com": {
        domain: "example.com", host: "example.com", queryTimestamp: "2026-08-31", dnsResolverStatus: "SUCCESS", resolverErrorMessage: null,
        caaRecords: [{ flags: 0, tag: "issue", value: "letsencrypt.org" }], hasCaaRecord: true,
        txtRecords: [["v=spf1 include:_spf.google.com ~all"]], spfRecords: ["v=spf1 include:_spf.google.com ~all"], hasSpfRecord: true, isSpfSyntacticallyValid: true,
        dmarcRecord: "v=DMARC1; p=reject; pct=100", hasDmarcRecord: true, dmarcPolicy: "reject", dmarcSubdomainPolicy: null, dmarcPercentage: 100, dmarcRua: null, dmarcRuf: null,
        dnssec: { capability: "NOT_OBSERVABLE", status: "NOT_OBSERVABLE", details: "DNSSEC limitation" }
      }
    },
    thirdPartyInventory: { thirdPartyOriginsCount: 0, totalThirdPartyResources: 0, thirdPartyOrigins: [], sriCoveragePercent: 100 },
    safeProbes: [],
    platform: { detectedPlatform: "generic_html", confidence: "low", ownershipModel: "USER_CONFIGURABLE", observedSignals: [] },
    ...overrides,
  };
}

async function runS5ScoreTests() {
  console.log("=======================================================");
  console.log("RUNNING SECURITY POSTURE SCORING (S5) TEST SUITE");
  console.log("=======================================================\n");

  // 1. Clean Baseline Audit
  console.log("1. Clean Baseline Audit Scoring");
  {
    const cleanFacts = createMockFacts();
    const cleanEval = await evaluateSecurityAudit(cleanFacts);
    const scoreObj = calculateSecurityScore(cleanEval, cleanFacts);

    assert(scoreObj.score === 100, `Clean baseline score is 100 (got: ${scoreObj.score})`);
    assert(scoreObj.posture === "Excellent", `Clean baseline posture is "Excellent" (got: ${scoreObj.posture})`);
    assert(scoreObj.totalDeductions === 0, `Clean baseline has 0 deductions (got: ${scoreObj.totalDeductions})`);
    assert(scoreObj.observableAutomatedCoverage.availableChecks === 54, `Available automated checks: 54`);
  }

  // 2. Individual Severity Deductions
  console.log("\n2. Severity Weight Deductions");
  {
    // Low issue: SEC_X_POWERED_BY_DISCLOSURE
    const lowFacts = createMockFacts({
      securityHeadersByUrl: {
        "https://example.com/": {
          ...createMockFacts().securityHeadersByUrl["https://example.com/"],
          serverDisclosure: { rawServer: "nginx", rawXPoweredBy: "Express", hasServerHeader: true, hasXPoweredBy: true, disclosedTechnologies: ["Express"] }
        }
      }
    });
    const lowEval = await evaluateSecurityAudit(lowFacts);
    const lowScore = calculateSecurityScore(lowEval, lowFacts);
    assert(lowScore.score === 98, `Low finding deducts 2 points (score: 98, got: ${lowScore.score})`);
    assert(lowScore.posture === "Excellent", `Score 98 maintains "Excellent" posture`);

    // Medium issue: SEC_HSTS_MISSING
    const medFacts = createMockFacts({
      securityHeadersByUrl: { "https://example.com/": { ...createMockFacts().securityHeadersByUrl["https://example.com/"], hsts: null } }
    });
    const medEval = await evaluateSecurityAudit(medFacts);
    const medScore = calculateSecurityScore(medEval, medFacts);
    assert(medScore.score === 95, `Medium finding deducts 5 points (score: 95, got: ${medScore.score})`);

    // High issue: SEC_MIXED_ACTIVE_CONTENT
    const highFacts = createMockFacts({
      mixedContentOccurrences: [{ sourcePageUrl: "https://example.com/", resolvedAbsoluteUrl: "http://cdn.com/app.js", rawUrl: "http://cdn.com/app.js", resourceOrigin: "http://cdn.com", resourceType: "script", isFirstParty: false, isThirdParty: true, isHttps: false, isInsecureHttp: true, sourcePageIsHttps: true, isMixedContent: true, isMixedActiveContent: true, isMixedPassiveContent: false, hasIntegrity: false, integrityAttribute: null, hasValidSriHash: false, crossOriginAttribute: null }]
    });
    const highEval = await evaluateSecurityAudit(highFacts);
    const highScore = calculateSecurityScore(highEval, highFacts);
    assert(highScore.score === 90, `High finding deducts 10 points (score: 90, got: ${highScore.score})`);

    // Critical issue: SEC_ENV_FILE_EXPOSED
    const critFacts = createMockFacts({
      safeProbes: [{ targetType: "ENV_FILE", path: "/.env", requestedUrl: "https://example.com/.env", httpStatus: 200, isSoft404: false, contentType: "text/plain", byteLength: 200, isConfirmedExposed: true, signatureType: "ENV_KEY", responseFingerprintSha256: "sha256", redactedEvidenceSnippet: "DB_PASS=***" }]
    });
    const critEval = await evaluateSecurityAudit(critFacts);
    const critScore = calculateSecurityScore(critEval, critFacts);
    assert(critScore.score === 80, `Critical finding deducts 20 points (score: 80, got: ${critScore.score})`);
    assert(critScore.posture === "Weak", `Confirmed .env exposure caps posture at "Weak" (got: ${critScore.posture})`);
  }

  // 3. Global Deduplication Scoring Invariant (100 URLs vs 1 URL)
  console.log("\n3. Global Deduplication Scoring Scaling");
  {
    // 1 URL missing HSTS
    const facts1 = createMockFacts({
      securityHeadersByUrl: { "https://example.com/": { ...createMockFacts().securityHeadersByUrl["https://example.com/"], hsts: null } }
    });
    const eval1 = await evaluateSecurityAudit(facts1);
    const score1 = calculateSecurityScore(eval1, facts1);

    // 100 URLs missing HSTS on same host
    const urlFacts100: Record<string, any> = {};
    const secHeaders100: Record<string, any> = {};
    for (let i = 1; i <= 100; i++) {
      const u = `https://example.com/page-${i}`;
      urlFacts100[u] = { requestedUrl: u, finalUrl: u, httpStatus: 200, isRedirect: false, redirectChain: [], contentType: "text/html", responseTimeMs: 50, isHttps: true, isInsecureHttp: false, hostname: "example.com", origin: "https://example.com", protocol: "https:", headersRedacted: {}, rawHeaders: {} };
      secHeaders100[u] = { ...createMockFacts().securityHeadersByUrl["https://example.com/"], url: u, hsts: null };
    }
    const facts100 = createMockFacts({ urlFacts: urlFacts100, securityHeadersByUrl: secHeaders100 });
    const eval100 = await evaluateSecurityAudit(facts100);
    const score100 = calculateSecurityScore(eval100, facts100);

    assert(eval100.findings.filter(f => f.ruleId === "SEC_HSTS_MISSING").length === 1, "100 pages produce 1 host finding");
    assert(score1.score === 95, `1 URL score is 95`);
    assert(score100.score >= 93 && score100.score <= 95, `100 URLs score is bounded at ${score100.score} (NOT multiplied 100x into 0)`);
  }

  // 4. Excluded Non-Scoring Items
  console.log("\n4. Excluded Non-Scoring Items");
  {
    const factsWithInfo = createMockFacts({
      securityHeadersByUrl: {
        "https://example.com/": {
          ...createMockFacts().securityHeadersByUrl["https://example.com/"],
          cors: { allowOriginRaw: "*", isWildcardOrigin: true, isSpecificOrigin: false, allowCredentialsRaw: null, isAllowCredentialsTrue: false, isDangerousWildcardCredentialsCombination: false, allowMethods: ["GET"], allowHeaders: ["*"], exposeHeaders: [] }
        }
      }
    });
    const evalWithInfo = await evaluateSecurityAudit(factsWithInfo);
    const scoreWithInfo = calculateSecurityScore(evalWithInfo, factsWithInfo);

    assert(evalWithInfo.findings.some(f => f.ruleId === "SEC_CORS_WILDCARD"), "Public CORS wildcard finding present");
    assert(scoreWithInfo.score === 100, "Informational CORS wildcard finding produces 0 score deduction (score: 100)");
    assert(scoreWithInfo.excludedNonScoringCount >= 1, "Non-scoring findings recorded in breakdown");
  }

  // 5. Complete View-Model Contract
  console.log("\n5. Complete View-Model Contract Generation");
  {
    const mixedFacts = createMockFacts({
      securityHeadersByUrl: {
        "https://example.com/": {
          ...createMockFacts().securityHeadersByUrl["https://example.com/"],
          hsts: null,
          serverDisclosure: { rawServer: "nginx/1.24.0", rawXPoweredBy: "PHP/8.1", hasServerHeader: true, hasXPoweredBy: true, disclosedTechnologies: ["PHP"] }
        }
      }
    });
    const mixedEval = await evaluateSecurityAudit(mixedFacts);
    const vm = buildSecurityAuditViewModel(mixedFacts, mixedEval);

    assert(vm.targetDomain === "example.com", "ViewModel targetDomain matches");
    assert(Boolean(vm.scoreBreakdown), "ViewModel scoreBreakdown present");
    assert(vm.categoryHealth.length === 13, `ViewModel categoryHealth covers all 13 categories (${vm.categoryHealth.length})`);
    assert(vm.topRisks.length > 0, "ViewModel topRisks populated");
    assert(vm.quickWins.length > 0, "ViewModel quickWins populated");
    assert(vm.implementationMap.totalActions > 0, "ViewModel implementationMap actions generated");
    assert(vm.findings.every(f => f.remediation !== undefined), "All ViewModel findings have full remediation attached");
    assert(vm.coverage.length === 64, "ViewModel coverage covers all 64 rules");
    assert(vm.pages.length === 1, "ViewModel pages explorer populated");
    assert(Boolean(vm.disclaimer.title), "ViewModel disclaimer present");
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log("=======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runS5ScoreTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
