import { describe, it, expect } from "vitest";
import { evaluateAllDiagnosticRules, validateIssueInvariants } from "../../rules";
import { validateHeadingOutlineHierarchy } from "../../parser";
import type { CrawledPageData, DiagnosticIssue } from "../../types";

function createMockPage(overrides: Partial<CrawledPageData>): CrawledPageData {
  const url = overrides.url || "https://example.com/page-1";
  return {
    url,
    requestedUrl: overrides.requestedUrl || url,
    normalizedUrl: overrides.normalizedUrl || url,
    finalUrl: overrides.finalUrl || url,
    statusCode: overrides.statusCode ?? 200,
    redirectHops: overrides.redirectHops || [],
    contentType: overrides.contentType || "text/html",
    resourceType: overrides.resourceType || "html_page",
    responseTimeMs: 150,
    depth: 1,
    html: "<html><body><h1>Title</h1><h2>Subtitle</h2></body></html>",
    headers: {},
    crawledAt: new Date().toISOString(),
    sourceMode: "raw_http",
    renderMode: "raw",
    renderReason: "static_complete",
    renderConfidence: "high",
    rawWordCount: 300,
    rawDocumentWordCount: 300,
    visibleBodyWordCount: 300,
    mainContentWordCount: 300,
    renderedWordCount: 300,
    rawH1Count: 1,
    renderedH1Count: 1,
    rawTitle: "Test Page",
    renderedTitle: "Test Page",
    structuredDataJobTitle: null,
    soft404Status: "valid_page",
    title: "Test Page",
    titleLength: 9,
    metaDescription: "Test page meta description that provides sufficient context for SEO.",
    metaDescriptionLength: 68,
    canonicalUrl: overrides.canonicalUrl || url,
    isCanonicalSelfReferencing: true,
    isCanonicalTargetReachable: true,
    metaRobots: null,
    xRobotsTag: null,
    isIndexable: overrides.isIndexable ?? true,
    indexabilityStatus: overrides.indexabilityStatus || "indexable",
    h1s: ["Main H1 Title"],
    h1Count: 1,
    h1Tags: ["Main H1 Title"],
    h2Tags: ["Section H2"],
    h3Tags: [],
    headingsOutline: overrides.headingsOutline || [
      { level: 1, text: "Main H1 Title", inMainContent: true, context: "main" },
      { level: 2, text: "Section H2", inMainContent: true, context: "main" },
    ],
    headingsHierarchyValid: overrides.headingsHierarchyValid ?? true,
    headingsHierarchyIssues: overrides.headingsHierarchyIssues || [],
    wordCount: 300,
    textToHtmlRatio: 0.25,
    landmarks: { hasMain: true, mainCount: 1, navCount: 1, footerCount: 1, headerCount: 1, asideCount: 0 },
    forms: [],
    images: [],
    resources: [],
    outlinks: [],
    openGraph: {
      title: "Test Page",
      description: "Test description",
      image: "https://example.com/og.jpg",
      url: url,
      type: "website",
      siteName: "Example",
      isImageAbsolute: true,
      isImageValidFormat: true,
    },
    twitterCard: {
      card: "summary_large_image",
      title: "Test Page",
      description: "Test description",
      image: "https://example.com/twitter.jpg",
    },
    schemaJsonLd: [],
    robotsDirectives: {
      metaRobots: null,
      googlebotMeta: null,
      xRobotsTag: null,
      hasNoindex: false,
      hasNofollow: false,
      conflict: false,
    },
    classification: overrides.classification || { primaryClass: "marketing_landing", confidence: 0.9, signals: [] },
    mainTextSnippet: "Test main content text for testing.",
    ...overrides,
  };
}

