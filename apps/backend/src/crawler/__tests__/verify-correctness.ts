import { parseHtmlPage } from "../parser";
import { evaluateAllDiagnosticRules } from "../rules";
import { classifyResourceType, normalizeUrl } from "../normalizer";
import type { CrawledPageData } from "../types";

console.log("==========================================");
console.log("RUNNING CRAWLER & DIAGNOSTIC REGRESSION TEST SUITE");
console.log("==========================================\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failed++;
  }
}

// ----------------------------------------------------
// TEST 1: Resource Type Classification
// ----------------------------------------------------
console.log("[Test Suite 1] Resource Type Classification");

const sitemapType = classifyResourceType("https://example.com/sitemap.xml", "application/xml");
assert(sitemapType === "xml_sitemap", "sitemap.xml classified as xml_sitemap");

const cdnType = classifyResourceType("https://example.com/cdn-cgi/l/email-protection#1234", "text/html");
assert(cdnType === "utility_endpoint", "Cloudflare CDN utility URL classified as utility_endpoint");

const imgType = classifyResourceType("https://example.com/assets/logo.png", "image/png");
assert(imgType === "image", "PNG asset classified as image");

const htmlType = classifyResourceType("https://example.com/about-us", "text/html");
assert(htmlType === "html_page", "HTML page classified as html_page");

// ----------------------------------------------------
// TEST 2: Indexability Classification
// ----------------------------------------------------
console.log("\n[Test Suite 2] Indexability Model Statuses");

const sitemapPage = parseHtmlPage(
  "https://example.com/sitemap.xml",
  "https://example.com/sitemap.xml",
  "https://example.com/sitemap.xml",
  200,
  [],
  "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>https://example.com/</loc></url></urlset>",
  { "content-type": "application/xml" },
  100,
  1,
  "https://example.com"
);
assert(!sitemapPage.isIndexable, "sitemap.xml isIndexable is false");
assert(sitemapPage.indexabilityStatus === "utility_resource", "sitemap.xml indexabilityStatus is utility_resource");

const noindexPage = parseHtmlPage(
  "https://example.com/admin",
  "https://example.com/admin",
  "https://example.com/admin",
  200,
  [],
  "<html><head><meta name=\"robots\" content=\"noindex, nofollow\"></head><body>Admin</body></html>",
  { "content-type": "text/html" },
  100,
  1,
  "https://example.com"
);
assert(!noindexPage.isIndexable, "noindex page isIndexable is false");
assert(noindexPage.indexabilityStatus === "intentionally_non_indexable", "noindex page indexabilityStatus is intentionally_non_indexable");

const validHtmlPage = parseHtmlPage(
  "https://example.com/about",
  "https://example.com/about",
  "https://example.com/about",
  200,
  [],
  "<html><head><title>About Us - Solutions</title></head><body><h1>About Us</h1><p>Welcome to our company website with lots of valuable content for all clients.</p></body></html>",
  { "content-type": "text/html" },
  120,
  1,
  "https://example.com"
);
assert(validHtmlPage.isIndexable, "Valid 200 HTML page isIndexable is true");
assert(validHtmlPage.indexabilityStatus === "indexable", "Valid 200 HTML page indexabilityStatus is indexable");

// ----------------------------------------------------
// TEST 3: Heading Outline & Canonical H1 Consistency
// ----------------------------------------------------
console.log("\n[Test Suite 3] Heading Outline & H1 Consistency");

const pageWithH1 = parseHtmlPage(
  "https://example.com/services",
  "https://example.com/services",
  "https://example.com/services",
  200,
  [],
  "<html><head><title>Services</title></head><body><h1>Our Services</h1><h2>Cloud Consulting</h2><h4>Snowflake</h4></body></html>",
  { "content-type": "text/html" },
  100,
  1,
  "https://example.com"
);

assert(pageWithH1.h1Count === 1, "h1Count equals 1");
assert(pageWithH1.h1s[0] === "Our Services", "h1s array contains 'Our Services'");
assert(pageWithH1.headingsHierarchyIssues.length > 0, "Skipped heading detected (H2 -> H4)");
assert(pageWithH1.headingsHierarchyIssues[0].includes("Skipped <h3"), "Heading transition message contains exact skipped level evidence");

