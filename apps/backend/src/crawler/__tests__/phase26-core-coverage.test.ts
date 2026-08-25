import { describe, it, expect } from "vitest";
import { parseHtmlPage } from "../parser";
import { evaluateAllDiagnosticRules, computeRuleExecutionObservability } from "../rules";
import { IMPLEMENTED_DIAGNOSTIC_RULES, getImplementedRulesCount } from "../verification/rule-inventory";
import { validateAllRulesHaveFixIntelligence } from "../fix-intelligence/engine";
import { getRuleVerificationCapability, RULE_VERIFICATION_CAPABILITY_REGISTRY } from "../verification/rule-verification-registry";
import { CANONICAL_118_DIMENSIONS, verifyCanonicalMatrixInvariants } from "../verification/certify-parity-matrix";
import type { CrawledPageData } from "../types";

function createMockPage(overrides: Partial<CrawledPageData> = {}): CrawledPageData {
  const url = overrides.url || "https://example.com/";
  return {
    url,
    requestedUrl: url,
    normalizedUrl: url,
    finalUrl: url,
    statusCode: 200,
    resourceType: "html_page",
    contentType: "text/html",
    responseTimeMs: 120,
    depth: 0,
    isIndexable: true,
    indexabilityStatus: "indexable",
    classification: {
      primaryClass: "homepage",
      confidence: 1.0,
      secondaryClasses: [],
      matchedSignals: [],
    },
    crawledAt: new Date().toISOString(),
    sourceMode: "raw_http",
    title: "Example Website - Premium Platform",
    metaDescription: "An example website description with sufficient length for testing.",
    h1s: ["Welcome to Example"],
    h1Count: 1,
    h1Tags: ["Welcome to Example"],
    h2Tags: ["Features"],
    h3Tags: [],
    wordCount: 450,
    images: [],
    links: [],
    outlinks: [],
    resources: [],
    forms: [],
    landmarks: { hasMain: true, mainCount: 1, hasNav: true, hasHeader: true, hasFooter: true, hasAside: false },
    headingsOutline: [],
    headingsHierarchyValid: true,
    headingsHierarchyIssues: [],
    openGraph: {
      title: "Example Open Graph Title",
      description: "Example OG Description",
      image: "https://example.com/og-image.jpg",
      url: "https://example.com/",
      type: "website",
      rawTags: [
        { property: "og:title", content: "Example Open Graph Title" },
        { property: "og:description", content: "Example OG Description" },
        { property: "og:image", content: "https://example.com/og-image.jpg" },
        { property: "og:url", content: "https://example.com/" },
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
      rawTags: [{ name: "twitter:card", content: "summary_large_image" }],
      isImageAbsolute: true,
    },
    htmlLang: "en",
    html: "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>Example Website - Premium Platform</title><meta name='description' content='An example website description with sufficient length for testing.'><meta name='viewport' content='width=device-width, initial-scale=1'><meta property='og:title' content='Example Open Graph Title'><meta property='og:description' content='Example OG Description'><meta property='og:image' content='https://example.com/og-image.jpg'><meta name='twitter:card' content='summary_large_image'></head><body><main><h1>Welcome to Example</h1><p>Content goes here.</p></main></body></html>",
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-encoding": "br",
      "x-content-type-options": "nosniff",
      "strict-transport-security": "max-age=31536000",
    },
    authoritativeSource: "raw",
    isCompressionEnabled: true,
    hasValidCharset: true,
    htmlCharset: "utf-8",
    deprecatedHtmlTags: [],
    targetBlankWithoutNoopenerLinks: [],
    socialOpenGraphFallbackIssues: { missingTitle: false, missingImage: false, missingDescription: false, isFallbackIncomplete: false },
    lazyLoadingStats: { belowFoldMissingLazyCount: 0, sampleImageUrls: [] },
    legacyFormatImages: [],
    unminifiedResources: [],
    ...overrides,
  } as CrawledPageData;
}

