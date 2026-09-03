/**
 * Test Suite for Security Evidence Architecture (SECURITY S1).
 * Validates deterministic parsing, facts extraction, secret redaction, and capability reporting.
 */

import { describe, it, expect } from "vitest";
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

describe("Security S1: Secret Redaction Engine", () => {
  it("redacts sensitive cookie values while preserving presence and length", () => {
    expect(redactCookieValue("")).toBe("");
    expect(redactCookieValue("1234")).toBe("[REDACTED]");
    expect(redactCookieValue("supersecrettoken12345")).toBe("s***5(len=21)");
  });

  it("redacts sensitive query parameters from URLs", () => {
    const url = "https://example.com/api/v1?user=ashu&token=my_secret_jwt_token&api_key=12345";
    const redacted = redactUrlParams(url);
    expect(redacted).toContain("user=ashu");
    expect(redacted).toContain("token=%5BREDACTED%5D");
    expect(redacted).toContain("api_key=%5BREDACTED%5D");
    expect(redacted).not.toContain("my_secret_jwt_token");
    expect(redacted).not.toContain("12345");
  });

  it("redacts sensitive HTTP headers map", () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer super-secret-jwt-token",
      "X-Api-Key": "secret-key-1234",
      "Set-Cookie": ["session=abcdef; Path=/; Secure"],
    };
    const redacted = redactHeadersMap(headers);
    expect(redacted["Content-Type"]).toBe("application/json");
    expect(redacted["Authorization"]).toBe("[REDACTED]");
    expect(redacted["X-Api-Key"]).toBe("[REDACTED]");
    expect(redacted["Set-Cookie"]).toEqual(["[REDACTED]"]);
  });

  it("redacts sensitive environment file snippets", () => {
    const rawEnv = `
# Production Database
DB_HOST=127.0.0.1
DB_PASSWORD=SuperSecretDatabasePassword123!
APP_SECRET=xyz987654321
PORT=3000
    `;
    const redacted = redactEnvSnippet(rawEnv);
    expect(redacted).toContain("DB_PASSWORD=[REDACTED:len=31]");
    expect(redacted).toContain("APP_SECRET=[REDACTED:len=12]");
    expect(redacted).toContain("PORT=3000");
    expect(redacted).not.toContain("SuperSecretDatabasePassword123!");
    expect(redacted).not.toContain("xyz987654321");
  });
});

describe("Security S1: CSP Parser", () => {
  it("parses valid CSP header with multiple directives", () => {
    const raw =
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; style-src 'self' 'unsafe-eval'; object-src 'none'; frame-ancestors 'self' https://trusted.com";
    const fact = parseCspHeader(raw, false);

    expect(fact.isEnforced).toBe(true);
    expect(fact.isReportOnly).toBe(false);
    expect(fact.hasDefaultSrc).toBe(true);
    expect(fact.hasScriptSrc).toBe(true);
    expect(fact.hasStyleSrc).toBe(true);
    expect(fact.hasObjectSrc).toBe(true);
    expect(fact.hasFrameAncestors).toBe(true);
    expect(fact.directives["script-src"].hasUnsafeInline).toBe(true);
    expect(fact.directives["script-src"].hasUnsafeEval).toBe(false);
    expect(fact.directives["style-src"].hasUnsafeEval).toBe(true);
    expect(fact.directives["object-src"].hasNone).toBe(true);
    expect(fact.directives["frame-ancestors"].sources).toContain("https://trusted.com");
  });

  it("parses CSP-Report-Only header and report-to directive", () => {
    const raw = "default-src https:; report-to csp-endpoint; report-uri /csp-report";
    const fact = parseCspHeader(raw, true);

    expect(fact.isReportOnly).toBe(true);
    expect(fact.isEnforced).toBe(false);
    expect(fact.reportTo).toBe("csp-endpoint");
    expect(fact.reportUri).toBe("/csp-report");
  });

  it("handles wildcard sources and HTTP sources in CSP", () => {
    const raw = "default-src *; script-src http://insecure.example.com data: 'strict-dynamic'";
    const fact = parseCspHeader(raw, false);

    expect(fact.directives["default-src"].hasWildcard).toBe(true);
    expect(fact.directives["script-src"].hasHttpSource).toBe(true);
    expect(fact.directives["script-src"].hasDataUri).toBe(true);
    expect(fact.directives["script-src"].hasStrictDynamic).toBe(true);
  });

  it("extracts multiple CSP headers correctly", () => {
    const headers = {
      "content-security-policy": "default-src 'self'",
      "content-security-policy-report-only": "script-src https:",
    };
    const { enforced, reportOnly } = extractCspFactsFromHeaders(headers);
    expect(enforced.length).toBe(1);
    expect(reportOnly.length).toBe(1);
    expect(enforced[0].hasDefaultSrc).toBe(true);
    expect(reportOnly[0].hasScriptSrc).toBe(true);
  });
});

