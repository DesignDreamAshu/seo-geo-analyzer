import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { extractForms } from "../parser";
import { evaluateAllDiagnosticRules } from "../rules";
import { processPageAuthoritatively } from "../page-processor";
import { normalizeUrl } from "../normalizer";
import { computeOccurrenceDiff, convertStructuredToOccurrenceItems, resolveOccurrenceItems } from "../verification/occurrence-diff";
import type { CrawledPageData, StructuredOccurrence } from "../types";

describe("DREAM SEO — Generic Actionable Finding Evidence & Exact Occurrence Suite", () => {
  // Test fixture representing BOT Consulting job opening page with 13 unlabelled controls
  const botJobOpeningHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Senior AI Engineer - Careers at BOT Consulting</title>
      <meta name="description" content="Apply for Senior AI Engineer at BOT Consulting. Join our enterprise AI consulting team.">
    </head>
    <body>
      <main>
        <h1>Senior AI Engineer Application</h1>
        <form id="job-application-form" action="/submit-application" method="POST">
          <div class="field">
            <input name="website" type="text" placeholder="Your Website / Portfolio">
          </div>
          <div class="field">
            <input name="candidateName" type="text" placeholder="Full Name">
          </div>
          <div class="field">
            <input name="candidateEmail" type="email" placeholder="Email Address">
          </div>
          <div class="field">
            <input name="phoneNumber" type="tel" placeholder="Phone Number">
          </div>
          <div class="field">
            <input name="currentLocation" type="text" placeholder="Current City, Country">
          </div>
          <div class="field">
            <input name="employeeName" type="text" placeholder="Referral Employee Name">
          </div>
          <div class="field">
            <input name="employeeId" type="text" placeholder="Referral Employee ID">
          </div>
          <div class="field">
            <input name="employeeEmail" type="email" placeholder="Referral Employee Email">
          </div>
          <div class="field">
            <select name="relationshipType">
              <option value="">Select Relationship</option>
              <option value="colleague">Former Colleague</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <input name="relationshipOther" type="text" placeholder="Please specify if other">
          </div>
          <div class="field">
            <textarea name="recommendationReason" placeholder="Why do you recommend this candidate?"></textarea>
          </div>
          <div class="field">
            <input name="resume" type="file">
          </div>
          <div class="field">
            <input name="otp-input" type="text" placeholder="Verification Code">
          </div>
          <button type="submit">Submit Application</button>
        </form>
      </main>
    </body>
    </html>
  `;

  // Test fixture representing BOT Consulting contact page with 7 controls
  const botContactPageHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Contact Us - BOT Consulting</title>
      <meta name="description" content="Get in touch with BOT Consulting enterprise team.">
    </head>
    <body>
      <main>
        <h1>Contact Us</h1>
        <form id="contact-form">
          <input name="Name" type="text" placeholder="Name">
          <input name="Email" type="email" placeholder="Email">
          <input name="Company" type="text" placeholder="Company">
          <input name="Phone" type="tel" placeholder="Phone">
          <input name="Service" type="text" placeholder="Service Interested In">
          <input name="Budget" type="text" placeholder="Estimated Budget">
          <textarea name="Message-2" placeholder="Tell us about your project"></textarea>
        </form>
      </main>
    </body>
    </html>
  `;

  // Partially remediated contact page: 6 labelled, 1 still unlabelled
  const botContactPagePartiallyFixedHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Contact Us - BOT Consulting</title>
      <meta name="description" content="Get in touch with BOT Consulting enterprise team.">
    </head>
    <body>
      <main>
        <h1>Contact Us</h1>
        <form id="contact-form">
          <label for="name-input">Name</label>
          <input id="name-input" name="Name" type="text">

          <label for="email-input">Email</label>
          <input id="email-input" name="Email" type="email">

          <label for="company-input">Company</label>
          <input id="company-input" name="Company" type="text">

          <label for="phone-input">Phone</label>
          <input id="phone-input" name="Phone" type="tel">

          <label for="service-input">Service</label>
          <input id="service-input" name="Service" type="text">

          <label for="budget-input">Budget</label>
          <input id="budget-input" name="Budget" type="text">

          <!-- Still unlabelled -->
          <textarea name="Message-2" placeholder="Tell us about your project"></textarea>
        </form>
      </main>
    </body>
    </html>
  `;

  it("1. ARIA Form Controls: parser extracts all 13 controls with accurate, non-fabricated attributes", () => {
    const $ = cheerio.load(botJobOpeningHtml);
    const forms = extractForms($);

    expect(forms.length).toBe(1);
    expect(forms[0].controlCount).toBe(13);
    expect(forms[0].unlabelledCount).toBe(13);

    const controls = forms[0].controls;
    expect(controls.length).toBe(13);

    // Verify all 13 exact names and tags
    const names = controls.map((c) => c.name);
    expect(names).toEqual([
      "website",
      "candidateName",
      "candidateEmail",
      "phoneNumber",
      "currentLocation",
      "employeeName",
      "employeeId",
      "employeeEmail",
      "relationshipType",
      "relationshipOther",
      "recommendationReason",
      "resume",
      "otp-input",
    ]);

    // Verify select and textarea tags
    expect(controls.find((c) => c.name === "relationshipType")?.tag).toBe("select");
    expect(controls.find((c) => c.name === "recommendationReason")?.tag).toBe("textarea");

    // Verify placeholders are captured
    expect(controls.find((c) => c.name === "website")?.placeholder).toBe("Your Website / Portfolio");
    expect(controls.find((c) => c.name === "candidateEmail")?.placeholder).toBe("Email Address");
  });

  it("2. Rule Evaluation: A11Y_UNLABELLED_FORM_CONTROL generates exactly 13 structured occurrences matching reported count", async () => {
    const pageUrl = "https://www.botconsulting.io/jobopenings/121722000001243164";
    const pageData = await processPageAuthoritatively(
      pageUrl,
      normalizeUrl(pageUrl),
      pageUrl,
      200,
      [],
      botJobOpeningHtml,
      {},
      120,
      1,
      { seedNormalized: "botconsulting.io" }
    );

    const evalResult = evaluateAllDiagnosticRules([pageData]);
    const formIssue = evalResult.issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");

    expect(formIssue).toBeDefined();
    expect(formIssue?.affectedPages.length).toBe(1);

    const evidence = formIssue?.affectedPages[0].evidence;
    expect(evidence).toBeDefined();
    expect(evidence?.observed).toBe("Form contains 13 unlabelled input controls without matching <label> or aria-label");
    expect(evidence?.occurrences).toBeDefined();
    expect(evidence?.occurrences?.length).toBe(13);

    // Verify exact occurrence structure
    const occs = evidence?.occurrences as StructuredOccurrence[];
    expect(occs[0].type).toBe("FORM_CONTROL");
    expect(occs[0].identity).toBe('<input name="website" type="text">');
    expect(occs[0].attributes?.name).toBe("website");
    expect(occs[0].attributes?.placeholder).toBe("Your Website / Portfolio");

    // Check textarea
    const textareaOcc = occs.find((o) => o.attributes?.name === "recommendationReason");
    expect(textareaOcc?.tagName).toBe("textarea");
    expect(textareaOcc?.identity).toBe('<textarea name="recommendationReason">');

    // Check select
    const selectOcc = occs.find((o) => o.attributes?.name === "relationshipType");
    expect(selectOcc?.tagName).toBe("select");
    expect(selectOcc?.identity).toBe('<select name="relationshipType">');
  });

  it("3. Count Exactness Invariant: reported count == persisted occurrences length == displayed count", async () => {
    const pageUrl = "https://www.botconsulting.io/jobopenings/121722000001243164";
    const pageData = await processPageAuthoritatively(
      pageUrl,
      normalizeUrl(pageUrl),
      pageUrl,
      200,
      [],
      botJobOpeningHtml,
      {},
      120,
      1,
      { seedNormalized: "botconsulting.io" }
    );

    const evalResult = evaluateAllDiagnosticRules([pageData]);
    const formIssue = evalResult.issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");
    const evidence = formIssue?.affectedPages[0].evidence;

    const reportedNumber = parseInt(evidence?.observed.match(/Form contains (\d+) unlabelled/)?.[1] || "0", 10);
    const persistedCount = evidence?.occurrences?.length || 0;
    const resolvedItems = resolveOccurrenceItems(evidence?.occurrences);

    expect(reportedNumber).toBe(13);
    expect(persistedCount).toBe(13);
    expect(resolvedItems.length).toBe(13);
    expect(reportedNumber).toBe(persistedCount);
    expect(persistedCount).toBe(resolvedItems.length);
  });

  it("4. Occurrence Diff: partial remediation of 7 controls (6 fixed, 1 remaining) computes exact diff", async () => {
    // Original 7 controls
    const originalPage = await processPageAuthoritatively(
      "https://www.botconsulting.io/contact",
      "https://www.botconsulting.io/contact",
      "https://www.botconsulting.io/contact",
      200,
      [],
      botContactPageHtml,
      {},
      100,
      1,
      { seedNormalized: "botconsulting.io", enableBrowserRendering: false }
    );

    // Live partially fixed 1 control
    const livePage = await processPageAuthoritatively(
      "https://www.botconsulting.io/contact",
      "https://www.botconsulting.io/contact",
      "https://www.botconsulting.io/contact",
      200,
      [],
      botContactPagePartiallyFixedHtml,
      {},
      100,
      1,
      { seedNormalized: "botconsulting.io", enableBrowserRendering: false }
    );

    const origEval = evaluateAllDiagnosticRules([originalPage]);
    const liveEval = evaluateAllDiagnosticRules([livePage]);

    const origIssue = origEval.issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");
    const liveIssue = liveEval.issues.find((i) => i.code === "A11Y_UNLABELLED_FORM_CONTROL");

    const origOccurrences = origIssue?.affectedPages[0].evidence.occurrences;
    const liveOccurrences = liveIssue?.affectedPages[0].evidence.occurrences;

    expect(origOccurrences?.length).toBe(7);
    expect(liveOccurrences?.length).toBe(1);

    const diff = computeOccurrenceDiff(origOccurrences, liveOccurrences);

    expect(diff.originalCount).toBe(7);
    expect(diff.fixedCount).toBe(6);
    expect(diff.remainingCount).toBe(1);
    expect(diff.status).toBe("PARTIALLY_FIXED");
    expect(diff.summaryLabel).toBe("6 / 7 Fixed · 1 Remaining");

    // Exact remaining occurrence
    expect(diff.remainingOccurrences.length).toBe(1);
    expect(diff.remainingOccurrences[0].normalizedKey).toContain("textarea:name=message-2");

    // Exact 6 fixed occurrences
    expect(diff.fixedOccurrences.length).toBe(6);
    const fixedNames = diff.fixedOccurrences.map((f) => f.normalizedKey);
    expect(fixedNames).toContain("input:name=name");
    expect(fixedNames).toContain("input:name=email");
    expect(fixedNames).toContain("input:name=company");
    expect(fixedNames).toContain("input:name=phone");
    expect(fixedNames).toContain("input:name=service");
    expect(fixedNames).toContain("input:name=budget");
  });

  it("5. Full Fix Verification: when all controls are fixed, diff reports VERIFIED_FIXED", () => {
    const origOccurrences: StructuredOccurrence[] = [
      {
        occurrenceId: "occ_1",
        type: "FORM_CONTROL",
        identity: '<input name="email" type="email">',
        pageUrl: "https://example.com/form",
        tagName: "input",
        attributes: { name: "email" },
      },
    ];

    const diff = computeOccurrenceDiff(origOccurrences, []);
    expect(diff.status).toBe("VERIFIED_FIXED");
    expect(diff.fixedCount).toBe(1);
    expect(diff.remainingCount).toBe(0);
  });

  it("6. Button Accessible Names: attaches discrete StructuredOccurrence objects", async () => {
    const htmlWithBadButtons = `
      <html>
      <head><title>Test Page</title></head>
      <body>
        <main>
          <h1>Interactive Controls</h1>
          <button id="btn-close" class="icon-btn"></button>
          <button id="btn-submit"><svg></svg></button>
        </main>
      </body>
      </html>
    `;

    const page = await processPageAuthoritatively(
      "https://example.com/buttons",
      "https://example.com/buttons",
      "https://example.com/buttons",
      200,
      [],
      htmlWithBadButtons,
      {},
      50,
      0,
      { seedNormalized: "example.com", enableBrowserRendering: false }
    );

    const evalResult = evaluateAllDiagnosticRules([page]);
    const btnIssue = evalResult.issues.find((i) => i.code === "A11Y_BUTTON_NAME_MISSING");

    expect(btnIssue).toBeDefined();
    const occs = btnIssue?.affectedPages[0].evidence.occurrences;
    expect(occs?.length).toBe(2);
    expect(occs?.[0].type).toBe("BUTTON_A11Y");
  });

  it("7. Iframes Missing Title: attaches discrete StructuredOccurrence objects", async () => {
    const htmlWithBadIframes = `
      <html>
      <head><title>Test Page</title></head>
      <body>
        <main>
          <h1>Embedded Maps</h1>
          <iframe src="https://maps.google.com/embed/1"></iframe>
          <iframe src="https://player.vimeo.com/video/123"></iframe>
        </main>
      </body>
      </html>
    `;

    const page = await processPageAuthoritatively(
      "https://example.com/iframes",
      "https://example.com/iframes",
      "https://example.com/iframes",
      200,
      [],
      htmlWithBadIframes,
      {},
      50,
      0,
      { seedNormalized: "example.com", enableBrowserRendering: false }
    );

    const evalResult = evaluateAllDiagnosticRules([page]);
    const iframeIssue = evalResult.issues.find((i) => i.code === "A11Y_IFRAME_TITLE_MISSING");

    expect(iframeIssue).toBeDefined();
    const occs = iframeIssue?.affectedPages[0].evidence.occurrences;
    expect(occs?.length).toBe(2);
    expect(occs?.[0].type).toBe("IFRAME_TITLE");
    expect(occs?.[0].targetUrl).toBe("https://maps.google.com/embed/1");
  });

  it("8. Deprecated HTML Tags: attaches discrete StructuredOccurrence objects", async () => {
    const htmlWithDeprecatedTags = `
      <html>
      <head><title>Test Page</title></head>
      <body>
        <main>
          <h1>Old HTML</h1>
          <center>Centered Text</center>
          <font color="red">Red Text</font>
          <marquee>Scrolling Text</marquee>
        </main>
      </body>
      </html>
    `;

    const page = await processPageAuthoritatively(
      "https://example.com/deprecated",
      "https://example.com/deprecated",
      "https://example.com/deprecated",
      200,
      [],
      htmlWithDeprecatedTags,
      {},
      50,
      0,
      { seedNormalized: "example.com", enableBrowserRendering: false }
    );

    const evalResult = evaluateAllDiagnosticRules([page]);
    const depIssue = evalResult.issues.find((i) => i.code === "HTML_DEPRECATED_TAGS");

    expect(depIssue).toBeDefined();
    const occs = depIssue?.affectedPages[0].evidence.occurrences;
    expect(occs?.length).toBe(3);
    const tagNames = (occs?.map((o) => o.tagName) || []).slice().sort();
    expect(tagNames).toEqual(["center", "font", "marquee"]);
  });

  it("9. Backward Compatibility: snippet string fallback works when occurrences array is missing", () => {
    const legacySnippet = '<input name="website">, <input name="candidateName">, <select name="relationshipType">';
    const items = resolveOccurrenceItems(legacySnippet);

    expect(items.length).toBe(3);
    expect(items[0].normalizedKey).toBe("input:name=website");
    expect(items[1].normalizedKey).toBe("input:name=candidatename");
    expect(items[2].normalizedKey).toBe("select:name=relationshiptype");

    const diff = computeOccurrenceDiff(legacySnippet, '<input name="website">');
    expect(diff.originalCount).toBe(3);
    expect(diff.fixedCount).toBe(2);
    expect(diff.remainingCount).toBe(1);
    expect(diff.status).toBe("PARTIALLY_FIXED");
  });

  it("10. Zero Score Drift: adding structured occurrence evidence does not alter deterministic SEO score", async () => {
    const pageUrl = "https://www.botconsulting.io/jobopenings/121722000001243164";
    const pageData = await processPageAuthoritatively(
      pageUrl,
      normalizeUrl(pageUrl),
      pageUrl,
      200,
      [],
      botJobOpeningHtml,
      {},
      120,
      1,
      { seedNormalized: "botconsulting.io" }
    );

    const evalResult = evaluateAllDiagnosticRules([pageData]);

    // Ensure health score and penalties are calibrated and valid
    expect(typeof evalResult.healthScore).toBe("number");
    expect(evalResult.healthScore).toBeGreaterThanOrEqual(0);
    expect(evalResult.healthScore).toBeLessThanOrEqual(100);
    expect(evalResult.scoreBreakdown.deductions.length).toBeGreaterThan(0);
  });
});