describe("Phase 26 — 100% Defensible Core Client-Audit Parity & 108 Rules", () => {
  it("should have exactly 108 registered diagnostic rules in rule-inventory.ts", () => {
    expect(getImplementedRulesCount()).toBe(108);
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
  });

  it("should have unique rule codes across all 108 rules", () => {
    const codes = IMPLEMENTED_DIAGNOSTIC_RULES.map((r) => r.ruleCode);
    const unique = new Set(codes);
    expect(unique.size).toBe(108);
  });

  it("should maintain 100% Fix Intelligence coverage (108 / 108 rules)", () => {
    const res = validateAllRulesHaveFixIntelligence();
    expect(res.totalImplemented).toBe(108);
    expect(res.coveredCount).toBe(108);
    expect(res.missingCount).toBe(0);
    expect(res.coveragePercent).toBe(100.0);
  });

  it("should maintain 100% issue-level verification capability registry (108 / 108 rules)", () => {
    for (const rule of IMPLEMENTED_DIAGNOSTIC_RULES) {
      const cap = getRuleVerificationCapability(rule.ruleCode);
      expect(cap).toBeDefined();
      expect(cap.ruleId).toBe(rule.ruleCode);
    }
  });

  it("should certify 118 / 118 canonical dimensions with 100% defensible capability coverage", () => {
    const matrix = verifyCanonicalMatrixInvariants();
    expect(matrix.total).toBe(118);
    expect(matrix.uniqueIds).toBe(118);
    expect(matrix.fullyCovered).toBe(113);
    expect(matrix.providerConditional).toBe(3);
    expect(matrix.intentionallyNotHardError).toBe(2);
    expect(matrix.strictCoveragePercent).toBeCloseTo(95.76, 1);
    expect(matrix.defensibleCapabilityCoveragePercent).toBe(100.0);
    expect(matrix.invariantsPassed).toBe(true);
  });

  describe("Rule 102: HTML_CHARSET_MISSING", () => {
    it("flags HTML documents missing charset declaration", () => {
      const page = createMockPage({
        hasValidCharset: false,
        htmlCharset: null,
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "HTML_CHARSET_MISSING");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("warning");
    });

    it("passes when charset is declared via meta charset", () => {
      const page = createMockPage({
        hasValidCharset: true,
        htmlCharset: "utf-8",
      });
      const result = evaluateAllDiagnosticRules([page]);
      expect(result.issues.find((i) => i.code === "HTML_CHARSET_MISSING")).toBeUndefined();
    });
  });

  describe("Rule 103: SEC_TARGET_BLANK_NOOPENER", () => {
    it("flags external links with target=_blank lacking noopener/noreferrer", () => {
      const page = createMockPage({
        targetBlankWithoutNoopenerLinks: [{ href: "https://external-partner.com", text: "Partner", rel: null }],
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "SEC_TARGET_BLANK_NOOPENER");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("notice");
      expect(issue?.impactScore).toBe(0); // Non-scoring notice
    });
  });

  describe("Rule 104: HTML_DEPRECATED_TAGS", () => {
    it("flags documents containing deprecated tags (<marquee>, <font>, <center>)", () => {
      const page = createMockPage({
        deprecatedHtmlTags: ["center", "marquee"],
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "HTML_DEPRECATED_TAGS");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("notice");
      expect(issue?.impactScore).toBe(0);
    });
  });

  describe("Rule 105: SOCIAL_OPENGRAPH_FALLBACK", () => {
    it("flags indexable pages with incomplete Open Graph fallback metadata", () => {
      const page = createMockPage({
        socialOpenGraphFallbackIssues: {
          missingTitle: false,
          missingImage: true,
          missingDescription: true,
          isFallbackIncomplete: true,
        },
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "SOCIAL_OPENGRAPH_FALLBACK");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("notice");
    });
  });

  describe("Rule 106: ASSET_LAZY_LOADING_MISSING", () => {
    it("flags below-the-fold content images missing loading=lazy", () => {
      const page = createMockPage({
        lazyLoadingStats: {
          belowFoldMissingLazyCount: 3,
          sampleImageUrls: ["/img3.jpg", "/img4.jpg"],
        },
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "ASSET_LAZY_LOADING_MISSING");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("notice");
    });
  });

  describe("Rule 107: IMAGE_LEGACY_FORMAT", () => {
    it("flags large legacy image formats (> 100 KB PNG/JPEG)", () => {
      const page = createMockPage({
        legacyFormatImages: [{ url: "https://example.com/huge.png", format: "PNG", byteSize: 350000 }],
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "IMAGE_LEGACY_FORMAT");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("notice");
    });
  });

  describe("Rule 108: ASSET_UNMINIFIED_RESOURCE", () => {
    it("flags unminified internal CSS/JS resources (> 20 KB)", () => {
      const page = createMockPage({
        unminifiedResources: [{ url: "https://example.com/styles.css", type: "css", byteSize: 45000 }],
      });
      const result = evaluateAllDiagnosticRules([page]);
      const issue = result.issues.find((i) => i.code === "ASSET_UNMINIFIED_RESOURCE");
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe("notice");
    });
  });

  describe("Execution Observability & Score Model", () => {
    it("returns scoreModelVersion 'v26-108'", () => {
      const page = createMockPage();
      const result = evaluateAllDiagnosticRules([page]);
      expect(result.scoreModelVersion).toBe("v26-108");
    });

    it("observability telemetry includes all 108 rules with strictly valid invariants", () => {
      const page = createMockPage();
      const result = evaluateAllDiagnosticRules([page]);
      const records = result.ruleExecutionObservability;
      expect(records.length).toBe(108);

      for (const rec of records) {
        expect(rec.eligibleCount).toBe(rec.evaluatedCount + rec.skippedCount);
        expect(rec.evaluatedCount).toBe(rec.passedCount + rec.failedCount);
        expect(["PASSED", "FAILED", "SKIPPED", "NOT_APPLICABLE"]).toContain(rec.status);
      }
    });
  });
});
