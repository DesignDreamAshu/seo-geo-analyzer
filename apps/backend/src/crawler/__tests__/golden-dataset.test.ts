import { parseHtmlPage } from "../parser";
import { evaluateAllDiagnosticRules } from "../rules";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("  GOLDEN DATASET & FACTUAL PARITY REGRESSION SUITE");
console.log("=======================================================\n");

// 1. Sitemap.xml fixture
const sitemapPage = parseHtmlPage(
  "https://www.botconsulting.io/sitemap.xml",
  "https://www.botconsulting.io/sitemap.xml",
  "https://www.botconsulting.io/sitemap.xml",
  200,
  [],
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.botconsulting.io/</loc></url></urlset>`,
  { "content-type": "application/xml" },
  120,
  1,
  "https://www.botconsulting.io"
);
assert(sitemapPage.resourceType === "xml_sitemap", "sitemap.xml correctly classified as xml_sitemap");
assert(!sitemapPage.isIndexable, "sitemap.xml is non-indexable utility");
assert(sitemapPage.indexabilityStatus === "utility_resource", "sitemap.xml indexabilityStatus === 'utility_resource'");

// 2. Cloudflare utility endpoint fixture
const cdnPage = parseHtmlPage(
  "https://www.botconsulting.io/cdn-cgi/l/email-protection#123",
  "https://www.botconsulting.io/cdn-cgi/l/email-protection#123",
  "https://www.botconsulting.io/cdn-cgi/l/email-protection#123",
  200,
  [],
  `<html><body>Cloudflare email protection</body></html>`,
  { "content-type": "text/html" },
  80,
  2,
  "https://www.botconsulting.io"
);
assert(cdnPage.resourceType === "utility_endpoint", "Cloudflare /cdn-cgi/ classified as utility_endpoint");
assert(!cdnPage.isIndexable, "Cloudflare /cdn-cgi/ is non-indexable");

// 3. Homepage fixture with accessible logo link and main landmark
const homePage = parseHtmlPage(
  "https://www.botconsulting.io/",
  "https://www.botconsulting.io/",
  "https://www.botconsulting.io/",
  200,
  [],
  `<!DOCTYPE html>
  <html lang="en">
  <head>
    <title>BOT Consulting | Enterprise Cloud & AI Engineering</title>
    <meta name="description" content="BOT Consulting delivers enterprise AI engineering, cloud transformation, and data architecture solutions for modern organizations.">
    <link rel="canonical" href="https://www.botconsulting.io/">
  </head>
  <body>
    <header>
      <nav>
        <a href="/" class="brand-logo"><img src="/logo.svg" alt="BOT Consulting" width="120" height="40"></a>
        <a href="/about-us">About Us</a>
        <a href="/solutions">Solutions</a>
        <a href="#" class="mobile-menu-trigger"></a>
      </nav>
    </header>
    <main>
      <h1>Enterprise Cloud & AI Solutions</h1>
      <p>We architect scalable, high-performance data systems and machine learning platforms that accelerate business growth and operational velocity across global enterprises with deep technical expertise.</p>
      <p>Our consulting practice specializes in Snowflake, Databricks, AWS, and GCP migrations with robust data governance frameworks designed for mission-critical enterprise scale and reliability.</p>
      <h2>Our Core Capabilities</h2>
      <p>From data lakehouse modernizations to real-time predictive analytics pipelines, our senior architects craft resilient software architectures tailored to your precise strategic objectives.</p>
    </main>
    <footer>
      <p>&copy; 2026 BOT Consulting</p>
    </footer>
  </body>
  </html>`,
  { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" },
  110,
  0,
  "https://www.botconsulting.io"
);
assert(homePage.h1Count === 1, "Homepage H1 count === 1");
assert(homePage.h1s[0] === "Enterprise Cloud & AI Solutions", "Homepage H1 text extracted accurately");
assert(homePage.landmarks.hasMain, "Homepage contains semantic <main> landmark");
assert(homePage.landmarks.mainCount === 1, "Homepage contains exactly 1 <main> landmark");

// Verify accessible link logic on homepage
const logoOutlink = homePage.outlinks.find((o) => o.targetUrl === "/");
assert(Boolean(logoOutlink?.hasAccessibleName), "Logo link with <img alt='BOT Consulting'> computed as accessible");
assert(logoOutlink?.accessibleName === "BOT Consulting", "Accessible name matches image alt attribute");

const hashOutlink = homePage.outlinks.find((o) => o.rawHref === "#");
assert(hashOutlink?.linkClassification === "placeholder_hash", "href='#' classified as placeholder_hash");

// 4. Multiple H1 fixture on /solutions
const solutionsPage = parseHtmlPage(
  "https://www.botconsulting.io/solutions",
  "https://www.botconsulting.io/solutions",
  "https://www.botconsulting.io/solutions",
  200,
  [],
  `<!DOCTYPE html>
  <html>
  <head>
    <title>Solutions | BOT Consulting</title>
    <meta name="description" content="Explore our enterprise data engineering and cloud solutions portfolio.">
    <link rel="canonical" href="https://www.botconsulting.io/solutions">
  </head>
  <body>
    <main>
      <h1>Enterprise Solutions</h1>
      <p>Comprehensive technology advisory and execution for data leaders.</p>
      <h1>Cloud Transformation & AI Strategy</h1>
      <p>Accelerating migration timelines and modernizing legacy data warehouses.</p>
      <h2>Data Architecture</h2>
      <p>Designing modern lakehouses on Databricks and Snowflake.</p>
      <h2>AI & ML Engineering</h2>
      <p>Productionizing generative AI and real-time inference systems.</p>
    </main>
  </body>
  </html>`,
  { "content-type": "text/html" },
  130,
  1,
  "https://www.botconsulting.io"
);
assert(solutionsPage.h1Count === 2, "/solutions has h1Count === 2");

// 5. Missing H1 fixture on /servicenow-at-bot
const servicenowPage = parseHtmlPage(
  "https://www.botconsulting.io/servicenow-at-bot",
  "https://www.botconsulting.io/servicenow-at-bot",
  "https://www.botconsulting.io/servicenow-at-bot",
  200,
  [],
  `<!DOCTYPE html>
  <html>
  <head>
    <title>ServiceNow Solutions | BOT Consulting</title>
    <meta name="description" content="Custom ServiceNow implementations and workflow automation services.">
    <link rel="canonical" href="https://www.botconsulting.io/servicenow-at-bot">
  </head>
  <body>
    <main>
      <h2>ServiceNow Capabilities</h2>
      <p>Streamline IT service management and enterprise workflow automation.</p>
      <h3>ITOM & ITSM Integration</h3>
      <p>Seamlessly integrate monitoring systems with ServiceNow incident flows.</p>
    </main>
  </body>
  </html>`,
  { "content-type": "text/html" },
  140,
  1,
  "https://www.botconsulting.io"
);
assert(servicenowPage.h1Count === 0, "/servicenow-at-bot has h1Count === 0");

// 6. Dynamic Client-Rendered Job Page fixture
const dynamicJobPage = parseHtmlPage(
  "https://www.botconsulting.io/job-openings/data-architect",
  "https://www.botconsulting.io/job-openings/data-architect",
  "https://www.botconsulting.io/job-openings/data-architect",
  200,
  [],
  `<!DOCTYPE html>
  <html>
  <head>
    <title>Bot Consulting</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Lead Data Architect",
        "description": "We are seeking a seasoned Principal Data Architect with 10+ years designing enterprise Snowflake and Databricks data lakehouses, leading distributed engineering teams, and establishing enterprise data governance.",
        "datePosted": "2026-02-01"
      }
    </script>
  </head>
  <body>
    <div id="__next">
      <div class="job-container">
        <!-- JS-rendered content placeholder -->
      </div>
    </div>
  </body>
  </html>`,
  { "content-type": "text/html" },
  120,
  1,
  "https://www.botconsulting.io"
);
assert(dynamicJobPage.classification.primaryClass === "active_job", "Dynamic job page classified as active_job");
assert(dynamicJobPage.renderMode === "schema_enriched", "Dynamic shell detected -> renderMode === schema_enriched");
assert(dynamicJobPage.structuredDataJobTitle === "Lead Data Architect", "Extracted job title from JSON-LD schema -> structuredDataJobTitle");
assert(dynamicJobPage.h1Count === 0, "DOM H1 remains 0 without fabrication");
assert(dynamicJobPage.wordCount > 20, "Extracted description words from JSON-LD -> wordCount > 20");

// 7. Legacy CMS Job fixture (/jobopenings/12345)
const legacyJobPage = parseHtmlPage(
  "https://www.botconsulting.io/jobopenings/12345",
  "https://www.botconsulting.io/jobopenings/12345",
  "https://www.botconsulting.io/jobopenings/12345",
  200,
  [],
  `<html><head><title>Legacy Job</title></head><body><main><h2>Old Job</h2><p>Archived record.</p></main></body></html>`,
  { "content-type": "text/html" },
  100,
  2,
  "https://www.botconsulting.io"
);
assert(legacyJobPage.classification.primaryClass === "legacy_job", "Numeric /jobopenings/12345 classified as legacy_job");

// 8. Duplicate Copy CMS fixture (/jobopenings-copy/12345)
const copyJobPage = parseHtmlPage(
  "https://www.botconsulting.io/jobopenings-copy/12345",
  "https://www.botconsulting.io/jobopenings-copy/12345",
  "https://www.botconsulting.io/jobopenings-copy/12345",
  200,
  [],
  `<html><head><title>Copy Job</title></head><body><main><h2>Draft Copy</h2></main></body></html>`,
  { "content-type": "text/html" },
  100,
  2,
  "https://www.botconsulting.io"
);
assert(copyJobPage.classification.primaryClass === "duplicate_job_candidate", "Slug /jobopenings-copy/ classified as duplicate_job_candidate");

// 9. True Broken Empty Anchor Fixture
const emptyAnchorPage = parseHtmlPage(
  "https://www.botconsulting.io/blog/post-1",
  "https://www.botconsulting.io/blog/post-1",
  "https://www.botconsulting.io/blog/post-1",
  200,
  [],
  `<!DOCTYPE html>
  <html>
  <head><title>Blog Post | BOT</title></head>
  <body>
    <main>
      <h1>Modern Data Stacks in 2026</h1>
      <p>Detailed discussion on cloud data architecture.</p>
      <a href="/contact-us"></a> <!-- Truly empty internal anchor -->
    </main>
  </body>
  </html>`,
  { "content-type": "text/html" },
  90,
  1,
  "https://www.botconsulting.io"
);
const emptyLink = emptyAnchorPage.outlinks.find((o) => o.targetUrl === "/contact-us");
assert(emptyLink?.hasAccessibleName === false, "Anchor without text/image/aria computed as hasAccessibleName: false");

// 10. Form with unlabelled input
const formPage = parseHtmlPage(
  "https://www.botconsulting.io/contact-us",
  "https://www.botconsulting.io/contact-us",
  "https://www.botconsulting.io/contact-us",
  200,
  [],
  `<!DOCTYPE html>
  <html>
  <head><title>Contact Us | BOT Consulting</title></head>
  <body>
    <main>
      <h1>Contact Our Team</h1>
      <form action="/submit" method="POST">
        <input type="text" name="fullName" placeholder="Your Name"> <!-- Missing <label> -->
        <label for="userEmail">Email</label>
        <input type="email" id="userEmail" name="email">
      </form>
    </main>
  </body>
  </html>`,
  { "content-type": "text/html" },
  95,
  1,
  "https://www.botconsulting.io"
);
assert(formPage.forms.length === 1, "Form correctly extracted");
assert(formPage.forms[0].unlabelledCount === 1, "Unlabelled input detected without label[for] or aria-label");

// Evaluate rules over the complete fixture set
const allPages = [
  sitemapPage,
  cdnPage,
  homePage,
  solutionsPage,
  servicenowPage,
  dynamicJobPage,
  legacyJobPage,
  copyJobPage,
  emptyAnchorPage,
  formPage,
];

const mockGraph = {
  brokenInternalLinks: [],
  brokenExternalLinks: [],
  botBlockedExternalLinks: [],
  sitemapOrphans: [],
  crawlIsolatedPages: [],
  totalInternalLinks: 15,
  totalExternalLinks: 0,
  inlinksMap: new Map(),
  externalLinkTelemetry: {
    discoveredUniqueUrls: 0,
    discoveredOccurrences: 0,
    verificationLimit: 50,
    checkedUniqueUrls: 0,
    checkedOccurrences: 0,
    uncheckedUniqueUrls: 0,
    uncheckedOccurrences: 0,
    confirmedOkUniqueUrls: 0,
    confirmedOkOccurrences: 0,
    redirectedOkUniqueUrls: 0,
    redirectedOkOccurrences: 0,
    browserVerifiedOkUniqueUrls: 0,
    browserVerifiedOkOccurrences: 0,
    confirmedBrokenUniqueUrls: 0,
    confirmedBrokenOccurrences: 0,
    inconclusiveUniqueUrls: 0,
    inconclusiveOccurrences: 0,
    verificationCoveragePercent: 100,
    uniqueExternalUrlsCount: 0,
    totalExternalOccurrences: 0,
    confirmedOkCount: 0,
    redirectedOkCount: 0,
    browserVerifiedOkCount: 0,
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

const audit = evaluateAllDiagnosticRules(allPages, mockGraph, []);

console.log("\n--- Diagnostic Rule Isolation Assertions ---");

// A. sitemap.xml does NOT trigger HTML rules
const h1Issue = audit.issues.find((i) => i.code === "CONTENT_MISSING_H1");
const h1Urls = h1Issue ? h1Issue.affectedPages.map((p) => p.url) : [];
assert(!h1Urls.includes("https://www.botconsulting.io/sitemap.xml"), "Rule A: sitemap.xml excluded from CONTENT_MISSING_H1");
assert(!h1Urls.includes("https://www.botconsulting.io/cdn-cgi/l/email-protection#123"), "Rule B: Cloudflare utility excluded from CONTENT_MISSING_H1");

// C. Homepage is NOT flagged for Missing H1
assert(!h1Urls.includes("https://www.botconsulting.io/"), "Rule C: Homepage (H1 count = 1) is NOT flagged for Missing H1");

// D. /solutions is flagged for MULTIPLE H1, NOT Missing H1
const multiH1Issue = audit.issues.find((i) => i.code === "CONTENT_MULTIPLE_H1");
const multiH1Urls = multiH1Issue ? multiH1Issue.affectedPages.map((p) => p.url) : [];
assert(multiH1Urls.includes("https://www.botconsulting.io/solutions"), "Rule D: /solutions flagged under CONTENT_MULTIPLE_H1");
assert(!h1Urls.includes("https://www.botconsulting.io/solutions"), "Rule D: /solutions NOT in Missing H1");

// E. /servicenow-at-bot is flagged for Missing H1
assert(h1Urls.includes("https://www.botconsulting.io/servicenow-at-bot"), "Rule E: /servicenow-at-bot flagged under CONTENT_MISSING_H1");

// F. Dynamic job page is NOT falsely reported as Thin Content
const thinIssue = audit.issues.find((i) => i.code === "CONTENT_THIN_WORD_COUNT");
const thinUrls = thinIssue ? thinIssue.affectedPages.map((p) => p.url) : [];
assert(!thinUrls.includes("https://www.botconsulting.io/job-openings/data-architect"), "Rule F: Dynamic job page NOT flagged for Thin Content");

// I. Logo link is NOT in empty anchors
const emptyAnchorIssue = audit.issues.find((i) => i.code === "LINKS_EMPTY_ANCHOR");
const emptyAnchorUrls = emptyAnchorIssue ? emptyAnchorIssue.affectedPages.map((p) => p.url) : [];
assert(!emptyAnchorUrls.includes("https://www.botconsulting.io/"), "Rule I: Accessible logo link NOT flagged under LINKS_EMPTY_ANCHOR");
assert(emptyAnchorUrls.includes("https://www.botconsulting.io/blog/post-1"), "Rule I: Truly empty link on /blog/post-1 flagged under LINKS_EMPTY_ANCHOR");

// J. href='#' is in placeholder control issue, NOT broken link
const placeholderIssue = audit.issues.find((i) => i.code === "CODE_PLACEHOLDER_ANCHOR");
assert(Boolean(placeholderIssue), "Rule J: CODE_PLACEHOLDER_ANCHOR issue generated for href='#'");

// K. Form control unlabelled check
const unlabelledFormIssue = audit.issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");
assert(Boolean(unlabelledFormIssue), "Rule P: A11Y_UNLABELLED_FORM_CONTROL generated for form input");

// Audit Coverage & Health Score
assert(audit.auditCoveragePercent >= 80, `Audit Coverage transparently reported: ${audit.auditCoveragePercent}%`);
assert(audit.healthScore > 50 && audit.healthScore <= 100, `Health Score mathematically sound: ${audit.healthScore}/100`);

console.log("\n=======================================================");
console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
}
