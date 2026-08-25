import { parseHtmlPage } from "../parser";
import { normalizeUrl, isValidNavigationalCandidate, resolveAbsoluteHref, classifyLinkType } from "../normalizer";

function runTests() {
  console.log("=== RUNNING URL DISCOVERY & NAVIGATIONAL CONTRACT TESTS ===");
  let passed = 0;
  let failed = 0;
  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  const seedUrl = "https://designdream.agency";
  const contactUrl = "https://designdream.agency/contact/";

  // 1. Bare DOM tag names
  assert(!isValidNavigationalCandidate("svg"), "Rejects bare tag 'svg'");
  assert(!isValidNavigationalCandidate("path"), "Rejects bare tag 'path'");
  assert(!isValidNavigationalCandidate("circle"), "Rejects bare tag 'circle'");
  assert(!isValidNavigationalCandidate("div"), "Rejects bare tag 'div'");
  assert(!isValidNavigationalCandidate("main"), "Rejects bare tag 'main'");
  assert(normalizeUrl("svg", contactUrl) === null, "normalizeUrl('svg', contactUrl) returns null");
  assert(normalizeUrl("path", contactUrl) === null, "normalizeUrl('path', contactUrl) returns null");

  // 2. SVG & HTML in-page fragment links
  assert(!isValidNavigationalCandidate("#scrollDialPath"), "Rejects fragment '#scrollDialPath'");
  assert(!isValidNavigationalCandidate("#icon-id"), "Rejects fragment '#icon-id'");
  assert(!isValidNavigationalCandidate("#top"), "Rejects fragment '#top'");
  assert(!isValidNavigationalCandidate("#"), "Rejects fragment '#'");
  assert(normalizeUrl("#scrollDialPath", contactUrl) === null, "normalizeUrl('#scrollDialPath', contactUrl) returns null");
  assert(resolveAbsoluteHref("#scrollDialPath", contactUrl) === null, "resolveAbsoluteHref('#scrollDialPath', contactUrl) returns null");

  // 3. MIME types & data URIs
  assert(!isValidNavigationalCandidate("image/svg+xml"), "Rejects MIME 'image/svg+xml'");
  assert(!isValidNavigationalCandidate("text/html"), "Rejects MIME 'text/html'");
  assert(!isValidNavigationalCandidate("application/json"), "Rejects MIME 'application/json'");
  assert(!isValidNavigationalCandidate("data:image/svg+xml;utf8,<svg></svg>"), "Rejects data URI");
  assert(normalizeUrl("image/svg+xml", contactUrl) === null, "normalizeUrl('image/svg+xml', contactUrl) returns null");
  assert(normalizeUrl("data:image/svg+xml;utf8,<svg></svg>", contactUrl) === null, "normalizeUrl(data URI) returns null");

  // 4. Non-navigational protocols
  assert(!isValidNavigationalCandidate("javascript:void(0)"), "Rejects javascript protocol");
  assert(!isValidNavigationalCandidate("mailto:hello@designdream.agency"), "Rejects mailto protocol");
  assert(!isValidNavigationalCandidate("tel:+1234567890"), "Rejects tel protocol");
  assert(!isValidNavigationalCandidate("blob:https://designdream.agency/12345"), "Rejects blob protocol");

  // 5. Preserves legitimate relative navigation
  assert(isValidNavigationalCandidate("/services/"), "Accepts '/services/'");
  assert(isValidNavigationalCandidate("services"), "Accepts 'services'");
  assert(isValidNavigationalCandidate("../about/"), "Accepts '../about/'");
  assert(isValidNavigationalCandidate("./case-studies"), "Accepts './case-studies'");
  assert(isValidNavigationalCandidate("?page=2"), "Accepts query-string '?page=2'");

  assert(normalizeUrl("/services/", contactUrl) === "https://designdream.agency/services/", "Resolves '/services/' properly");
  assert(normalizeUrl("services", contactUrl) === "https://designdream.agency/contact/services", "Resolves 'services' relative to contact properly");
  assert(normalizeUrl("../about/", contactUrl) === "https://designdream.agency/about/", "Resolves '../about/' properly");
  assert(normalizeUrl("https://designdream.agency/work", contactUrl) === "https://designdream.agency/work", "Resolves absolute same-origin properly");

  // 6. Full DOM Outlink Extraction Integration
  const mockHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Contact Us - Design Dream</title>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
      <link rel="canonical" href="https://designdream.agency/contact/" />
    </head>
    <body>
      <header>
        <a href="/">Home</a>
        <a href="/services/">Services</a>
        <a href="services">Relative Services</a>
      </header>
      <main>
        <h1>GET IN TOUCH</h1>
        <p>Tell us what feels messy, slow, or hard to scale.</p>
        <img src="/logo-light.svg" alt="Design Dream" />
        <img src="data:image/svg+xml;utf8,<svg></svg>" alt="Map" />
        
        <!-- SVG with internal definitions & textPath -->
        <svg viewBox="0 0 120 120" class="scroll-dial-svg">
          <defs>
            <path id="scrollDialPath" d="M60,19 a41,41 0 1,1 -0.1,0" />
          </defs>
          <text>
            <textPath href="#scrollDialPath">SCROLL TO EXPLORE</textPath>
          </text>
          <use href="#icon-arrow" />
        </svg>

        <!-- Image map area navigation -->
        <map name="workmap">
          <area shape="rect" coords="34,44,270,350" href="/locations/" alt="Locations" />
        </map>
      </main>
    </body>
    </html>
  `;

  const pageData = parseHtmlPage(
    contactUrl,
    contactUrl,
    contactUrl,
    200,
    [],
    mockHtml,
    {},
    150,
    1,
    seedUrl,
    false
  );

  const targetUrls = pageData.outlinks.map((o) => o.normalizedTargetUrl);
  const rawHrefs = pageData.outlinks.map((o) => o.rawHref);

  // Assert MUST NOT crawl
  assert(!targetUrls.includes("https://designdream.agency/contact/svg"), "MUST NOT enqueue https://designdream.agency/contact/svg");
  assert(!targetUrls.includes("https://designdream.agency/contact/#scrollDialPath"), "MUST NOT enqueue SVG fragment URL");
  assert(!rawHrefs.includes("svg"), "Raw hrefs do not contain 'svg'");
  assert(!rawHrefs.includes("#scrollDialPath"), "Raw hrefs do not contain '#scrollDialPath'");
  assert(!rawHrefs.includes("#icon-arrow"), "Raw hrefs do not contain '#icon-arrow'");
  assert(!rawHrefs.includes("image/svg+xml"), "Raw hrefs do not contain MIME type 'image/svg+xml'");
  assert(!rawHrefs.includes("/favicon.svg?v=2"), "Raw hrefs do not contain icon link '/favicon.svg?v=2'");
  assert(!rawHrefs.includes("/logo-light.svg"), "Raw hrefs do not contain image src '/logo-light.svg'");

  // Assert MUST crawl
  assert(targetUrls.includes("https://designdream.agency/"), "MUST crawl root /");
  assert(targetUrls.includes("https://designdream.agency/services/"), "MUST crawl /services/");
  assert(targetUrls.includes("https://designdream.agency/locations/"), "MUST crawl <area> /locations/");

  // Assert provenance diagnostics
  const areaLink = pageData.outlinks.find((o) => o.rawHref === "/locations/");
  assert(areaLink && areaLink.provenance && areaLink.provenance.domElement === "area", "Area link has valid provenance diagnostics");

  console.log(`
TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests();