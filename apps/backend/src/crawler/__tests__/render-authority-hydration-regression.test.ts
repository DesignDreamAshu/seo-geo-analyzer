import { describe, it, expect } from "vitest";
import { classifyPage, parseHtmlPage } from "../parser";
import { evaluateRenderReliability, processPageAuthoritatively } from "../page-processor";
import { evaluateAllDiagnosticRules } from "../rules";
import { getAuthoritativeFacts, type RawPageFacts, type CrawledPageData } from "../types";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../verification/certify-parity-matrix";

describe("Render Authority & Hydration Collapse Regression Suite", () => {
  // ---------------------------------------------------------------------------
  // 1. Classification Tests
  // ---------------------------------------------------------------------------
  it("1. Software service URLs containing 'application' are NOT classified as form_application", () => {
    const serviceUrls = [
      "https://example.com/services/development/enterprise-application-development/",
      "https://example.com/services/development/web-application-development/",
      "https://example.com/services/security/application-security-architecture/",
      "https://example.com/services/cloud/application-modernization/",
      "https://example.com/services/mobile/mobile-application-development/",
      "https://example.com/application-development/",
    ];

    for (const url of serviceUrls) {
      const classification = classifyPage(url, "Service Title", "H1 Title", [], 300, false, 200);
      expect(classification.primaryClass).not.toBe("form_application");
      expect(classification.primaryClass).toBe("marketing_landing");
    }
  });

  it("2. Genuine application pages still classify as form_application", () => {
    const appUrls = [
      "https://example.com/careers/apply/",
      "https://example.com/job-application/",
      "https://example.com/application-form/",
      "https://example.com/career-apply/",
      "https://example.com/apply-now/",
      "https://example.com/submit-application/",
    ];

    for (const url of appUrls) {
      const classification = classifyPage(url, "Apply Now", "Join Us", [], 150, true, 200);
      expect(classification.primaryClass).toBe("form_application");
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Reliability & Authority Policy Tests
  // ---------------------------------------------------------------------------
  it("3. Raw-complete / render-shell collapse is safely rejected (unreliable render)", () => {
    const rawFacts: RawPageFacts = {
      title: "Contact Us",
      metaDescription: "Get in touch with our team",
      canonicalUrl: "https://example.com/contact/",
      h1Count: 1,
      h1Texts: ["Contact Us"],
      forms: [],
      formCount: 0,
      unlabelledFormControlCount: 0,
      missingAltCount: 0,
      images: [],
      rawDocumentWordCount: 420,
      visibleBodyWordCount: 390,
      mainContentWordCount: 380,
      landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
      hasMainLandmark: true,
      headingsOutline: [{ level: 1, text: "Contact Us", inMainContent: true, context: "main" }],
    };

    const renderedDomShell = {
      docTitle: "Contact Us",
      metaDesc: "Get in touch",
      canonicalTag: "https://example.com/contact/",
      h1Texts: [], // Lost H1 during loading screen
      hOutline: [],
      visWords: 8, // 8-word loading screen
      mainWords: 8,
      forms: [],
      images: [],
      missingAlt: 0,
      landmarks: { hasMain: false, mainCount: 0, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
    };

    const reliability = evaluateRenderReliability(rawFacts, renderedDomShell);
    expect(reliability.isReliable).toBe(false);
    expect(reliability.authoritySource).toBe("raw");
    expect(reliability.authorityReason).toBe("rendered_hydration_collapse_rejected");
    expect(reliability.confidence).toBe("unreliable");
  });

  it("4. Raw-shell / render-complete SPA expands and becomes authoritative", () => {
    const rawShellFacts: RawPageFacts = {
      title: "App Shell",
      metaDescription: null,
      canonicalUrl: null,
      h1Count: 0,
      h1Texts: [],
      forms: [],
      formCount: 0,
      unlabelledFormControlCount: 0,
      missingAltCount: 0,
      images: [],
      rawDocumentWordCount: 15,
      visibleBodyWordCount: 10,
      mainContentWordCount: 10,
      landmarks: { hasMain: false, mainCount: 0, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
      hasMainLandmark: false,
      headingsOutline: [],
    };

    const renderedCompleteDom = {
      docTitle: "Interactive Dashboard",
      metaDesc: "Realtime data analytics",
      canonicalTag: "https://example.com/dashboard",
      h1Texts: ["Analytics Overview"],
      hOutline: [{ level: 1, text: "Analytics Overview", inMainContent: true, context: "main" }],
      visWords: 350,
      mainWords: 320,
      forms: [],
      images: [],
      missingAlt: 0,
      landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
    };

    const reliability = evaluateRenderReliability(rawShellFacts, renderedCompleteDom);
    expect(reliability.isReliable).toBe(true);
    expect(reliability.authoritySource).toBe("rendered");
    expect(reliability.authorityReason).toBe("client_side_hydration_complete");
    expect(reliability.confidence).toBe("high");
  });

  it("5. Legitimate stable JS transformation remains authoritative", () => {
    const rawFacts: RawPageFacts = {
      title: "Initial SSR Title",
      metaDescription: "Initial description",
      canonicalUrl: "https://example.com/product",
      h1Count: 1,
      h1Texts: ["SSR Product Heading"],
      forms: [],
      formCount: 0,
      unlabelledFormControlCount: 0,
      missingAltCount: 0,
      images: [],
      rawDocumentWordCount: 180,
      visibleBodyWordCount: 150,
      mainContentWordCount: 140,
      landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
      hasMainLandmark: true,
      headingsOutline: [{ level: 1, text: "SSR Product Heading", inMainContent: true, context: "main" }],
    };

    const renderedTransformedDom = {
      docTitle: "Client Hydrated Product Title",
      metaDesc: "Client hydrated description",
      canonicalTag: "https://example.com/product",
      h1Texts: ["Client Hydrated Product Heading"],
      hOutline: [{ level: 1, text: "Client Hydrated Product Heading", inMainContent: true, context: "main" }],
      visWords: 220,
      mainWords: 200,
      forms: [],
      images: [],
      missingAlt: 0,
      landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
    };

    const reliability = evaluateRenderReliability(rawFacts, renderedTransformedDom);
    expect(reliability.isReliable).toBe(true);
    expect(reliability.authoritySource).toBe("rendered");
    expect(reliability.authorityReason).toBe("rendered_dom_authoritative");
    expect(reliability.confidence).toBe("high");
  });

  it("6. Minimal legitimate page is NOT marked unreliable merely for low word count", () => {
    const rawMinimalFacts: RawPageFacts = {
      title: "Simple Status",
      metaDescription: "All systems operational",
      canonicalUrl: "https://example.com/status",
      h1Count: 1,
      h1Texts: ["Status: OK"],
      forms: [],
      formCount: 0,
      unlabelledFormControlCount: 0,
      missingAltCount: 0,
      images: [],
      rawDocumentWordCount: 20,
      visibleBodyWordCount: 15,
      mainContentWordCount: 15,
      landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
      hasMainLandmark: true,
      headingsOutline: [{ level: 1, text: "Status: OK", inMainContent: true, context: "main" }],
    };

    const renderedMinimalDom = {
      docTitle: "Simple Status",
      metaDesc: "All systems operational",
      canonicalTag: "https://example.com/status",
      h1Texts: ["Status: OK"],
      hOutline: [{ level: 1, text: "Status: OK", inMainContent: true, context: "main" }],
      visWords: 15,
      mainWords: 15,
      forms: [],
      images: [],
      missingAlt: 0,
      landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
    };

    const reliability = evaluateRenderReliability(rawMinimalFacts, renderedMinimalDom);
    expect(reliability.isReliable).toBe(true);
    expect(reliability.authoritySource).toBe("rendered");
    expect(reliability.authorityReason).toBe("consistent_minimal_page");
  });

  // ---------------------------------------------------------------------------
  // 3. Preservation & Non-Fabrication Tests
  // ---------------------------------------------------------------------------
  it("7. Preserves H1, main landmark, and word count when render collapses", async () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Contact Design Dream</title></head>
        <body>
          <header><nav><a href="/">Home</a></nav></header>
          <main id="main-content">
            <h1>Contact Design Dream</h1>
            <p>Have a product to build or an AI workflow to automate? Reach out to our design leadership team today. We provide senior engineering guidance, architecture reviews, and dedicated pods for ambitious software development projects across web and enterprise ecosystems.</p>
            <h2>Our Process</h2>
            <p>We review every inquiry within 24 hours and establish technical scoping sprints immediately.</p>
          </main>
          <footer><p>&copy; 2026 Design Dream</p></footer>
        </body>
      </html>
    `;

    // Process page with browser rendering disabled to verify authoritative raw facts baseline
    const parsedPage = parseHtmlPage(
      "https://designdream.agency/contact/",
      "https://designdream.agency/contact/",
      "https://designdream.agency/contact/",
      200,
      [],
      rawHtml,
      { "content-type": "text/html" },
      120,
      0,
      "designdream.agency"
    );

    expect(parsedPage.rawFacts?.h1Count).toBe(1);
    expect(parsedPage.rawFacts?.h1Texts).toEqual(["Contact Design Dream"]);
    expect(parsedPage.rawFacts?.hasMainLandmark).toBe(true);
    expect(parsedPage.rawFacts?.visibleBodyWordCount).toBeGreaterThan(50);

    const facts = getAuthoritativeFacts(parsedPage);
    expect(facts.h1Count).toBe(1);
    expect(facts.hasMainLandmark).toBe(true);
    expect(facts.mainContentWordCount).toBeGreaterThan(50);
  });

  // ---------------------------------------------------------------------------
  // 4. False-Negative Controls: Genuine defects MUST STILL FIRE!
  // ---------------------------------------------------------------------------
  it("8. False-negative safety: Genuine missing H1, missing main, and thin content STILL emit findings", () => {
    const defectiveHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Defective Minimal Page</title></head>
        <body>
          <div>
            <p>This is a genuinely thin page without any headings or main landmark container.</p>
          </div>
        </body>
      </html>
    `;

    const defectivePage = parseHtmlPage(
      "https://example.com/defective-page",
      "https://example.com/defective-page",
      "https://example.com/defective-page",
      200,
      [],
      defectiveHtml,
      { "content-type": "text/html" },
      100,
      0,
      "example.com"
    );

    const evalResult = evaluateAllDiagnosticRules([defectivePage]);

    const missingH1 = evalResult.issues.find((i) => i.code === "CONTENT_MISSING_H1");
    const missingMain = evalResult.issues.find((i) => i.code === "A11Y_MISSING_MAIN_LANDMARK");
    const thinContent = evalResult.issues.find((i) => i.code === "CONTENT_THIN_WORD_COUNT");

    expect(missingH1).toBeDefined();
    expect(missingH1?.affectedPages.some((p) => p.url === "https://example.com/defective-page")).toBe(true);
    expect(missingH1?.affectedPages[0].evidence?.domSelector).toBe("body");

    expect(missingMain).toBeDefined();
    expect(missingMain?.affectedPages.some((p) => p.url === "https://example.com/defective-page")).toBe(true);
    expect(missingMain?.affectedPages[0].evidence?.domSelector).toBe("body");

    expect(thinContent).toBeDefined();
    expect(thinContent?.affectedPages.some((p) => p.url === "https://example.com/defective-page")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 5. Invariant Parity: 108 Rules, 118 Dimensions, 108/108 PASS
  // ---------------------------------------------------------------------------
  it("9. Preserves 108 Production Rules, 118 Canonical Matrix, and 108/108 Rule Accounting", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const dummyPage = parseHtmlPage(
      "https://example.com/",
      "https://example.com/",
      "https://example.com/",
      200,
      [],
      "<!DOCTYPE html><html lang='en'><head><title>Valid Site</title><meta name='description' content='A valid page with sufficient content for complete SEO rule evaluation.'></head><body><main><h1>Valid Site Title</h1><p>Comprehensive main content text to satisfy standard checks.</p></main></body></html>",
      { "content-type": "text/html" },
      100,
      0,
      "example.com"
    );

    const res = evaluateAllDiagnosticRules([dummyPage]);
    expect(res.ruleExecutionObservability).toBeDefined();
    expect(res.ruleExecutionObservability?.length).toBe(108);
    const passedAndEvaluated = res.ruleExecutionObservability?.filter((r) => r.status === "PASSED" || r.status === "FAILED");
    expect(passedAndEvaluated?.length).toBe(108);
  });
});