describe("Security S1: HSTS Parser", () => {
  it("parses valid HSTS header with max-age, includeSubDomains, and preload", () => {
    const raw = "max-age=31536000; includeSubDomains; preload";
    const fact = parseHstsHeader(raw);

    expect(fact).not.toBeNull();
    expect(fact?.maxAgeSeconds).toBe(31536000);
    expect(fact?.maxAgeDays).toBe(365);
    expect(fact?.includeSubDomains).toBe(true);
    expect(fact?.preload).toBe(true);
    expect(fact?.isMalformed).toBe(false);
  });

  it("detects zero max-age (HSTS deletion directive)", () => {
    const fact = parseHstsHeader("max-age=0");
    expect(fact?.maxAgeSeconds).toBe(0);
    expect(fact?.isZeroMaxAge).toBe(true);
    expect(fact?.includeSubDomains).toBe(false);
  });

  it("flags malformed HSTS headers", () => {
    const fact = parseHstsHeader("includeSubDomains; preload");
    expect(fact?.isMalformed).toBe(true);
    expect(fact?.maxAgeSeconds).toBeNull();
    expect(fact?.parseErrors.length).toBeGreaterThan(0);
  });
});

describe("Security S1: Cookie Security Facts", () => {
  it("parses secure cookie with all attributes and redacts value", () => {
    const raw = "session_token=secret_123456789; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600";
    const fact = parseSingleSetCookie(raw, "https://example.com/login");

    expect(fact).not.toBeNull();
    expect(fact?.cookieName).toBe("session_token");
    expect(fact?.redactedValue).toBe("s***9(len=16)");
    expect(fact?.isSecure).toBe(true);
    expect(fact?.isHttpOnly).toBe(true);
    expect(fact?.sameSite).toBe("Strict");
    expect(fact?.path).toBe("/");
    expect(fact?.maxAgeSeconds).toBe(3600);
    expect(fact?.setOverInsecureTransport).toBe(false);
    expect(fact?.isSuspectedSessionOrAuth).toBe(true);
  });

  it("validates __Host- and __Secure- cookie prefix rules", () => {
    // Valid __Host- cookie
    const validHost = parseSingleSetCookie(
      "__Host-user=12345; Path=/; Secure; HttpOnly",
      "https://example.com"
    );
    expect(validHost?.hasHostPrefix).toBe(true);
    expect(validHost?.isHostPrefixValid).toBe(true);

    // Invalid __Host- cookie (has Domain attribute)
    const invalidHostDomain = parseSingleSetCookie(
      "__Host-user=12345; Domain=example.com; Path=/; Secure",
      "https://example.com"
    );
    expect(invalidHostDomain?.hasHostPrefix).toBe(true);
    expect(invalidHostDomain?.isHostPrefixValid).toBe(false);

    // Invalid __Host- cookie (missing Secure)
    const invalidHostSecure = parseSingleSetCookie(
      "__Host-user=12345; Path=/",
      "https://example.com"
    );
    expect(invalidHostSecure?.isHostPrefixValid).toBe(false);
  });

  it("detects SameSite=None without Secure and insecure transport", () => {
    const fact = parseSingleSetCookie(
      "tracking_id=xyz789; SameSite=None; Path=/",
      "http://insecure.example.com"
    );
    expect(fact?.sameSite).toBe("None");
    expect(fact?.isSecure).toBe(false);
    expect(fact?.isSameSiteNoneWithoutSecure).toBe(true);
    expect(fact?.setOverInsecureTransport).toBe(true);
  });

  it("extracts multiple Set-Cookie headers from headers map", () => {
    const headers = {
      "set-cookie": [
        "auth=tok123; Secure; HttpOnly",
        "theme=dark; Path=/",
      ],
    };
    const cookies = extractCookiesFromHeaders(headers, "https://example.com");
    expect(cookies.length).toBe(2);
    expect(cookies[0].cookieName).toBe("auth");
    expect(cookies[0].isHttpOnly).toBe(true);
    expect(cookies[1].cookieName).toBe("theme");
    expect(cookies[1].isHttpOnly).toBe(false);
  });
});

