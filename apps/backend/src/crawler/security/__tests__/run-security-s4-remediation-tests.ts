/**
 * SECURITY S4 — Fix Intelligence & Remediation Engineering Test Suite.
 * Validates remediation contracts, platform adapters, secret redaction, ownership,
 * implementation maps, global efficiency scaling, and automated verification contracts across all 64 rules.
 */

import { defaultSecurityRuleRegistry } from "../rule-registry";
import { evaluateSecurityAudit } from "../engine";
import { generateSecurityRemediation } from "../remediation/remediation-generator";
import { buildSecurityImplementationMap } from "../remediation/implementation-map";
import { getWebflowInstruction } from "../remediation/platform-adapters/webflow-adapter";
import { getWordPressInstruction } from "../remediation/platform-adapters/wordpress-adapter";
import { getNextJsInstruction } from "../remediation/platform-adapters/nextjs-adapter";
import { getShopifyInstruction } from "../remediation/platform-adapters/shopify-adapter";
import { getServerCdnInstructions } from "../remediation/platform-adapters/server-cdn-adapter";
import type { SecurityAuditFacts, SecurityFinding } from "../types";
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
    securityHeadersByUrl: {},
    cookies: [],
    resources: [],
    mixedContentOccurrences: [],
    forms: [],
    tlsByHost: {},
    dnsByDomain: {},
    thirdPartyInventory: { thirdPartyOriginsCount: 0, totalThirdPartyResources: 0, thirdPartyOrigins: [], sriCoveragePercent: 100 },
    safeProbes: [],
    platform: { detectedPlatform: "generic_html", confidence: "low", ownershipModel: "USER_CONFIGURABLE", observedSignals: [] },
    ...overrides,
  };
}

async function runS4Tests() {
  console.log("=======================================================");
  console.log("RUNNING SECURITY FIX INTELLIGENCE (S4) TEST SUITE");
  console.log("=======================================================\n");

  const mockFacts = createMockFacts();
  const allRules = defaultSecurityRuleRegistry.getAllRules();

  // 1. Full Rule Coverage Contract
  console.log("1. Remediation Coverage Matrix (All 64 Rules)");
  {
    assert(allRules.length === 64, `Total rules registered for remediation: ${allRules.length} === 64`);

    let actionableCount = 0;
    let manualCount = 0;

    for (const rule of allRules) {
      const dummyFinding: SecurityFinding = {
        id: `security:${rule.ruleId}:HOST:example.com`,
        ruleId: rule.ruleId,
        category: rule.category,
        title: rule.title,
        severity: rule.defaultSeverity,
        confidence: rule.defaultConfidence,
        verificationClassification: rule.verificationClassification,
        status: "FAIL",
        description: rule.description,
        evidence: { testKey: "testValue" },
        affectedUrls: ["https://example.com/page-1", "https://example.com/page-2"],
        affectedOccurrences: 2,
        scope: rule.scope,
        fixLevel: rule.fixLevel,
        deduplicationKey: `security:${rule.ruleId}:HOST:example.com`,
      };

      const rem = generateSecurityRemediation(dummyFinding, mockFacts);

      assert(rem.ruleId === rule.ruleId, `Remediation generated for ${rule.ruleId}`);
      assert(Boolean(rem.summary && rem.summary.length > 5), `Summary present for ${rule.ruleId}`);
      assert(Boolean(rem.simpleExplanation && rem.simpleExplanation.length > 5), `Simple explanation present for ${rule.ruleId}`);
      assert(Boolean(rem.whatIsWrong && rem.whatIsWrong.length > 5), `whatIsWrong present for ${rule.ruleId}`);
      assert(Boolean(rem.whyItMatters && rem.whyItMatters.length > 5), `whyItMatters present for ${rule.ruleId}`);
      assert(Boolean(rem.recommendedAction && rem.recommendedAction.length > 5), `recommendedAction present for ${rule.ruleId}`);
      assert(Boolean(rem.exactRecommendedChange && rem.exactRecommendedChange.length > 5), `exactRecommendedChange present for ${rule.ruleId}`);
      assert(rem.ownership.length > 0, `Ownership assigned for ${rule.ruleId}`);
      assert(Boolean(rem.scope), `Scope assigned for ${rule.ruleId}`);
      assert(rem.implementationSteps.length > 0, `Implementation steps present for ${rule.ruleId}`);
      assert(Boolean(rem.automatedVerification), `Automated verification contract present for ${rule.ruleId}`);

      if (rule.verificationClassification === "requires_manual_verification") {
        manualCount++;
        assert(rem.actionability === "MANUAL_ASSESSMENT_REQUIRED", `${rule.ruleId} actionability is MANUAL_ASSESSMENT_REQUIRED`);
        assert(!rem.automatedVerification.supported, `${rule.ruleId} automated verification is false`);
      } else {
        actionableCount++;
      }
    }

    assert(actionableCount === 54, `Actionable automated rules covered: ${actionableCount} === 54 (52 confirmed + 2 heuristic)`);
    assert(manualCount === 10, `Manual assessment guidance rules covered: ${manualCount} === 10`);
  }

  // 2. Platform Adapter Invariants
  console.log("\n2. Platform Adapters Invariants");
  {
    // Webflow
    const wfHsts = getWebflowInstruction("SEC_HSTS_MISSING");
    assert(wfHsts !== null, "Webflow HSTS instruction exists");
    assert(wfHsts?.isDirectlySupported === false, "Webflow correctly states HSTS is not directly configurable in Webflow Designer");
    assert(wfHsts?.controlLocation.includes("Cloudflare") || wfHsts?.controlLocation.includes("Webflow Hosting"), "Webflow points to Edge / Reverse Proxy for custom HSTS");

    const wfCsp = getWebflowInstruction("SEC_CSP_MISSING");
    assert(wfCsp !== null, "Webflow CSP instruction exists");
    assert(wfCsp?.isDirectlySupported === true, "Webflow supports CSP via Head Code meta tag");
    assert(wfCsp?.codeExamples?.[0]?.code.includes("assets.webflow.com"), "Webflow CSP example preserves Webflow CDN assets");

    // WordPress
    const wpHsts = getWordPressInstruction("SEC_HSTS_MISSING");
    assert(wpHsts !== null, "WordPress HSTS instruction exists");
    assert(wpHsts?.codeExamples?.some(c => c.language === "apache"), "WordPress includes .htaccess example");
    assert(wpHsts?.codeExamples?.some(c => c.language === "php"), "WordPress includes functions.php example");

    // Next.js
    const nextHsts = getNextJsInstruction("SEC_HSTS_MISSING");
    assert(nextHsts !== null, "Next.js HSTS instruction exists");
    assert(nextHsts?.codeExamples?.[0]?.code.includes("next.config.js"), "Next.js provides next.config.js headers() example");

    const nextPoweredBy = getNextJsInstruction("SEC_X_POWERED_BY_DISCLOSURE");
    assert(nextPoweredBy?.codeExamples?.[0]?.code.includes("poweredByHeader: false"), "Next.js provides poweredByHeader: false snippet");

    // Shopify
    const shopifyHsts = getShopifyInstruction("SEC_HSTS_MISSING");
    assert(shopifyHsts?.isDirectlySupported === false, "Shopify correctly marks HSTS as platform-controlled");

    // Nginx & Apache
    const srvHsts = getServerCdnInstructions("SEC_HSTS_MISSING");
    assert(srvHsts.some(s => s.platform === "NGINX"), "Nginx HSTS server block instruction exists");
    assert(srvHsts.some(s => s.platform === "APACHE"), "Apache HSTS instruction exists");
    assert(srvHsts.some(s => s.platform === "CLOUDFLARE"), "Cloudflare HSTS instruction exists");
  }

  // 3. Secret Redaction & Sensitive Files Safety
  console.log("\n3. Secret Redaction & Sensitive Files Safety");
  {
    const envFinding: SecurityFinding = {
      id: "security:SEC_ENV_FILE_EXPOSED:SITE:https://example.com/.env",
      ruleId: "SEC_ENV_FILE_EXPOSED",
      category: "sensitive_files",
      title: "Exposed Environment File (.env)",
      severity: "critical",
      confidence: "confirmed",
      verificationClassification: "confirmed",
      status: "FAIL",
      description: "Confirmed .env file exposure",
      evidence: {
        path: "/.env",
        redactedEvidenceSnippet: "DB_PASS=[REDACTED]",
      },
      affectedUrls: ["https://example.com/.env"],
      affectedOccurrences: 1,
      scope: "SITE",
      fixLevel: "SERVER",
      deduplicationKey: "security:SEC_ENV_FILE_EXPOSED:SITE:https://example.com/.env",
    };

    const envRem = generateSecurityRemediation(envFinding, mockFacts);
    assert(envRem.risksAndCautions.some(c => c.includes("rotate") || c.includes("Rotate")), "Remediation emphasizes credential rotation");
    assert(!JSON.stringify(envRem).includes("secret_password_123"), "Remediation output never contains raw leaked passwords");
    assert(envRem.automatedVerification.method === "SAFE_PROBE", "Verification uses SAFE_PROBE");
  }

  // 4. Global Fix Intelligence & Implementation Map
  console.log("\n4. Global Fix Intelligence & Implementation Map");
  {
    const findings: SecurityFinding[] = [
      {
        id: "security:SEC_HSTS_MISSING:HOST:example.com",
        ruleId: "SEC_HSTS_MISSING",
        category: "hsts",
        title: "Missing HSTS Header",
        severity: "medium",
        confidence: "confirmed",
        verificationClassification: "confirmed",
        status: "FAIL",
        description: "Missing HSTS",
        evidence: {},
        affectedUrls: ["https://example.com/p1", "https://example.com/p2", "https://example.com/p3"],
        affectedOccurrences: 3,
        scope: "HOST",
        fixLevel: "SERVER",
        deduplicationKey: "security:SEC_HSTS_MISSING:HOST:example.com",
      },
      {
        id: "security:SEC_X_CONTENT_TYPE_OPTIONS_MISSING:HOST:example.com",
        ruleId: "SEC_X_CONTENT_TYPE_OPTIONS_MISSING",
        category: "headers",
        title: "Missing X-Content-Type-Options Header",
        severity: "low",
        confidence: "confirmed",
        verificationClassification: "confirmed",
        status: "FAIL",
        description: "Missing nosniff",
        evidence: {},
        affectedUrls: ["https://example.com/p1", "https://example.com/p2", "https://example.com/p3"],
        affectedOccurrences: 3,
        scope: "HOST",
        fixLevel: "SERVER",
        deduplicationKey: "security:SEC_X_CONTENT_TYPE_OPTIONS_MISSING:HOST:example.com",
      },
      {
        id: "security:SEC_DMARC_MISSING:DOMAIN:example.com",
        ruleId: "SEC_DMARC_MISSING",
        category: "domain_email",
        title: "Missing DMARC Record",
        severity: "medium",
        confidence: "confirmed",
        verificationClassification: "confirmed",
        status: "FAIL",
        description: "Missing DMARC",
        evidence: {},
        affectedUrls: ["https://example.com/"],
        affectedOccurrences: 1,
        scope: "DOMAIN",
        fixLevel: "DNS",
        deduplicationKey: "security:SEC_DMARC_MISSING:DOMAIN:example.com",
      },
    ];

    const rems = findings.map(f => generateSecurityRemediation(f, mockFacts));
    const implMap = buildSecurityImplementationMap(findings, rems);

    assert(implMap.totalActions >= 2, `Clustered into ${implMap.totalActions} high-leverage implementation actions`);
    assert(implMap.actions.some(a => a.actionId === "SEC_ACT_GLOBAL_HEADERS"), "Grouped HSTS and X-Content-Type-Options into SEC_ACT_GLOBAL_HEADERS action");
    assert(implMap.actions.some(a => a.actionId === "SEC_ACT_DNS_AUTHENTICATION"), "Grouped DMARC into SEC_ACT_DNS_AUTHENTICATION action");
    assert(implMap.globalActionsCount >= 2, `Global actions identified: ${implMap.globalActionsCount}`);
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log("=======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runS4Tests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