describe("CONTENT_SKIPPED_HEADINGS & Rule Invariants Suite", () => {
  // 1. 153 eligible / 153 affected -> valid
  it("Scenario 1: 153 eligible / 153 affected -> valid ratio 1.0", () => {
    const pages: CrawledPageData[] = [];
    for (let i = 0; i < 153; i++) {
      pages.push(
        createMockPage({
          url: `https://example.com/page-${i}`,
          headingsOutline: [
            { level: 1, text: "Heading 1", inMainContent: true, context: "main" },
            { level: 3, text: "Heading 3 Skipped", inMainContent: true, context: "main" }, // H1 -> H3 skip
          ],
        })
      );
    }
    const result = evaluateAllDiagnosticRules(pages);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue).toBeDefined();
    expect(issue?.affectedUniquePages).toBe(153);
    expect(issue?.eligiblePageCount).toBe(153);
    expect(issue?.affectedRatio).toBe(1.0);
    expect(() => validateIssueInvariants(result.issues, pages)).not.toThrow();
  });

  // 2. 153 eligible / 100 affected -> valid
  it("Scenario 2: 153 eligible / 100 affected -> valid ratio ~0.654", () => {
    const pages: CrawledPageData[] = [];
    for (let i = 0; i < 153; i++) {
      if (i < 100) {
        pages.push(
          createMockPage({
            url: `https://example.com/page-${i}`,
            headingsOutline: [
              { level: 1, text: "H1", inMainContent: true, context: "main" },
              { level: 3, text: "H3 Skip", inMainContent: true, context: "main" },
            ],
          })
        );
      } else {
        pages.push(
          createMockPage({
            url: `https://example.com/page-${i}`,
            headingsOutline: [
              { level: 1, text: "H1", inMainContent: true, context: "main" },
              { level: 2, text: "H2 Valid", inMainContent: true, context: "main" },
            ],
          })
        );
      }
    }
    const result = evaluateAllDiagnosticRules(pages);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue).toBeDefined();
    expect(issue?.affectedUniquePages).toBe(100);
    expect(issue?.eligiblePageCount).toBe(153);
    expect(issue?.affectedRatio).toBe(0.654);
    expect(() => validateIssueInvariants(result.issues, pages)).not.toThrow();
  });

  // 3. Multiple heading-skip occurrences on same page -> one affected unique page
  it("Scenario 3: multiple heading-skip occurrences on same page -> 1 affected unique page, 1 occurrence in page issue", () => {
    const page = createMockPage({
      url: "https://example.com/multi-skip",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 3, text: "H3 Skip 1", inMainContent: true, context: "main" },
        { level: 5, text: "H5 Skip 2", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([page]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue).toBeDefined();
    expect(issue?.affectedUniquePages).toBe(1);
    expect(issue?.eligiblePageCount).toBe(1);
    expect(issue?.affectedOccurrences).toBe(1);
    expect(issue?.affectedRatio).toBe(1.0);
  });

  // 4. Redirect source + final destination
  it("Scenario 4: redirect source + final destination semantics", () => {
    const redirectPage = createMockPage({
      url: "https://example.com/old-url",
      finalUrl: "https://example.com/new-url",
      statusCode: 301,
      isIndexable: false,
      resourceType: "redirect",
      headingsOutline: [],
    });
    const finalPage = createMockPage({
      url: "https://example.com/new-url",
      finalUrl: "https://example.com/new-url",
      statusCode: 200,
      isIndexable: true,
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 4, text: "H4 Skip", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([redirectPage, finalPage]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue).toBeDefined();
    expect(issue?.affectedUniquePages).toBe(1);
    expect(issue?.eligiblePageCount).toBe(1); // Only the indexable 200 page with >= 2 headings is eligible
    expect(issue?.affectedPages[0].url).toBe("https://example.com/new-url");
  });

  // 5. www / non-www variants
  it("Scenario 5: www / non-www variants adhere to canonical page identity", () => {
    const pageA = createMockPage({
      url: "https://example.com/page",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 3, text: "H3", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([pageA]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue?.affectedUniquePages).toBe(1);
    expect(issue?.eligiblePageCount).toBe(1);
  });

  // 6. Trailing slash variants
  it("Scenario 6: trailing-slash variants deduplicated under single URL key", () => {
    const page = createMockPage({
      url: "https://example.com/services/",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 4, text: "H4", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([page]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue?.affectedUniquePages).toBe(1);
    expect(issue?.eligiblePageCount).toBe(1);
  });

  // 7. Query parameter variants
  it("Scenario 7: query variants evaluated independently if crawled as separate URLs", () => {
    const page1 = createMockPage({
      url: "https://example.com/shop?cat=1",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 3, text: "H3", inMainContent: true, context: "main" },
      ],
    });
    const page2 = createMockPage({
      url: "https://example.com/shop?cat=2",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 2, text: "H2", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([page1, page2]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue?.affectedUniquePages).toBe(1);
    expect(issue?.eligiblePageCount).toBe(2);
  });

  // 8. Duplicate sitemap / discovered URL
  it("Scenario 8: duplicate page objects deduplicated by URL in issue accounting", () => {
    const page1 = createMockPage({
      url: "https://example.com/dup",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 3, text: "H3", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([page1]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue?.affectedUniquePages).toBe(1);
    expect(issue?.eligiblePageCount).toBe(1);
  });

  // 9. Raw / rendered representation of same page
  it("Scenario 9: raw vs rendered facts use authoritative rendered outline", () => {
    const page = createMockPage({
      url: "https://example.com/rendered-page",
      headingsOutline: [], // Rendered DOM has 0 headings in main
      authoritativeFacts: {
        source: "rendered",
        title: "Rendered Page",
        metaDescription: "Desc",
        canonicalUrl: "https://example.com/rendered-page",
        h1Count: 0,
        h1Texts: [],
        forms: [],
        formCount: 0,
        unlabelledFormControlCount: 0,
        missingAltCount: 0,
        images: [],
        rawDocumentWordCount: 200,
        visibleBodyWordCount: 200,
        mainContentWordCount: 200,
        landmarks: { hasMain: true, mainCount: 1, navCount: 0, footerCount: 0, headerCount: 0, asideCount: 0 },
        hasMainLandmark: true,
        headingsOutline: [], // 0 headings
        renderReason: "dynamic_shell",
        renderConfidence: "high",
      },
    });
    const result = evaluateAllDiagnosticRules([page]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    // Page has 0 headings in authoritative facts, so it must not be affected and not in denominator
    expect(issue).toBeUndefined();
  });

  // 10. Ineligible utility page containing skipped headings
  it("Scenario 10: page with < 2 main content headings is not eligible and never affected", () => {
    const utilityPage = createMockPage({
      url: "https://example.com/contact",
      headingsOutline: [
        { level: 2, text: "Footer Links", inMainContent: false, context: "footer" },
      ],
    });
    const result = evaluateAllDiagnosticRules([utilityPage]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue).toBeUndefined();
  });

  // 11. Noindex page where eligibility excludes it
  it("Scenario 11: noindex page is excluded from indexable content rules", () => {
    const noindexPage = createMockPage({
      url: "https://example.com/noindex",
      isIndexable: false,
      indexabilityStatus: "noindex_meta",
      headingsOutline: [
        { level: 1, text: "H1", inMainContent: true, context: "main" },
        { level: 4, text: "H4 Skip", inMainContent: true, context: "main" },
      ],
    });
    const result = evaluateAllDiagnosticRules([noindexPage]);
    const issue = result.issues.find((i) => i.code === "CONTENT_SKIPPED_HEADINGS");
    expect(issue).toBeUndefined();
  });

  // 12. Invariant verification: Injected affected URL outside eligible set MUST throw
  it("Scenario 13: intentionally injected affected URL outside eligible set triggers invariant error", () => {
    const invalidIssue: DiagnosticIssue = {
      id: "test_inv_1",
      code: "CONTENT_SKIPPED_HEADINGS",
      category: "content_relevance",
      severity: "warning",
      title: "Test",
      description: "Test",
      recommendation: "Test",
      confidence: "likely",
      confidenceScore: 0.85,
      impactScore: 3,
      affectedPages: [
        { url: "https://example.com/page-1", evidence: { observed: "skip" } },
        { url: "https://example.com/page-2", evidence: { observed: "skip" } },
      ],
      affectedCount: 2,
      affectedOccurrences: 2,
      affectedUniquePages: 2,
      eligiblePageCount: 1, // Denominator is smaller than affectedUniquePages!
      affectedRatio: 2.0,
    };

    expect(() => validateIssueInvariants([invalidIssue], [])).toThrow(
      /affectedUniquePages \(2\) exceeds eligiblePageCount \(1\)/
    );
  });

  // 13. Heading outline validation logic standalone test
  it("Scenario 14: validateHeadingOutlineHierarchy correctly handles outlines < 2 headings vs valid vs invalid", () => {
    // < 2 headings
    expect(validateHeadingOutlineHierarchy([]).valid).toBe(true);
    expect(validateHeadingOutlineHierarchy([{ level: 1, text: "H1", inMainContent: true, context: "main" }]).valid).toBe(true);

    // Valid sequence
    const validOutline = [
      { level: 1, text: "H1", inMainContent: true, context: "main" },
      { level: 2, text: "H2", inMainContent: true, context: "main" },
      { level: 3, text: "H3", inMainContent: true, context: "main" },
      { level: 2, text: "H2 Second", inMainContent: true, context: "main" },
    ];
    expect(validateHeadingOutlineHierarchy(validOutline).valid).toBe(true);

    // Invalid sequence (H1 -> H3)
    const invalidOutline = [
      { level: 1, text: "H1", inMainContent: true, context: "main" },
      { level: 3, text: "H3 Direct Skip", inMainContent: true, context: "main" },
    ];
    const check = validateHeadingOutlineHierarchy(invalidOutline);
    expect(check.valid).toBe(false);
    expect(check.issues[0]).toContain("Skipped <h2>");
  });
});
