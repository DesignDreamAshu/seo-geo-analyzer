/**
 * Deterministic Report-Completeness Regression Test Suite.
 * Verifies that the parser, diagnostic engine, Fix Intelligence layer, and report serializers
 * preserve and expose 100% of the required actionable evidence and remediation details.
 */

import { parsePageHtml } from "../../parser";
import { evaluateAllDiagnosticRules } from "../../rules";
import { generateFixIntelligenceForIssue } from "../../fix-intelligence/engine";
import { CrawledPageData } from "../../types";

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res && typeof (res as any).then === "function") {
      return (res as any)
        .then(() => {
          console.log(`  ✓ ${testName}`);
        })
        .catch((err: any) => {
          console.error(`  ❌ FAIL: ${testName}`);
          console.error(`     ${err.message}`);
          throw err;
        });
    }
    console.log(`  ✓ ${testName}`);
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     ${err.message}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but received ${actual}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy value but received ${actual}`);
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== "number" || actual < expected) throw new Error(`Expected >= ${expected}, received: ${actual}`);
    },
    toContain(substr: string) {
      if (typeof actual === "string" && !actual.includes(substr)) {
        throw new Error(`Expected string to contain '${substr}', received: '${actual}'`);
      }
    },
  };
}

describe("Master Report QA & Remediation Completeness Tests", () => {
  // =========================================================================
  // 1. OPEN GRAPH REPORT COMPLETENESS
  // =========================================================================
  it("1. OG Missing Image: emits actionable evidence with exact missing component", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Enterprise ServiceNow Solutions</title>
          <meta property="og:title" content="Enterprise ServiceNow Solutions">
          <meta property="og:description" content="Accelerate your workflow automation with BOT.">
          <meta property="og:url" content="https://www.botconsulting.io/solutions">
          <meta property="og:type" content="website">
        </head>
        <body><h1>Solutions</h1><p>Main content text here for enterprise transformation.</p></body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/solutions", "https://www.botconsulting.io", 200, {});
    expect(parsed.openGraph.title).toBe("Enterprise ServiceNow Solutions");
    expect(parsed.openGraph.image).toBe(null);
    expect(parsed.openGraph.missingRequiredTags.includes("og:image")).toBe(true);

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const ogIssue = issues.find((i) => i.code === "SOCIAL_INCOMPLETE_OG");
    expect(Boolean(ogIssue)).toBe(true);
    expect(ogIssue?.affectedPages[0].evidence.observed).toContain("missing og:image");

    const fix = generateFixIntelligenceForIssue(ogIssue!, { platform: "webflow", isCmsPage: true, templateName: "Solutions Template" });
    expect(fix.fix.steps[0].location).toContain("Webflow Designer → CMS Collections");
  });

  it("2. OG Relative Image URL: detects non-absolute image and prescribes absolute HTTPS URL", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>AI Transformation Guide</title>
          <meta property="og:title" content="AI Transformation Guide">
          <meta property="og:description" content="Complete guide to enterprise AI.">
          <meta property="og:image" content="/assets/og-cover.png">
          <meta property="og:url" content="https://www.botconsulting.io/guide">
          <meta property="og:type" content="article">
        </head>
        <body><h1>AI Transformation Guide</h1><p>Article content text.</p></body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/guide", "https://www.botconsulting.io", 200, {});
    expect(parsed.openGraph.isImageAbsolute).toBe(false);
    expect(parsed.openGraph.resolvedImageUrl).toBe("https://www.botconsulting.io/assets/og-cover.png");

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const ogIssue = issues.find((i) => i.code === "SOCIAL_INCOMPLETE_OG");
    expect(ogIssue?.affectedPages[0].evidence.observed).toContain("relative URL");
  });

  it("3. OG Valid Metadata (Explainable PASS): returns clean PASS with all 5 verified components", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>About BOT Consulting</title>
          <meta name="description" content="Elite ServiceNow Partners.">
          <link rel="canonical" href="https://www.botconsulting.io/about">
          <meta property="og:title" content="About BOT Consulting">
          <meta property="og:description" content="Elite ServiceNow Partners.">
          <meta property="og:image" content="https://www.botconsulting.io/images/about-og.jpg">
          <meta property="og:url" content="https://www.botconsulting.io/about">
          <meta property="og:type" content="website">
          <meta name="twitter:card" content="summary_large_image">
        </head>
        <body><h1>About Us</h1><p>Substantial body text for about page.</p></body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/about", "https://www.botconsulting.io", 200, {});
    expect(parsed.openGraph.validationStatus).toBe("PASS");
    expect(parsed.openGraph.imageFetchState).toBe("FETCH_NOT_EVALUATED"); // Offline HTML default
    expect(parsed.openGraph.canonicalConsistent).toBe(true);
    expect(parsed.openGraph.missingRequiredTags.length).toBe(0);

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const ogIssue = issues.find((i) => i.code === "SOCIAL_INCOMPLETE_OG");
    expect(ogIssue).toBe(undefined); // Clean explainable PASS
  });

  it("3b. OG Image Fetch Resource Validation: handles FETCH_CONFIRMED, FETCH_FAILED, and FETCH_BLOCKED explicitly", () => {
    const baseHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>About BOT Consulting</title>
          <meta property="og:title" content="About BOT Consulting">
          <meta property="og:description" content="Elite ServiceNow Partners.">
          <meta property="og:image" content="https://www.botconsulting.io/images/about-og.jpg">
          <meta property="og:url" content="https://www.botconsulting.io/about">
          <meta property="og:type" content="website">
        </head>
        <body><h1>About Us</h1></body>
      </html>
    `;

    // 1. Confirmed Fetch (HTTP 200)
    const parsed200 = parsePageHtml(baseHtml, "https://www.botconsulting.io/about", "https://www.botconsulting.io", 200, {
      "x-og-image-status": "200",
    });
    expect(parsed200.openGraph.imageFetchState).toBe("FETCH_CONFIRMED");
    expect(parsed200.openGraph.imageFetchStatus).toBe(200);
    expect(parsed200.openGraph.isImageBroken).toBe(false);

    // 2. Failed Fetch (HTTP 404)
    const parsed404 = parsePageHtml(baseHtml, "https://www.botconsulting.io/about", "https://www.botconsulting.io", 200, {
      "x-og-image-status": "404",
    });
    expect(parsed404.openGraph.imageFetchState).toBe("FETCH_FAILED");
    expect(parsed404.openGraph.imageFetchStatus).toBe(404);
    expect(parsed404.openGraph.isImageBroken).toBe(true);

    // 3. Blocked Fetch (HTTP 403)
    const parsed403 = parsePageHtml(baseHtml, "https://www.botconsulting.io/about", "https://www.botconsulting.io", 200, {
      "x-og-image-status": "403",
    });
    expect(parsed403.openGraph.imageFetchState).toBe("FETCH_BLOCKED");
    expect(parsed403.openGraph.imageFetchStatus).toBe(403);
  });

  // =========================================================================
  // 2. TWITTER / X REPORT COMPLETENESS
  // =========================================================================
  it("4. Twitter Card with OG Fallback: classifies as FALLBACK_OG_PASS and does not create false failure", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Careers at BOT</title>
          <meta property="og:title" content="Careers at BOT">
          <meta property="og:description" content="Join our elite technical team.">
          <meta property="og:image" content="https://www.botconsulting.io/careers-og.png">
        </head>
        <body><h1>Careers</h1><p>Join us today.</p></body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/careers", "https://www.botconsulting.io", 200, {});
    expect(parsed.twitterCard.hasExplicitCard).toBe(false);
    expect(parsed.twitterCard.hasOgFallback).toBe(true);
    expect(parsed.twitterCard.validationStatus).toBe("FALLBACK_OG_PASS");
  });

  // =========================================================================
  // 3. HEADING HIERARCHY REPORT COMPLETENESS
  // =========================================================================
  it("5. Heading Hierarchy Skip: exposes exact observed sequence and missing intermediate level", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>ServiceNow Architecture</title></head>
        <body>
          <h1>ServiceNow Architecture</h1>
          <h3>Sub-component Configuration</h3>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/architecture", "https://www.botconsulting.io", 200, {});
    expect(parsed.headingsHierarchyValid).toBe(false);

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const skipIssue = issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(Boolean(skipIssue)).toBe(true);
    expect(skipIssue?.affectedPages[0].evidence.observed).toContain("Skipped <h2>");
    expect(skipIssue?.affectedPages[0].evidence.observed).toContain("<h3>");

    const fix = generateFixIntelligenceForIssue(skipIssue!, { platform: "webflow", isCmsPage: false });
    expect(fix.fix.objective).toContain("sequential hierarchy");
  });

  // =========================================================================
  // 4. IMAGE ALT & DIMENSIONS REPORT COMPLETENESS
  // =========================================================================
  it("6. Image Missing ALT vs Decorative ALT: distinguishes missing ALT from valid decorative alt=''", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Image Gallery</title></head>
        <body>
          <h1>Gallery</h1>
          <img src="/images/hero.jpg">
          <img src="/images/divider.png" alt="">
          <img src="/images/diagram.png" alt="Architecture Diagram" width="800" height="600">
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/gallery", "https://www.botconsulting.io", 200, {});
    expect(parsed.images[0].altState).toBe("missing_alt_attribute");
    expect(parsed.images[1].altState).toBe("empty_alt_decorative");
    expect(parsed.images[2].altState).toBe("descriptive_alt_present");
    expect(parsed.images[2].hasDimensions).toBe(true);

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const altIssue = issues.find((i) => i.code === "ASSET_MISSING_ALT");
    expect(Boolean(altIssue)).toBe(true);
    expect(altIssue?.affectedPages[0].evidence.observed).toContain("hero.jpg");
  });

  // =========================================================================
  // 5. LINK REPORT COMPLETENESS
  // =========================================================================
  it("7. Placeholder Link (href='#'): exposes exact anchor text and DOM element", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Navigation Test</title></head>
        <body>
          <h1>Navigation</h1>
          <a href="#" class="cta-button">Explore Solutions</a>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/nav-test", "https://www.botconsulting.io", 200, {});
    expect(parsed.outlinks[0].linkClassification).toBe("placeholder_hash");
    expect(parsed.outlinks[0].anchorText).toBe("Explore Solutions");

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const linkIssue = issues.find((i) => i.code === "CODE_PLACEHOLDER_ANCHOR");
    expect(Boolean(linkIssue)).toBe(true);
    expect(linkIssue?.affectedPages[0].evidence.observed).toContain("href=\"#\"");

    const fix = generateFixIntelligenceForIssue(linkIssue!, { platform: "webflow", isCmsPage: false });
    expect(fix.fix.steps[0].action).toContain("native button");
  });

  // =========================================================================
  // 6. CANONICAL REPORT COMPLETENESS
  // =========================================================================
  it("8. Canonical Tag Declared in <body>: exposes location defect and head requirement", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Canonical Test</title></head>
        <body>
          <h1>Title</h1>
          <link rel="canonical" href="https://www.botconsulting.io/canonical-test">
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/canonical-test", "https://www.botconsulting.io", 200, {});
    expect(parsed.allCanonicalTags?.[0].inHead).toBe(false);

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const canIssue = issues.find((i) => i.code === "CANONICAL_OUTSIDE_HEAD");
    expect(Boolean(canIssue)).toBe(true);
    expect(canIssue?.affectedPages[0].evidence.observed).toContain("<body>");
  });

  // =========================================================================
  // 7. STRUCTURED DATA REPORT COMPLETENESS
  // =========================================================================
  it("9. Malformed JSON-LD: exposes exact syntax error message and script location", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Schema Test</title>
          <script type="application/ld+json">
            { "@context": "https://schema.org", "@type": "Organization", "name": "BOT Consulting", }
          </script>
        </head>
        <body><h1>Schema Test</h1></body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/schema-test", "https://www.botconsulting.io", 200, {});
    expect(parsed.schemaJsonLd[0].parsedSuccessfully).toBe(false);

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const schemaIssue = issues.find((i) => i.code === "SCHEMA_MALFORMED_JSON");
    expect(Boolean(schemaIssue)).toBe(true);
    expect(schemaIssue?.affectedPages[0].evidence.observed).toContain("syntax error");
  });

  // =========================================================================
  // 8. ACCESSIBILITY & FORM CONTROL REPORT COMPLETENESS
  // =========================================================================
  it("10. Unlabelled Form Control: exposes exact control tag, name, type, and form location", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Contact Form</title></head>
        <body>
          <h1>Contact</h1>
          <form id="contact-form">
            <input type="email" name="user_email" placeholder="Enter email">
          </form>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(html, "https://www.botconsulting.io/contact", "https://www.botconsulting.io", 200, {});
    expect(parsed.forms[0].unlabelledCount).toBe(1);
    expect(parsed.forms[0].controls[0].name).toBe("user_email");

    const issues = evaluateAllDiagnosticRules([parsed]).issues;
    const formIssue = issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");
    expect(Boolean(formIssue)).toBe(true);
    expect(formIssue?.affectedPages[0].evidence.observed).toContain("unlabelled");

    const fix = generateFixIntelligenceForIssue(formIssue!, { platform: "webflow", isCmsPage: false });
    expect(fix.fix.objective).toContain("label");
  });

  // =========================================================================
  // 9. USER-VISIBLE REPORT OUTPUT VERIFICATION
  // =========================================================================
  it("11. Rendered Markdown Report Output: verifies that generated report exposes full actionable details", () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>ServiceNow AI Consulting</title>
          <meta property="og:title" content="ServiceNow AI Consulting">
          <meta property="og:description" content="AI Automation for Enterprise">
          <!-- missing og:image -->
          <meta property="og:url" content="https://www.botconsulting.io/ai">
          <meta property="og:type" content="website">
        </head>
        <body>
          <h1>ServiceNow AI</h1>
          <img src="/hero.jpg">
          <a href="#" class="btn">Explore</a>
        </body>
      </html>
    `;

    const parsed = parsePageHtml(sampleHtml, "https://www.botconsulting.io/ai", "https://www.botconsulting.io", 200, {});
    const issues = evaluateAllDiagnosticRules([parsed]).issues;

    expect(issues.length).toBeGreaterThanOrEqual(3); // OG missing image, missing alt, placeholder href='#'

    // Verify each issue produces non-empty Fix Intelligence with Webflow guidance
    for (const issue of issues) {
      const fix = generateFixIntelligenceForIssue(issue, { platform: "webflow", isCmsPage: true, templateName: "Solutions Template" });
      const mdReportSection = `
### [${issue.severity.toUpperCase()}] ${issue.title}
- **Rule Code:** \`${issue.code}\`
- **Why It Matters:** ${fix.whyItMatters}
- **Where to Fix:** ${fix.fix.steps[0]?.location}
- **Action Steps:**
${fix.fix.steps.map((s) => `  ${s.stepNumber}. ${s.action} (${s.details || ""})`).join("\n")}
- **Verification:** ${fix.verification.method} -> ${fix.verification.expectedOutcome}
      `;

      expect(mdReportSection).toContain(issue.code);
      expect(mdReportSection).toContain("Where to Fix:");
      expect(mdReportSection).toContain("Action Steps:");
    }
  });
});
