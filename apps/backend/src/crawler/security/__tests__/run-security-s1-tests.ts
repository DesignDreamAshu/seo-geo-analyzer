/**
 * Standalone Test Runner for Security Evidence Architecture S1.
 * Runs directly with tsx.
 */

import { parseCspHeader, extractCspFactsFromHeaders } from "../parsers/csp-parser";
import { parseHstsHeader, extractHstsFactFromHeaders } from "../parsers/hsts-parser";
import { parseSingleSetCookie, extractCookiesFromHeaders } from "../parsers/cookie-parser";
import { extractAllSecurityHeadersFacts } from "../parsers/headers-parser";
import { extractPageResources, extractAllMixedContent } from "../extractors/resource-extractor";
import { extractPageForms } from "../extractors/form-extractor";
import { matchHostnameToSan, clearTlsFactsCache } from "../extractors/tls-inspector";
import { extractRootDomain, parseDmarcRecord, clearDnsFactsCache } from "../extractors/dns-inspector";
import { buildThirdPartyInventory } from "../extractors/third-party-inventory";
import { redactCookieValue, redactUrlParams, redactHeadersMap, redactEnvSnippet } from "../redaction";
import { collectSecurityFacts, getDefaultSecurityCapabilities } from "../facts-collector";
import type { CrawledPageData } from "../../types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runAllTests() {
  console.log("\n=======================================================");
  console.log("RUNNING SECURITY EVIDENCE ARCHITECTURE (S1) TESTS");
  console.log("=======================================================\n");

  // 1. Secret Redaction
  console.log("1. Secret Redaction Tests");
  assert(redactCookieValue("supersecrettoken12345") === "s***5(len=21)", "Cookie value is structural redacted");
  assert(redactCookieValue("123") === "[REDACTED]", "Short cookie value is completely redacted");

  const urlWithSecret = "https://example.com/api?token=secret123&user=john";
  const redactedUrl = redactUrlParams(urlWithSecret);
  assert(redactedUrl.includes("token=%5BREDACTED%5D") && !redactedUrl.includes("secret123"), "Sensitive query params redacted");

  const headers = { "X-Api-Key": "key123", "Content-Type": "text/html" };
  const redactedHdrs = redactHeadersMap(headers);
  assert(redactedHdrs["X-Api-Key"] === "[REDACTED]", "Sensitive header redacted");

  const rawEnv = "DB_PASSWORD=MySecretPassword!\nPORT=3000";
  const redactedEnv = redactEnvSnippet(rawEnv);
  assert(redactedEnv.includes("DB_PASSWORD=[REDACTED:len=17]") && !redactedEnv.includes("MySecretPassword!"), ".env secrets redacted");

  // 2. CSP Parser
  console.log("\n2. CSP Parser Tests");
  const validCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; object-src 'none'";
  const cspFact = parseCspHeader(validCsp, false);
  assert(cspFact.isEnforced === true, "Enforced CSP recognized");
  assert(cspFact.hasDefaultSrc === true, "default-src detected");
  assert(cspFact.hasScriptSrc === true, "script-src detected");
  assert(cspFact.directives["script-src"].hasUnsafeInline === true, "unsafe-inline detected");
  assert(cspFact.directives["object-src"].hasNone === true, "object-src none detected");

  const reportOnlyCsp = "default-src https:; report-to endpoint";
  const roFact = parseCspHeader(reportOnlyCsp, true);
  assert(roFact.isReportOnly === true && roFact.reportTo === "endpoint", "CSP-Report-Only and report-to parsed");

  const wildcardCsp = "default-src *; script-src http://insecure.com data: 'strict-dynamic'";
  const wildFact = parseCspHeader(wildcardCsp, false);
  assert(wildFact.directives["default-src"].hasWildcard === true, "Wildcard source detected");
  assert(wildFact.directives["script-src"].hasHttpSource === true, "HTTP source in CSP detected");
  assert(wildFact.directives["script-src"].hasStrictDynamic === true, "strict-dynamic in CSP detected");

  // 3. HSTS Parser
  console.log("\n3. HSTS Parser Tests");
  const hsts = parseHstsHeader("max-age=31536000; includeSubDomains; preload");
  assert(hsts?.maxAgeSeconds === 31536000 && hsts?.maxAgeDays === 365, "HSTS max-age seconds and days parsed");
  assert(hsts?.includeSubDomains === true && hsts?.preload === true, "includeSubDomains and preload parsed");

  const zeroHsts = parseHstsHeader("max-age=0");
  assert(zeroHsts?.isZeroMaxAge === true, "Zero max-age flagged");

  const badHsts = parseHstsHeader("includeSubDomains");
  assert(badHsts?.isMalformed === true, "Missing max-age flagged as malformed");

  // 4. Cookie Security Facts
  console.log("\n4. Cookie Security Facts Tests");
  const goodCookie = parseSingleSetCookie(
    "session=abc12345; Path=/; Secure; HttpOnly; SameSite=Strict",
    "https://example.com/login"
  );
  assert(goodCookie?.isSecure === true && goodCookie?.isHttpOnly === true, "Secure and HttpOnly flags parsed");
  assert(goodCookie?.sameSite === "Strict", "SameSite Strict parsed");
  assert(goodCookie?.isSuspectedSessionOrAuth === true, "Session cookie heuristic matched");
  assert(goodCookie?.redactedValue === "a***5(len=8)", "Cookie value redacted in evidence");

  const hostCookieValid = parseSingleSetCookie("__Host-id=123; Path=/; Secure", "https://example.com");
  assert(hostCookieValid?.hasHostPrefix === true && hostCookieValid?.isHostPrefixValid === true, "Valid __Host- cookie recognized");

  const hostCookieInvalid = parseSingleSetCookie("__Host-id=123; Domain=example.com; Path=/; Secure", "https://example.com");
  assert(hostCookieInvalid?.hasHostPrefix === true && hostCookieInvalid?.isHostPrefixValid === false, "Invalid __Host- with Domain rejected");

  const insecureSameSiteNone = parseSingleSetCookie("id=123; SameSite=None; Path=/", "http://example.com");
  assert(insecureSameSiteNone?.isSameSiteNoneWithoutSecure === true, "SameSite=None without Secure flagged");
  assert(insecureSameSiteNone?.setOverInsecureTransport === true, "Insecure transport flagged");

  // 5. Response Headers Parser
  console.log("\n5. Response Headers Parser Tests");
  const secHeaders = extractAllSecurityHeadersFacts({
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "server": "Apache/2.4.51",
    "x-powered-by": "PHP/8.1",
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true",
  });
  assert(secHeaders.xContentTypeOptions?.isNoSniff === true, "nosniff parsed");
  assert(secHeaders.referrerPolicy?.hasStrictOriginWhenCrossOrigin === true, "Referrer policy parsed");
  assert(secHeaders.xFrameOptions?.isDeny === true, "X-Frame-Options DENY parsed");
  assert(secHeaders.cors.isDangerousWildcardCredentialsCombination === true, "Dangerous CORS wildcard + credentials flagged");
  assert(secHeaders.serverDisclosure.disclosedTechnologies.includes("Server: Apache/2.4.51"), "Server technology disclosure parsed");

  // 6. Resources & Mixed Content
  console.log("\n6. Resources & Mixed Content Tests");
  const mockPage: CrawledPageData = {
    url: "https://example.com/test",
    requestedUrl: "https://example.com/test",
    normalizedUrl: "https://example.com/test",
    finalUrl: "https://example.com/test",
    statusCode: 200,
    redirectHops: [],
    contentType: "text/html",
    resourceType: "html_page",
    responseTimeMs: 50,
    depth: 0,
    crawledAt: new Date().toISOString(),
    sourceMode: "raw_http",
    rawWordCount: 50,
    rawDocumentWordCount: 50,
    visibleBodyWordCount: 50,
    mainContentWordCount: 50,
    rawH1Count: 1,
    rawTitle: "Test",
    soft404Status: "valid_page",
    title: "Test",
    titleLength: 4,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonicalUrl: null,
    isCanonicalSelfReferencing: true,
    isCanonicalTargetReachable: true,
    metaRobots: null,
    xRobotsTag: null,
    isIndexable: true,
    indexabilityStatus: "indexable",
    h1s: ["Test"],
    h1Count: 1,
    h1Tags: ["Test"],
    h2Tags: [],
    h3Tags: [],
    headingsOutline: [],
    headingsHierarchyValid: true,
    headingsHierarchyIssues: [],
    wordCount: 50,
    textToHtmlRatio: 0.5,
    landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
    forms: [],
    images: [],
    resources: [],
    outlinks: [],
    openGraph: { rawTags: [], missingRequiredTags: [], duplicateTags: [], emptyTags: [], imageFetchState: "FETCH_NOT_EVALUATED", canonicalConsistent: true, validationStatus: "NOT_EVALUATED" },
    twitterCard: { rawTags: [], missingTags: [], hasExplicitCard: false, hasOgFallback: false, validationStatus: "NOT_EVALUATED" },
    schemaJsonLd: [],
    classification: { primaryClass: "article_blog", confidence: 1.0, signals: [] },
    headers: {},
    html: `
      <script src="/local.js"></script>
      <script src="https://cdn.example.org/lib.js" integrity="sha384-abcdef123456789="></script>
      <script src="http://insecure-cdn.com/mixed-script.js"></script>
      <img src="http://insecure-cdn.com/mixed-img.jpg" />
    `,
  };

  const resList = extractPageResources(mockPage, "https://example.com");
  assert(resList.length === 4, "All 4 page resources extracted");

  const firstParty = resList.find((r) => r.rawUrl === "/local.js");
  assert(firstParty?.isFirstParty === true, "Local script identified as first-party");

  const sriRes = resList.find((r) => r.rawUrl.includes("cdn.example.org"));
  assert(sriRes?.hasIntegrity === true && sriRes?.hasValidSriHash === true, "Valid SRI hash recognized");

  const mixedActive = resList.find((r) => r.rawUrl.includes("mixed-script.js"));
  assert(mixedActive?.isMixedActiveContent === true, "Mixed active script detected");

  const mixedPassive = resList.find((r) => r.rawUrl.includes("mixed-img.jpg"));
  assert(mixedPassive?.isMixedPassiveContent === true, "Mixed passive image detected");

  const mixedAll = extractAllMixedContent(resList);
  assert(mixedAll.length === 2, "All mixed content occurrences grouped");

  // 7. Form Security
  console.log("\n7. Form Security Tests");
  const formPage: CrawledPageData = {
    ...mockPage,
    html: `
      <form action="http://auth.insecure.com/login" method="POST">
        <input type="password" name="password" />
        <input type="hidden" name="csrf_token" value="xyz" />
      </form>
      <form action="/query" method="GET">
        <input type="password" name="pwd" />
      </form>
    `,
  };
  const forms = extractPageForms(formPage);
  assert(forms.length === 2, "Both forms extracted");
  assert(forms[0].actionIsInsecureHttp === true && forms[0].isCrossDomainAction === true, "Insecure HTTP & cross-domain form action identified");
  assert(forms[0].hasVisibleCsrfTokenCandidate === true && forms[0].csrfTokenNameCandidate === "csrf_token", "CSRF token candidate detected");
  assert(forms[1].hasSensitiveInputInGetForm === true, "Password field in GET form identified");

  // 8. TLS SAN Matching & Root Domain (PSL-Aware)
  console.log("\n8. TLS SAN Matching & Root Domain Tests");
  assert(matchHostnameToSan("example.com", "example.com") === true, "Exact SAN host match");
  assert(matchHostnameToSan("app.example.com", "*.example.com") === true, "Wildcard SAN match");
  assert(matchHostnameToSan("deep.app.example.com", "*.example.com") === false, "Different level SAN mismatch");
  assert(matchHostnameToSan("other.com", "*.example.com") === false, "Different domain SAN mismatch");

  // Public-Suffix-Aware Domain Extraction Edge Cases
  assert(extractRootDomain("api.store.example.com") === "example.com", "Root domain extracted from subdomains");
  assert(extractRootDomain("store.brand.co.uk") === "brand.co.uk", "Root domain extracted for .co.uk");
  assert(extractRootDomain("app.service.com.au") === "service.com.au", "Root domain extracted for .com.au");
  assert(extractRootDomain("portal.gov.in") === "portal.gov.in", "Root domain extracted for .gov.in");
  assert(extractRootDomain("deep.sub.domain.co.in") === "domain.co.in", "Root domain extracted for .co.in");
  assert(extractRootDomain("localhost") === "localhost", "Localhost preserved");
  assert(extractRootDomain("192.168.1.100") === "192.168.1.100", "IPv4 address preserved");
  assert(extractRootDomain("sub.mydev.local") === "sub.mydev.local", "Local development domain preserved");

  // DMARC & SPF Parsing
  const dmarc = parseDmarcRecord("v=DMARC1; p=reject; sp=quarantine; pct=100; rua=mailto:dmarc@test.com; ruf=mailto:forensics@test.com");
  assert(dmarc.policy === "reject" && dmarc.subdomainPolicy === "quarantine" && dmarc.percentage === 100, "DMARC policy parsed");
  assert(dmarc.rua?.[0] === "mailto:dmarc@test.com" && dmarc.ruf?.[0] === "mailto:forensics@test.com", "DMARC rua/ruf parsed");

  // 9. Third-Party Inventory
  console.log("\n9. Third-Party Inventory Tests");
  const inventory = buildThirdPartyInventory(resList);
  assert(inventory.thirdPartyOriginsCount === 2, "Deduplicated third party origins count");
  assert(inventory.totalThirdPartyResources === 3, "Total third party resources count");

  // 10. Cache Deduplication & Capabilities
  console.log("\n10. Cache Deduplication & Capabilities Tests");
  clearTlsFactsCache();
  clearDnsFactsCache();

  const caps = getDefaultSecurityCapabilities(true);
  assert(caps.securityHeaderAnalysis === "AVAILABLE", "Header analysis capability AVAILABLE");
  assert(caps.tlsDeprecatedProtocolProbing === "NOT_AVAILABLE", "Deprecated protocol probing NOT_AVAILABLE");
  assert(caps.dnssecValidation === "NOT_OBSERVABLE", "DNSSEC capability NOT_OBSERVABLE");
  assert(caps.activeExploitationTesting === "NOT_AVAILABLE", "Active testing NOT_AVAILABLE");

  const facts = await collectSecurityFacts([mockPage], {
    seedUrl: "https://example.com",
    skipNetworkProbes: true,
  });
  assert(facts.targetDomain === "example.com", "Target domain assigned");
  assert(facts.resources.length === 4, "Resources aggregated in SecurityAuditFacts");
  assert(facts.platform.detectedPlatform === "generic_html" || facts.platform.detectedPlatform !== undefined, "Platform facts attached");

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner execution failed:", err);
  process.exit(1);
});