// ----------------------------------------------------
// TEST 4: JSON-LD Syntax Error Capture
// ----------------------------------------------------
console.log("\n[Test Suite 4] JSON-LD Malformed Error Capture");

const pageWithMalformedJson = parseHtmlPage(
  "https://example.com/bad-schema",
  "https://example.com/bad-schema",
  "https://example.com/bad-schema",
  200,
  [],
  `<html><head><title>Schema Test</title><script type="application/ld+json">{ "@context": "https://schema.org", "@type": "Organization", "name": "Test", }</script></head><body><h1>Schema</h1></body></html>`,
  { "content-type": "text/html" },
  100,
  1,
  "https://example.com"
);

assert(pageWithMalformedJson.schemaJsonLd.length === 1, "Captured 1 JSON-LD block");
assert(pageWithMalformedJson.schemaJsonLd[0].parsedSuccessfully === false, "parsedSuccessfully is false");
assert(typeof pageWithMalformedJson.schemaJsonLd[0].parserError === "string", "parserError captures exact syntax error string");

// ----------------------------------------------------
// TEST 5: Diagnostic Rules Execution & Exclusion of Non-HTML Resources
// ----------------------------------------------------
console.log("\n[Test Suite 5] Diagnostic Rules Evaluation");

const mockPages: CrawledPageData[] = [
  sitemapPage,
  validHtmlPage,
  pageWithH1,
  pageWithMalformedJson,
];

const mockGraph = {
  brokenInternalLinks: [],
  brokenExternalLinks: [],
  botBlockedExternalLinks: [],
  sitemapOrphans: [],
  crawlIsolatedPages: [],
  totalInternalLinks: 5,
  totalExternalLinks: 0,
  inlinksMap: new Map(),
  externalLinkTelemetry: {
    uniqueExternalUrlsCount: 0,
    totalExternalOccurrences: 0,
    confirmedOkCount: 0,
    redirectedOkCount: 0,
    confirmedBrokenCount: 0,
    botBlockedCount: 0,
    rateLimitedCount: 0,
    timeoutCount: 0,
    networkDnsSslCount: 0,
    excludedPlaceholderHashCount: 0,
    excludedMailtoTelJsCount: 0,
    topExternalDomains: [],
  },
};

const evalResult = evaluateAllDiagnosticRules(mockPages, mockGraph, []);

// sitemap.xml should NOT trigger Missing Title, Missing H1, Missing Canonical, or Thin Content
const missingH1 = evalResult.issues.find((i) => i.code === "CONTENT_MISSING_H1");
const affectedH1Urls = missingH1 ? missingH1.affectedPages.map((a) => a.url) : [];
assert(!affectedH1Urls.includes("https://example.com/sitemap.xml"), "sitemap.xml NOT in Missing H1 issues");
assert(!affectedH1Urls.includes("https://example.com/services"), "Page with H1 NOT in Missing H1 issues");

const missingTitle = evalResult.issues.find((i) => i.code === "CONTENT_MISSING_TITLE");
const affectedTitleUrls = missingTitle ? missingTitle.affectedPages.map((a) => a.url) : [];
assert(!affectedTitleUrls.includes("https://example.com/sitemap.xml"), "sitemap.xml NOT in Missing Title issues");

const schemaMalformed = evalResult.issues.find((i) => i.code === "SCHEMA_MALFORMED_JSON");
assert(Boolean(schemaMalformed), "SCHEMA_MALFORMED_JSON issue generated");
assert(schemaMalformed?.affectedPages[0]?.evidence?.observed?.includes("syntax error"), "SCHEMA_MALFORMED_JSON evidence contains parser error");

// Check Health Score calculation
assert(evalResult.healthScore < 100, "Health Score properly penalized from starting 100");
assert(evalResult.scoreBreakdown.totalDeductions > 0, "Score deductions exist and non-zero");
assert(
  Math.abs(evalResult.healthScore - (100 - evalResult.scoreBreakdown.totalDeductions)) < 0.1,
  "Mathematical equality: healthScore === 100 - totalDeductions"
);

console.log(`\n==========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`==========================================`);

if (failed > 0) {
  process.exit(1);
}