describe("Security S1: Security Response Headers Parser", () => {
  it("parses X-Content-Type-Options, Referrer-Policy, and X-Frame-Options", () => {
    const headers = {
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-frame-options": "DENY",
      "server": "nginx/1.24.0",
      "x-powered-by": "PHP/8.2.1",
    };
    const facts = extractAllSecurityHeadersFacts(headers);

    expect(facts.xContentTypeOptions?.isNoSniff).toBe(true);
    expect(facts.referrerPolicy?.hasStrictOriginWhenCrossOrigin).toBe(true);
    expect(facts.xFrameOptions?.isDeny).toBe(true);
    expect(facts.serverDisclosure.hasServerHeader).toBe(true);
    expect(facts.serverDisclosure.disclosedTechnologies).toContain("Server: nginx/1.24.0");
    expect(facts.serverDisclosure.disclosedTechnologies).toContain("X-Powered-By: PHP/8.2.1");
  });

  it("detects CORS wildcard and credentials combination", () => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    const facts = extractAllSecurityHeadersFacts(headers);

    expect(facts.cors.isWildcardOrigin).toBe(true);
    expect(facts.cors.isAllowCredentialsTrue).toBe(true);
    expect(facts.cors.isDangerousWildcardCredentialsCombination).toBe(true);
    expect(facts.cors.allowMethods).toContain("POST");
  });
});

describe("Security S1: Resource & Mixed Content Extraction", () => {
  it("extracts resources, classifies first-party vs third-party, and detects SRI", () => {
    const mockPage: CrawledPageData = {
      url: "https://example.com/page",
      requestedUrl: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      finalUrl: "https://example.com/page",
      statusCode: 200,
      redirectHops: [],
      contentType: "text/html",
      resourceType: "html_page",
      responseTimeMs: 100,
      depth: 0,
      crawledAt: new Date().toISOString(),
      sourceMode: "raw_http",
      rawWordCount: 100,
      rawDocumentWordCount: 100,
      visibleBodyWordCount: 100,
      mainContentWordCount: 100,
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
      wordCount: 100,
      textToHtmlRatio: 0.5,
      landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
      forms: [],
      images: [],
      resources: [],
      outlinks: [],
      openGraph: { rawTags: [], missingRequiredTags: [], duplicateTags: [], emptyTags: [], imageFetchState: "FETCH_NOT_EVALUATED", canonicalConsistent: true, validationStatus: "NOT_EVALUATED" },
      twitterCard: { rawTags: [], missingTags: [], hasExplicitCard: false, hasOgFallback: false, validationStatus: "NOT_EVALUATED" },
      schemaJsonLd: [],
      classification: { primaryClass: "marketing_landing", confidence: 1.0, signals: [] },
      headers: {},
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="/assets/style.css" />
            <script src="https://cdn.jsdelivr.net/npm/vue@3.0.0/dist/vue.global.js" integrity="sha256-abcdef123456=" crossorigin="anonymous"></script>
            <script src="http://insecure-cdn.com/bad-script.js"></script>
          </head>
          <body>
            <img src="http://insecure-cdn.com/banner.png" />
          </body>
        </html>
      `,
    };

    const resources = extractPageResources(mockPage, "https://example.com");
    expect(resources.length).toBe(4);

    const firstParty = resources.find((r) => r.rawUrl === "/assets/style.css");
    expect(firstParty?.isFirstParty).toBe(true);
    expect(firstParty?.isHttps).toBe(true);

    const jsdelivr = resources.find((r) => r.rawUrl.includes("cdn.jsdelivr.net"));
    expect(jsdelivr?.isThirdParty).toBe(true);
    expect(jsdelivr?.hasIntegrity).toBe(true);
    expect(jsdelivr?.hasValidSriHash).toBe(true);

    const mixedActive = resources.find((r) => r.rawUrl.includes("bad-script.js"));
    expect(mixedActive?.isMixedContent).toBe(true);
    expect(mixedActive?.isMixedActiveContent).toBe(true);

    const mixedPassive = resources.find((r) => r.rawUrl.includes("banner.png"));
    expect(mixedPassive?.isMixedContent).toBe(true);
    expect(mixedPassive?.isMixedPassiveContent).toBe(true);

    const allMixed = extractAllMixedContent(resources);
    expect(allMixed.length).toBe(2);
  });
});

describe("Security S1: Form Security Facts", () => {
  it("extracts form actions, password fields, sensitive GET detection, and CSRF token candidate", () => {
    const mockPage: CrawledPageData = {
      url: "https://example.com/checkout",
      requestedUrl: "https://example.com/checkout",
      normalizedUrl: "https://example.com/checkout",
      finalUrl: "https://example.com/checkout",
      statusCode: 200,
      redirectHops: [],
      contentType: "text/html",
      resourceType: "html_page",
      responseTimeMs: 100,
      depth: 0,
      crawledAt: new Date().toISOString(),
      sourceMode: "raw_http",
      rawWordCount: 100,
      rawDocumentWordCount: 100,
      visibleBodyWordCount: 100,
      mainContentWordCount: 100,
      rawH1Count: 1,
      rawTitle: "Checkout",
      soft404Status: "valid_page",
      title: "Checkout",
      titleLength: 8,
      metaDescription: null,
      metaDescriptionLength: 0,
      canonicalUrl: null,
      isCanonicalSelfReferencing: true,
      isCanonicalTargetReachable: true,
      metaRobots: null,
      xRobotsTag: null,
      isIndexable: true,
      indexabilityStatus: "indexable",
      h1s: ["Checkout"],
      h1Count: 1,
      h1Tags: ["Checkout"],
      h2Tags: [],
      h3Tags: [],
      headingsOutline: [],
      headingsHierarchyValid: true,
      headingsHierarchyIssues: [],
      wordCount: 100,
      textToHtmlRatio: 0.5,
      landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
      forms: [],
      images: [],
      resources: [],
      outlinks: [],
      openGraph: { rawTags: [], missingRequiredTags: [], duplicateTags: [], emptyTags: [], imageFetchState: "FETCH_NOT_EVALUATED", canonicalConsistent: true, validationStatus: "NOT_EVALUATED" },
      twitterCard: { rawTags: [], missingTags: [], hasExplicitCard: false, hasOgFallback: false, validationStatus: "NOT_EVALUATED" },
      schemaJsonLd: [],
      classification: { primaryClass: "form_application", confidence: 1.0, signals: [] },
      headers: {},
      html: `
        <form action="http://insecure-api.com/submit" method="POST">
          <input type="hidden" name="_csrf" value="token123" />
          <input type="password" name="password" autocomplete="current-password" />
        </form>
        <form action="/search" method="GET">
          <input type="password" name="user_secret" />
        </form>
      `,
    };

    const forms = extractPageForms(mockPage);
    expect(forms.length).toBe(2);

    // Form 1
    expect(forms[0].actionIsInsecureHttp).toBe(true);
    expect(forms[0].isCrossDomainAction).toBe(true);
    expect(forms[0].method).toBe("POST");
    expect(forms[0].hasPasswordInput).toBe(true);
    expect(forms[0].hasVisibleCsrfTokenCandidate).toBe(true);
    expect(forms[0].csrfTokenNameCandidate).toBe("_csrf");

    // Form 2: GET form containing sensitive password input
    expect(forms[1].method).toBe("GET");
    expect(forms[1].hasSensitiveInputInGetForm).toBe(true);
  });
});

describe("Security S1: TLS SAN Matching & Root Domain Extraction", () => {
  it("matches hostnames to SAN wildcard patterns correctly", () => {
    expect(matchHostnameToSan("example.com", "example.com")).toBe(true);
    expect(matchHostnameToSan("app.example.com", "*.example.com")).toBe(true);
    expect(matchHostnameToSan("deep.app.example.com", "*.example.com")).toBe(false);
    expect(matchHostnameToSan("other.com", "*.example.com")).toBe(false);
  });

  it("extracts root domain candidate including two-part TLDs", () => {
    expect(extractRootDomain("app.example.com")).toBe("example.com");
    expect(extractRootDomain("store.brand.co.uk")).toBe("brand.co.uk");
    expect(extractRootDomain("localhost")).toBe("localhost");
  });

  it("parses DMARC policy tags accurately", () => {
    const dmarc = "v=DMARC1; p=reject; sp=quarantine; pct=100; rua=mailto:dmarc@example.com; ruf=mailto:forensics@example.com";
    const parsed = parseDmarcRecord(dmarc);

    expect(parsed.policy).toBe("reject");
    expect(parsed.subdomainPolicy).toBe("quarantine");
    expect(parsed.percentage).toBe(100);
    expect(parsed.rua).toEqual(["mailto:dmarc@example.com"]);
    expect(parsed.ruf).toEqual(["mailto:forensics@example.com"]);
  });
});

describe("Security S1: Third-Party Origin Inventory", () => {
  it("deduplicates external origins and calculates SRI metrics", () => {
    const resources = [
      {
        rawUrl: "https://cdn.example.org/lib.js",
        resolvedAbsoluteUrl: "https://cdn.example.org/lib.js",
        resourceOrigin: "https://cdn.example.org",
        resourceType: "script" as const,
        isFirstParty: false,
        isThirdParty: true,
        isHttps: true,
        isInsecureHttp: false,
        sourcePageUrl: "https://site.com/p1",
        sourcePageIsHttps: true,
        isMixedContent: false,
        isMixedActiveContent: false,
        isMixedPassiveContent: false,
        hasIntegrity: true,
        integrityAttribute: "sha256-abc",
        hasValidSriHash: true,
        crossOriginAttribute: null,
      },
      {
        rawUrl: "https://cdn.example.org/style.css",
        resolvedAbsoluteUrl: "https://cdn.example.org/style.css",
        resourceOrigin: "https://cdn.example.org",
        resourceType: "stylesheet" as const,
        isFirstParty: false,
        isThirdParty: true,
        isHttps: true,
        isInsecureHttp: false,
        sourcePageUrl: "https://site.com/p2",
        sourcePageIsHttps: true,
        isMixedContent: false,
        isMixedActiveContent: false,
        isMixedPassiveContent: false,
        hasIntegrity: false,
        integrityAttribute: null,
        hasValidSriHash: false,
        crossOriginAttribute: null,
      },
    ];

    const inventory = buildThirdPartyInventory(resources);
    expect(inventory.thirdPartyOriginsCount).toBe(1);
    expect(inventory.totalThirdPartyResources).toBe(2);

    const cdn = inventory.thirdPartyOrigins[0];
    expect(cdn.origin).toBe("https://cdn.example.org");
    expect(cdn.resourceCount).toBe(2);
    expect(cdn.affectedPagesCount).toBe(2);
    expect(cdn.sriCoverage.totalApplicableResources).toBe(2);
    expect(cdn.sriCoverage.resourcesWithSri).toBe(1);
    expect(cdn.sriCoverage.resourcesWithoutSri).toBe(1);
  });
});

describe("Security S1: Security Facts Collector & Capabilities", () => {
  it("returns explicit capability matrix and truthful DNSSEC status", () => {
    const caps = getDefaultSecurityCapabilities(false);
    expect(caps.securityHeaderAnalysis).toBe("AVAILABLE");
    expect(caps.tlsCertificateInspection).toBe("AVAILABLE");
    expect(caps.tlsDeprecatedProtocolProbing).toBe("NOT_AVAILABLE");
    expect(caps.dnssecValidation).toBe("NOT_OBSERVABLE");
    expect(caps.activeExploitationTesting).toBe("NOT_AVAILABLE");
  });

  it("orchestrates facts collection across crawled pages cleanly", async () => {
    clearTlsFactsCache();
    clearDnsFactsCache();

    const mockPage: CrawledPageData = {
      url: "https://example.com",
      requestedUrl: "https://example.com",
      normalizedUrl: "https://example.com",
      finalUrl: "https://example.com",
      statusCode: 200,
      redirectHops: [],
      contentType: "text/html",
      resourceType: "html_page",
      responseTimeMs: 80,
      depth: 0,
      crawledAt: new Date().toISOString(),
      sourceMode: "raw_http",
      rawWordCount: 50,
      rawDocumentWordCount: 50,
      visibleBodyWordCount: 50,
      mainContentWordCount: 50,
      rawH1Count: 1,
      rawTitle: "Home",
      soft404Status: "valid_page",
      title: "Home",
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
      h1s: ["Home"],
      h1Count: 1,
      h1Tags: ["Home"],
      h2Tags: [],
      h3Tags: [],
      headingsOutline: [],
      headingsHierarchyValid: true,
      headingsHierarchyIssues: [],
      wordCount: 50,
      textToHtmlRatio: 0.4,
      landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
      forms: [],
      images: [],
      resources: [],
      outlinks: [],
      openGraph: { rawTags: [], missingRequiredTags: [], duplicateTags: [], emptyTags: [], imageFetchState: "FETCH_NOT_EVALUATED", canonicalConsistent: true, validationStatus: "NOT_EVALUATED" },
      twitterCard: { rawTags: [], missingTags: [], hasExplicitCard: false, hasOgFallback: false, validationStatus: "NOT_EVALUATED" },
      schemaJsonLd: [],
      classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
      headers: {
        "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
        "x-content-type-options": "nosniff",
        "set-cookie": ["session=12345; Secure; HttpOnly"],
      },
      html: `<html><head><script src="https://cdn.example.com/app.js"></script></head><body><form action="/login" method="POST"><input type="password" name="pwd" /></form></body></html>`,
    };

    const facts = await collectSecurityFacts([mockPage], {
      seedUrl: "https://example.com",
      skipNetworkProbes: true, // test offline
    });

    expect(facts.targetDomain).toBe("example.com");
    expect(facts.cookies.length).toBe(1);
    expect(facts.cookies[0].isSecure).toBe(true);
    expect(facts.resources.length).toBe(1);
    expect(facts.forms.length).toBe(1);
    expect(facts.forms[0].hasPasswordInput).toBe(true);
    expect(facts.securityHeadersByUrl["https://example.com"].hsts?.maxAgeSeconds).toBe(63072000);
    expect(facts.securityHeadersByUrl["https://example.com"].xContentTypeOptions?.isNoSniff).toBe(true);
  });
});
