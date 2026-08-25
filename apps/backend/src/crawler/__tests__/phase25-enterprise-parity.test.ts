import { describe, it, expect } from "vitest";
import { parseHtmlPage, calculateAccessibleName } from "../parser";
import { evaluateAllDiagnosticRules, computeRuleExecutionObservability } from "../rules";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../verification/rule-inventory";
import { validateAllRulesHaveFixIntelligence } from "../fix-intelligence/engine";
import { getRuleVerificationCapability, RULE_VERIFICATION_CAPABILITY_REGISTRY } from "../verification/rule-verification-registry";
import type { CrawledPageData } from "../types";

function createMockPage(overrides: Partial<CrawledPageData> = {}): CrawledPageData {
  const url = overrides.url || "https://example.com/";
  return {
    url,
    requestedUrl: url,
    normalizedUrl: url,
    finalUrl: url,
    statusCode: 200,
    statusText: "OK",
    resourceType: "html_page",
    contentType: "text/html",
    mimeType: "text/html",
    depth: 0,
    isExternal: false,
    isSeed: true,
    isIndexable: true,
    indexabilityStatus: "indexable",
    indexabilityReasons: [],
    classification: {
      primaryClass: "homepage",
      confidence: 1.0,
      secondaryClasses: [],
      matchedSignals: [],
    },
    crawledAt: new Date().toISOString(),
    sourceMode: "raw_http",
    title: "Example Website",
    metaDescription: "An example website description.",
    headings: { h1: ["Welcome to Example"], h2: ["About Us"], h3: [], h4: [], h5: [], h6: [] },
    headingsHierarchyValid: true,
    headingsHierarchyIssues: [],
    h1s: ["Welcome to Example"],
    h1Count: 1,
    wordCount: 450,
    images: [],
    links: [],
    outlinks: [],
    resources: [],
    forms: [],
    landmarks: { hasMain: true, mainCount: 1, hasNav: true, hasHeader: true, hasFooter: true },
    headingsOutline: [],
    openGraph: {
      title: "Example Open Graph Title",
      description: "Example OG Description",
      image: "https://example.com/og-image.jpg",
      url: "https://example.com/",
      type: "website",
      rawTags: [
        { property: "og:title", content: "Example Open Graph Title" },
        { property: "og:image", content: "https://example.com/og-image.jpg" },
      ],
      isImageAbsolute: true,
      isImageValidFormat: true,
      duplicateTags: [],
      emptyTags: [],
    },
    twitterCard: {
      card: "summary_large_image",
      title: "Example Open Graph Title",
      description: "Example OG Description",
      image: "https://example.com/og-image.jpg",
      hasExplicitCard: true,
    },
    schemaBlocks: [],
    schemaJsonLd: [],
    viewport: { tagPresent: true, isValid: true, content: "width=device-width, initial-scale=1.0", issues: [] },
    canonicalUrl: "https://example.com/",
    htmlLang: "en",
    buttons: [{ tag: "button", text: "Submit", isLabelled: true }],
    iframes: [],
    isCompressionEnabled: true,
    rawHtmlByteLength: 12000,
    responseTimeMs: 250,
    headers: {
      "content-type": "text/html",
      "content-encoding": "gzip",
    },
    html: "<html><head><title>Example Website</title></head><body><main><h1>Welcome to Example</h1></main></body></html>",
    redirectHops: [],
    ...overrides,
  };
}

function parseTestHtml(html: string, url = "https://example.com/"): CrawledPageData {
  return parseHtmlPage(url, url, url, 200, [], html, { "content-type": "text/html" }, 200, 0, url);
}

describe("Phase 25 — Enterprise Client-Audit Parity & Observability Test Suite", () => {
  // 1. RULE INVENTORY & FIX INTELLIGENCE CERTIFICATION
  describe("Rule Inventory & Registry Invariants", () => {
    it("should register enabled production diagnostic rules (>= 101)", () => {
      expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBeGreaterThanOrEqual(101);
      const uniqueCodes = new Set(IMPLEMENTED_DIAGNOSTIC_RULES.map((r) => r.ruleCode));
      expect(uniqueCodes.size).toBe(IMPLEMENTED_DIAGNOSTIC_RULES.length);
    });

    it("should have 100% deterministic Fix Intelligence coverage", () => {
      const fixCoverage = validateAllRulesHaveFixIntelligence();
      expect(fixCoverage.coveredCount).toBe(fixCoverage.totalImplemented);
      expect(fixCoverage.missingCount).toBe(0);
      expect(fixCoverage.coveragePercent).toBe(100.0);
    });

    it("should provide valid verification capability for all 101 rules", () => {
      for (const rule of IMPLEMENTED_DIAGNOSTIC_RULES) {
        const capability = getRuleVerificationCapability(rule.ruleCode);
        expect(capability).toBeDefined();
        expect(capability.ruleId).toBe(rule.ruleCode);
        expect(["TARGETED_SUPPORTED", "TARGETED_WITH_RENDERING", "TARGETED_WITH_EXTERNAL_CHECK", "FULL_AUDIT_REQUIRED", "MANUAL_REVIEW"]).toContain(capability.capability);
      }
    });
  });

  // 2. HTML_LANG_MISSING
  describe("Rule: HTML_LANG_MISSING", () => {
    it("should extract htmlLang from parser", () => {
      const parsedWithLang = parseTestHtml('<html lang="en-US"><head><title>Test</title></head><body><h1>Hello</h1></body></html>');
      expect(parsedWithLang.htmlLang).toBe("en-US");

      const parsedWithoutLang = parseTestHtml("<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>");
      expect(parsedWithoutLang.htmlLang).toBeNull();
    });

    it("should flag HTML_LANG_MISSING when <html> has no lang attribute", () => {
      const page = createMockPage({ htmlLang: null });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "HTML_LANG_MISSING");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
      expect(issue?.affectedUniquePages).toBe(1);
    });

    it("should pass cleanly when <html> has valid lang attribute", () => {
      const page = createMockPage({ htmlLang: "en" });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "HTML_LANG_MISSING");
      expect(issue).toBeUndefined();
    });

    it("should not flag non-HTML or utility endpoints", () => {
      const utilityPage = createMockPage({
        htmlLang: null,
        classification: { primaryClass: "utility_endpoint", confidence: 1.0, secondaryClasses: [], matchedSignals: [] },
      });
      const audit = evaluateAllDiagnosticRules([utilityPage]);
      const issue = audit.issues.find((i) => i.code === "HTML_LANG_MISSING");
      expect(issue).toBeUndefined();
    });
  });

  // 3. A11Y_BUTTON_NAME_MISSING
  describe("Rule: A11Y_BUTTON_NAME_MISSING", () => {
    it("should extract buttons with accessible names in parser", () => {
      const html = `
        <button id="btn1"><svg></svg></button>
        <button id="btn2" aria-label="Search site"><svg></svg></button>
        <button id="btn3">Send Message</button>
        <input type="submit" id="btn4" value="Log In">
      `;
      const parsed = parseTestHtml(html);
      expect(parsed.buttons.length).toBe(4);
      expect(parsed.buttons[0].isLabelled).toBe(false);
      expect(parsed.buttons[1].isLabelled).toBe(true);
      expect(parsed.buttons[2].isLabelled).toBe(true);
      expect(parsed.buttons[3].isLabelled).toBe(true);
    });

    it("should flag A11Y_BUTTON_NAME_MISSING when interactive buttons lack accessible names", () => {
      const page = createMockPage({
        buttons: [{ tag: "button", text: "", domSelector: "button.icon-search", isLabelled: false }],
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "A11Y_BUTTON_NAME_MISSING");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
      expect(issue?.affectedUniquePages).toBe(1);
    });

    it("should pass cleanly when all buttons have accessible names", () => {
      const page = createMockPage({
        buttons: [
          { tag: "button", text: "Submit", isLabelled: true },
          { tag: "button", ariaLabel: "Close modal", isLabelled: true },
        ],
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "A11Y_BUTTON_NAME_MISSING");
      expect(issue).toBeUndefined();
    });
  });

  // 4. A11Y_IFRAME_TITLE_MISSING
  describe("Rule: A11Y_IFRAME_TITLE_MISSING", () => {
    it("should extract iframes and detect missing titles in parser", () => {
      const html = `
        <iframe id="f1" src="/map"></iframe>
        <iframe id="f2" src="/video" title="Introductory Video"></iframe>
        <iframe id="f3" src="/tracker" aria-hidden="true" style="display:none"></iframe>
      `;
      const parsed = parseTestHtml(html);
      expect(parsed.iframes.length).toBe(3);
      expect(parsed.iframes[0].title).toBeNull();
      expect(parsed.iframes[0].isHidden).toBe(false);
      expect(parsed.iframes[1].title).toBe("Introductory Video");
      expect(parsed.iframes[2].isHidden).toBe(true);
    });

    it("should flag A11Y_IFRAME_TITLE_MISSING when visible <iframe> lacks title", () => {
      const page = createMockPage({
        iframes: [{ src: "/embed/map", title: null, isHidden: false, domSelector: "iframe#map" }],
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "A11Y_IFRAME_TITLE_MISSING");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("opportunity");
    });

    it("should pass cleanly when all visible iframes have descriptive titles", () => {
      const page = createMockPage({
        iframes: [{ src: "/embed/map", title: "HQ Map", isHidden: false }],
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "A11Y_IFRAME_TITLE_MISSING");
      expect(issue).toBeUndefined();
    });
  });

  // 5. IMAGE_OVERSIZED_FILE
  describe("Rule: IMAGE_OVERSIZED_FILE", () => {
    it("should flag IMAGE_OVERSIZED_FILE when image transfer size > 250 KB", () => {
      const page = createMockPage({
        images: [
          {
            src: "/heavy-hero.png",
            resolvedUrl: "https://example.com/heavy-hero.png",
            byteSize: 320 * 1024, // 320 KB
            alt: "Hero Banner",
            altState: "valid",
            hasAltAttribute: true,
            hasDimensions: true,
            isDecorative: false,
            isLinked: false,
            loading: "eager",
          },
        ],
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "IMAGE_OVERSIZED_FILE");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("opportunity");
    });

    it("should pass cleanly when images are <= 250 KB", () => {
      const page = createMockPage({
        images: [
          {
            src: "/optimized-hero.webp",
            resolvedUrl: "https://example.com/optimized-hero.webp",
            byteSize: 180 * 1024, // 180 KB
            alt: "Hero Banner",
            altState: "valid",
            hasAltAttribute: true,
            hasDimensions: true,
            isDecorative: false,
            isLinked: false,
            loading: "eager",
          },
        ],
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "IMAGE_OVERSIZED_FILE");
      expect(issue).toBeUndefined();
    });
  });

  // 6. SOCIAL_TWITTER_CARD_MISSING
  describe("Rule: SOCIAL_TWITTER_CARD_MISSING", () => {
    it("should flag SOCIAL_TWITTER_CARD_MISSING when page has social metadata but no twitter:card", () => {
      const page = createMockPage({
        classification: { primaryClass: "article_blog", confidence: 1.0, secondaryClasses: [], matchedSignals: [] },
        openGraph: {
          title: "Blog Post Title",
          description: "Blog Description",
          image: "https://example.com/blog.jpg",
          url: "https://example.com/blog/1",
          type: "article",
          rawTags: [{ property: "og:title", content: "Blog Post Title" }],
          isImageAbsolute: true,
          isImageValidFormat: true,
          duplicateTags: [],
          emptyTags: [],
        },
        twitterCard: {
          hasExplicitCard: false,
        },
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "SOCIAL_TWITTER_CARD_MISSING");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("opportunity");
    });

    it("should pass cleanly when twitter:card is explicitly declared", () => {
      const page = createMockPage({
        classification: { primaryClass: "article_blog", confidence: 1.0, secondaryClasses: [], matchedSignals: [] },
        twitterCard: {
          card: "summary_large_image",
          hasExplicitCard: true,
        },
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "SOCIAL_TWITTER_CARD_MISSING");
      expect(issue).toBeUndefined();
    });
  });

  // 7. PERF_COMPRESSION_DISABLED
  describe("Rule: PERF_COMPRESSION_DISABLED", () => {
    it("should flag PERF_COMPRESSION_DISABLED when large HTML > 10 KB is uncompressed", () => {
      const page = createMockPage({
        statusCode: 200,
        rawHtmlByteLength: 25000,
        isCompressionEnabled: false,
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "PERF_COMPRESSION_DISABLED");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
    });

    it("should pass cleanly when HTML is served with Gzip/Brotli compression", () => {
      const page = createMockPage({
        statusCode: 200,
        rawHtmlByteLength: 25000,
        isCompressionEnabled: true,
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "PERF_COMPRESSION_DISABLED");
      expect(issue).toBeUndefined();
    });

    it("should not flag small HTML responses <= 10 KB", () => {
      const page = createMockPage({
        statusCode: 200,
        rawHtmlByteLength: 7500,
        isCompressionEnabled: false,
      });
      const audit = evaluateAllDiagnosticRules([page]);
      const issue = audit.issues.find((i) => i.code === "PERF_COMPRESSION_DISABLED");
      expect(issue).toBeUndefined();
    });
  });

  // 8. RULE EXECUTION OBSERVABILITY & INVARIANTS
  describe("Rule Execution Observability Telemetry", () => {
    it("should emit execution records for all rules and satisfy strict mathematical invariants", () => {
      const page = createMockPage();
      const audit = evaluateAllDiagnosticRules([page]);

      expect(audit.scoreModelVersion).toBe("v26-108");
      expect(audit.ruleExecutionObservability).toBeDefined();
      expect(audit.ruleExecutionObservability?.length).toBeGreaterThanOrEqual(101);

      for (const record of audit.ruleExecutionObservability!) {
        // Invariant 1: eligibleCount = evaluatedCount + skippedCount
        expect(record.eligibleCount).toBe(record.evaluatedCount + record.skippedCount);

        // Invariant 2: evaluatedCount = passedCount + failedCount
        expect(record.evaluatedCount).toBe(record.passedCount + record.failedCount);

        // Invariant 3: non-negative counts
        expect(record.eligibleCount).toBeGreaterThanOrEqual(0);
        expect(record.evaluatedCount).toBeGreaterThanOrEqual(0);
        expect(record.passedCount).toBeGreaterThanOrEqual(0);
        expect(record.failedCount).toBeGreaterThanOrEqual(0);
        expect(record.skippedCount).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
