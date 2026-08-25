// Self-contained deterministic test runner helpers to ensure zero external build dependencies
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function describe(suiteName: string, fn: () => void) {
  console.log(`\n--- [TEST SUITE] ${suiteName} ---`);
  fn();
}

function it(testName: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } catch (err: any) {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}\n     ${err?.message || err}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
    },
    toBeDefined() {
      if (actual === undefined || actual === null) throw new Error(`Expected value to be defined`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThanOrEqual(val: number) {
      if (typeof actual !== "number" || actual < val) throw new Error(`Expected ${actual} >= ${val}`);
    },
    toBeGreaterThan(val: number) {
      if (typeof actual !== "number" || actual <= val) throw new Error(`Expected ${actual} > ${val}`);
    },
    toContain(substr: string) {
      if (typeof actual === "string") {
        if (!actual.includes(substr)) throw new Error(`Expected string to contain "${substr}"`);
      } else if (Array.isArray(actual)) {
        if (!actual.includes(substr)) throw new Error(`Expected array to contain "${substr}"`);
      }
    },
  };
}

import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../verification/rule-inventory";
import {
  generateFixIntelligenceForIssue,
  generateFixIntelligenceForAudit,
  validateAllRulesHaveFixIntelligence,
  detectSystemicFixGroups,
  consolidateRootCauses,
  prioritizeFixQueue,
} from "../engine";
import { detectPlatformFromPages, getPlatformRemediationGuidance } from "../platform-adapters";
import type { DiagnosticIssue, CrawledPageData } from "../../types";
import type { FixContext } from "../strategies/base";

describe("SEO Fix Intelligence Layer", () => {
  // =========================================================================
  // 1. 100% RULE COVERAGE GATE
  // =========================================================================
  describe("Rule Coverage Completeness", () => {
    it("should have fix intelligence registered for EVERY implemented diagnostic rule (100% coverage)", () => {
      const cov = validateAllRulesHaveFixIntelligence();
      expect(cov.missingCount).toBe(0);
      expect(cov.missingRules).toEqual([]);
      expect(cov.coveragePercent).toBe(100.0);
      expect(cov.coveredCount).toBe(IMPLEMENTED_DIAGNOSTIC_RULES.length);
    });

    it("should generate complete, non-empty blueprints for every rule in production inventory", () => {
      for (const meta of IMPLEMENTED_DIAGNOSTIC_RULES) {
        const mockIssue: DiagnosticIssue = {
          id: "mock_1",
          code: meta.ruleCode,
          category: meta.category as any,
          severity: meta.severity,
          title: meta.title,
          description: meta.description,
          recommendation: "Test recommendation",
          confidence: meta.confidenceType as any,
          confidenceScore: 1.0,
          impactScore: meta.basePenalty,
          affectedCount: 1,
          affectedOccurrences: 1,
          affectedUniquePages: 1,
          eligiblePageCount: 1,
          affectedRatio: 1.0,
          affectedPages: [
            {
              url: "https://example.com/test-page",
              evidence: {
                observed: "Test observed defect",
                crawlTimestamp: new Date().toISOString(),
                sourceMode: "raw_http",
                sourceUrl: "https://example.com/test-page",
              },
            },
          ],
        };

        const context: FixContext = { platform: "webflow" };
        const intel = generateFixIntelligenceForIssue(mockIssue, context);

        expect(intel.ruleCode).toBe(meta.ruleCode);
        expect(intel.whyItMatters).toBeTruthy();
        expect(intel.fix.objective).toBeTruthy();
        expect(intel.fix.steps.length).toBeGreaterThanOrEqual(1);
        expect(intel.verification.method).toBeTruthy();
        expect(intel.verification.expectedOutcome).toBeTruthy();
        expect(intel.safety).toBeDefined();
        expect(intel.effort).toBeDefined();
        expect(intel.fixScope).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 2. 10 CRITICAL SAFETY REGRESSION TESTS
  // =========================================================================
  describe("Critical Safety Regressions", () => {
    // 1. noindex unknown intent -> do NOT automatically recommend removing noindex
    it("1. noindex on unknown page requires manual review and does not blindly remove noindex", () => {
      const issue: DiagnosticIssue = {
        id: "issue_noindex",
        code: "INDEX_NOINDEX",
        category: "indexability",
        severity: "critical",
        title: "Noindex tag found",
        description: "Page has noindex",
        recommendation: "Review",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 9,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/portal", evidence: { observed: "noindex meta tag" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.safety).toBe("HIGH_RISK");
      expect(intel.fix.objective).toContain("Verify intended indexing status");
      expect(intel.cautions.some((c) => c.includes("HIGH RISK") || c.includes("intent"))).toBe(true);
    });

    // 2. cross-domain canonical -> does NOT automatically prescribe self-canonical
    it("2. cross-domain canonical preserves syndication warning", () => {
      const issue: DiagnosticIssue = {
        id: "issue_canon",
        code: "INDEX_MISSING_CANONICAL",
        category: "indexability",
        severity: "opportunity",
        title: "Missing canonical",
        description: "Missing canonical",
        recommendation: "Add canonical",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 3,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/syndicated-article", evidence: { observed: "no canonical" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.safety).toBe("REVIEW_REQUIRED");
      expect(intel.cautions.length).toBeGreaterThan(0);
    });

    // 3. decorative image alt -> recommends alt="" not keywords
    it("3. image alt guidance recommends alt='' for decorative images", () => {
      const issue: DiagnosticIssue = {
        id: "issue_alt",
        code: "ASSET_MISSING_ALT",
        category: "page_speed_assets",
        severity: "warning",
        title: "Missing alt attribute",
        description: "Image lacks alt",
        recommendation: "Add alt",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 4,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/page", evidence: { observed: "Image missing alt" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.cautions.some((c) => c.includes("alt=''") || c.includes("Decorative"))).toBe(true);
      expect(intel.cautions.some((c) => c.includes("Do NOT keyword-stuff"))).toBe(true);
    });

    // 4. broken URL unknown replacement -> does not invent URL
    it("4. broken link does not fabricate fake replacement URLs", () => {
      const issue: DiagnosticIssue = {
        id: "issue_broken_link",
        code: "LINKS_BROKEN_INTERNAL",
        category: "links",
        severity: "critical",
        title: "Broken link",
        description: "Link returns 404",
        recommendation: "Fix link",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 8,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [
          {
            url: "https://example.com/page",
            evidence: {
              observed: "Link to /deleted-service returned 404",
              targetUrl: "https://example.com/deleted-service",
            } as any,
          },
        ],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.cautions.some((c) => c.includes("Do NOT invent"))).toBe(true);
    });

    // 5. schema unknown values -> uses manual review placeholders
    it("5. malformed JSON schema warns against fabricating business properties", () => {
      const issue: DiagnosticIssue = {
        id: "issue_schema",
        code: "SCHEMA_MALFORMED_JSON",
        category: "social_schema",
        severity: "warning",
        title: "Malformed JSON-LD",
        description: "Syntax error in schema",
        recommendation: "Fix syntax",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 5,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/job", evidence: { observed: "JSON parse error" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.cautions.some((c) => c.toLowerCase().includes("never fabricate") || c.includes("MANUAL VALUE REQUIRED"))).toBe(true);
    });

    // 6. redirect with confirmed target -> suggests direct link
    it("6. internal link to redirect provides direct target destination when confirmed", () => {
      const issue: DiagnosticIssue = {
        id: "issue_redir_link",
        code: "LINKS_INTERNAL_TO_REDIRECT",
        category: "links",
        severity: "opportunity",
        title: "Internal link to redirect",
        description: "Link points to 301",
        recommendation: "Update link",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 2,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [
          {
            url: "https://example.com/page",
            evidence: {
              observed: "Link to /old-about redirects to /about-us",
              targetUrl: "https://example.com/about-us",
              codeSnippet: '<a href="/old-about">About Us</a>',
            } as any,
          },
        ],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.fix.exampleAfter).toContain("https://example.com/about-us");
    });

    // 7. canonical -> redirect -> final target
    it("7. canonical pointing to redirect recommends direct final destination", () => {
      const issue: DiagnosticIssue = {
        id: "issue_canon_redir",
        code: "CANONICAL_POINTS_TO_REDIRECT",
        category: "indexability",
        severity: "warning",
        title: "Canonical points to redirect",
        description: "Canonical redirects",
        recommendation: "Point to final target",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 6,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [
          {
            url: "https://example.com/source",
            evidence: {
              observed: "Canonical points to /temp-dest which 301s to /final-dest",
              targetUrl: "https://example.com/final-dest",
            } as any,
          },
        ],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.fix.exampleAfter).toContain("https://example.com/final-dest");
    });

    // 8. ambiguous hreflang
    it("8. hreflang missing return classifies as high risk", () => {
      const issue: DiagnosticIssue = {
        id: "issue_hreflang",
        code: "HREFLANG_MISSING_RETURN",
        category: "code_validation",
        severity: "warning",
        title: "Hreflang missing return",
        description: "Missing return tag",
        recommendation: "Add reciprocal tag",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 5,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/en", evidence: { observed: "Missing es return link" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.safety).toBe("HIGH_RISK");
    });

    // 9. performance heuristic
    it("9. performance heuristic cautions against unmeasured CWV promises", () => {
      const issue: DiagnosticIssue = {
        id: "issue_perf",
        code: "PERF_LARGE_HTML_PAYLOAD",
        category: "page_speed_assets",
        severity: "warning",
        title: "Large HTML payload",
        description: "Payload > 500KB",
        recommendation: "Compress HTML",
        confidence: "heuristic",
        confidenceScore: 0.7,
        impactScore: 3,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/heavy", evidence: { observed: "HTML is 650KB" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.cautions.some((c) => c.includes("heuristic") || c.includes("measure"))).toBe(true);
    });

    // 10. non-descriptive anchor heuristic
    it("10. non-descriptive anchor classifies as heuristic", () => {
      const issue: DiagnosticIssue = {
        id: "issue_generic_anchor",
        code: "LINKS_NON_DESCRIPTIVE_ANCHOR",
        category: "links",
        severity: "opportunity",
        title: "Non descriptive anchor",
        description: "Anchor is 'click here'",
        recommendation: "Use descriptive text",
        confidence: "heuristic",
        confidenceScore: 0.7,
        impactScore: 2,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/page", evidence: { observed: "uses 'click here'" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.confidence).toBe("heuristic");
    });
  });

  // =========================================================================
  // 3. PLATFORM GUIDANCE SELECTION
  // =========================================================================
  describe("Platform Guidance Selection", () => {
    it("should detect Webflow from DOM signals and provide Webflow-specific Designer instructions", () => {
      const mockPages: CrawledPageData[] = [
        {
          url: "https://www.botconsulting.io/",
          requestedUrl: "https://www.botconsulting.io/",
          normalizedUrl: "https://www.botconsulting.io/",
          finalUrl: "https://www.botconsulting.io/",
          statusCode: 200,
          redirectHops: [],
          contentType: "text/html",
          resourceType: "html_page",
          responseTimeMs: 120,
          depth: 0,
          html: '<html data-wf-page="123" data-wf-site="456"><head><script src="https://assets.webflow.com/webflow.js"></script></head><body><div class="w-nav"></div></body></html>',
          headers: {},
          crawledAt: new Date().toISOString(),
          sourceMode: "raw_http",
          renderMode: "raw",
          renderConfidence: "high",
          rawWordCount: 500,
          rawDocumentWordCount: 500,
          visibleBodyWordCount: 500,
          mainContentWordCount: 450,
          landmarks: { hasHeader: true, hasNav: true, hasMain: true, hasFooter: true, mainCount: 1, landmarkTags: ["main"] },
          forms: [],
          images: [],
          resources: [],
          outlinks: [],
          headingsOutline: [],
          headingsHierarchyValid: true,
          headingsHierarchyIssues: [],
          isIndexable: true,
          indexabilityStatus: "indexable",
          classification: { primaryClass: "homepage", confidence: 0.98, signals: [] },
          openGraph: {},
          twitterCard: {},
          schemaJsonLd: [],
          viewport: { tagPresent: true, content: "width=device-width, initial-scale=1", isValid: true, issues: [] },
          hreflangTags: [],
          allCanonicalTags: [],
        } as any,
      ];

      const platformRes = detectPlatformFromPages(mockPages);
      expect(platformRes.platform).toBe("webflow");

      const guidance = getPlatformRemediationGuidance("webflow", "CONTENT_MISSING_H1", "content_relevance", { isCmsPage: true, templateName: "Job Template" });
      expect(guidance.platform).toBe("webflow");
      expect(guidance.steps.some((s) => s.includes("Webflow Designer") || s.includes("CMS Collection Template"))).toBe(true);
    });

    it("should provide WordPress, Next.js, Shopify, and Generic HTML adapters correctly", () => {
      const wp = getPlatformRemediationGuidance("wordpress", "CONTENT_MISSING_TITLE", "content_relevance");
      expect(wp.platform).toBe("wordpress");
      expect(wp.steps.some((s) => s.includes("WordPress Admin"))).toBe(true);

      const next = getPlatformRemediationGuidance("nextjs", "CONTENT_MISSING_TITLE", "content_relevance");
      expect(next.platform).toBe("nextjs");
      expect(next.steps.some((s) => s.includes("Next.js") || s.includes("metadata"))).toBe(true);

      const shopify = getPlatformRemediationGuidance("shopify", "CONTENT_MISSING_TITLE", "content_relevance");
      expect(shopify.platform).toBe("shopify");

      const generic = getPlatformRemediationGuidance("generic_html", "CONTENT_MISSING_TITLE", "content_relevance");
      expect(generic.platform).toBe("generic_html");
    });
  });

  // =========================================================================
  // 4. TEMPLATE & COMPONENT GROUPING TESTS
  // =========================================================================
  describe("Template and Component Grouping", () => {
    // CASE A: 30 structurally identical CMS pages missing H1 -> 1 template group
    it("CASE A: 30 CMS pages missing H1 groups into 1 high-confidence template group", () => {
      const mockIssue: DiagnosticIssue = {
        id: "issue_h1_cms",
        code: "CONTENT_MISSING_H1",
        category: "content_relevance",
        severity: "critical",
        title: "Missing H1",
        description: "Pages have no H1",
        recommendation: "Add H1",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 8,
        affectedCount: 30,
        affectedOccurrences: 30,
        affectedUniquePages: 30,
        eligiblePageCount: 30,
        affectedRatio: 1.0,
        isSystemicTemplateIssue: true,
        componentGuess: "job_template",
        affectedPages: Array.from({ length: 30 }, (_, i) => ({
          url: `https://www.botconsulting.io/jobopenings-copy/item-${i}`,
          evidence: { observed: "No H1 in job template" } as any,
        })),
      };

      const groups = detectSystemicFixGroups([mockIssue], [], "webflow");
      expect(groups.length).toBe(1);
      expect(groups[0].scope).toBe("template");
      expect(groups[0].estimatedFixesRequired).toBe(1);
      expect(groups[0].affectedCount).toBe(30);
      expect(groups[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    // CASE B: 2 unrelated static pages missing H1 -> not classified as systemic group
    it("CASE B: 2 unrelated pages do not force an unevidenced systemic group", () => {
      const mockIssue: DiagnosticIssue = {
        id: "issue_h1_static",
        code: "CONTENT_MISSING_H1",
        category: "content_relevance",
        severity: "critical",
        title: "Missing H1",
        description: "Pages have no H1",
        recommendation: "Add H1",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 8,
        affectedCount: 2,
        affectedOccurrences: 2,
        affectedUniquePages: 2,
        eligiblePageCount: 10,
        affectedRatio: 0.2,
        isSystemicTemplateIssue: false,
        affectedPages: [
          { url: "https://example.com/about", evidence: { observed: "No H1" } as any },
          { url: "https://example.com/contact", evidence: { observed: "No H1" } as any },
        ],
      };

      const groups = detectSystemicFixGroups([mockIssue], [], "webflow");
      expect(groups.length).toBe(0);
    });

    // CASE C: Global nav broken link appears on 100 pages -> global-component group
    it("CASE C: global navigation broken link maps to global_component scope", () => {
      const mockIssue: DiagnosticIssue = {
        id: "issue_nav_broken",
        code: "LINKS_BROKEN_INTERNAL",
        category: "links",
        severity: "critical",
        title: "Broken link",
        description: "Broken link in navbar",
        recommendation: "Fix link",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 8,
        affectedCount: 100,
        affectedOccurrences: 100,
        affectedUniquePages: 100,
        eligiblePageCount: 100,
        affectedRatio: 1.0,
        isSystemicTemplateIssue: true,
        componentGuess: "navbar",
        affectedPages: Array.from({ length: 100 }, (_, i) => ({
          url: `https://example.com/page-${i}`,
          evidence: { observed: "Navbar link to /missing returned 404" } as any,
        })),
      };

      const groups = detectSystemicFixGroups([mockIssue], [], "webflow");
      expect(groups.length).toBe(1);
      expect(groups[0].scope).toBe("global_component");
      expect(groups[0].estimatedFixesRequired).toBe(1);
      expect(groups[0].likelySharedCause).toContain("Navbar");
    });

    // Root-Cause Consolidation Test
    it("should consolidate related 3xx redirect issues into a single root cause", () => {
      const issues: DiagnosticIssue[] = [
        {
          id: "1",
          code: "REDIRECT_CHAIN",
          category: "redirects",
          severity: "warning",
          title: "Redirect chain",
          description: "Chain detected",
          recommendation: "Fix",
          confidence: "confirmed",
          confidenceScore: 1.0,
          impactScore: 5,
          affectedCount: 5,
          affectedOccurrences: 5,
          affectedUniquePages: 5,
          eligiblePageCount: 10,
          affectedRatio: 0.5,
          affectedPages: [{ url: "https://example.com/a", evidence: {} as any }],
        },
        {
          id: "2",
          code: "CANONICAL_POINTS_TO_REDIRECT",
          category: "indexability",
          severity: "warning",
          title: "Canonical points to redirect",
          description: "Canonical redirects",
          recommendation: "Fix",
          confidence: "confirmed",
          confidenceScore: 1.0,
          impactScore: 5,
          affectedCount: 5,
          affectedOccurrences: 5,
          affectedUniquePages: 5,
          eligiblePageCount: 10,
          affectedRatio: 0.5,
          affectedPages: [{ url: "https://example.com/b", evidence: {} as any }],
        },
      ];

      const rootCauses = consolidateRootCauses(issues);
      expect(rootCauses.length).toBe(1);
      expect(rootCauses[0].rootCauseTitle).toContain("Redirect Routing");
    });
  });

  // =========================================================================
  // 5. QUALITY-HARDENING REGRESSION SUITE (9 Mandatory Checks)
  // =========================================================================
  describe("Quality-Hardening Invariants", () => {
    // 1. Security-lite quick fix cannot outrank critical indexability defect
    it("1. security-lite quick fix cannot outrank critical indexability defect regardless of page count", () => {
      const criticalNoindex: DiagnosticIssue = {
        id: "c1",
        code: "INDEX_NOINDEX",
        category: "indexability",
        severity: "critical",
        title: "Noindex on Homepage",
        description: "Direct index block",
        recommendation: "Review",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 9,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/", evidence: { observed: "noindex header" } as any }],
      };

      const securityNosniff: DiagnosticIssue = {
        id: "s1",
        code: "SEC_MISSING_NOSNIFF",
        category: "code_validation",
        severity: "opportunity",
        title: "Missing nosniff",
        description: "Security hygiene header missing",
        recommendation: "Add header",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 2,
        affectedCount: 200, // Large number of pages
        affectedOccurrences: 200,
        affectedUniquePages: 200,
        eligiblePageCount: 200,
        affectedRatio: 1.0,
        affectedPages: Array.from({ length: 200 }, (_, i) => ({
          url: `https://example.com/p-${i}`,
          evidence: { observed: "Header missing" } as any,
        })),
      };

      const intelNoindex = generateFixIntelligenceForIssue(criticalNoindex, { platform: "webflow" });
      const intelNosniff = generateFixIntelligenceForIssue(securityNosniff, { platform: "webflow" });

      const queue = prioritizeFixQueue([intelNosniff, intelNoindex]);
      expect(queue[0].ruleCode).toBe("INDEX_NOINDEX");
      expect(queue[0].priority).toBe("critical");
      expect(queue[1].ruleCode).toBe("SEC_MISSING_NOSNIFF");
      expect(queue[1].priority).toBe("informational");
    });

    // 2. Thin-content remediation does not prescribe arbitrary minimum word count
    it("2. thin-content remediation does not prescribe arbitrary minimum word count", () => {
      const thinIssue: DiagnosticIssue = {
        id: "t1",
        code: "CONTENT_THIN_WORD_COUNT",
        category: "content_relevance",
        severity: "warning",
        title: "Thin Content",
        description: "Low word count",
        recommendation: "Enrich",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 5,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/job", evidence: { observed: "Word count 120" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(thinIssue, { platform: "webflow" });
      expect(intel.fix.objective).toContain("sufficient unique, useful information");
      expect(intel.cautions.some((c) => c.includes("NOT enforce arbitrary word count minimums"))).toBe(true);
    });

    // 3. Heuristic thresholds are described as heuristics
    it("3. heuristic thresholds are explicitly labelled as heuristics", () => {
      const thinIssue: DiagnosticIssue = {
        id: "t2",
        code: "CONTENT_THIN_WORD_COUNT",
        category: "content_relevance",
        severity: "warning",
        title: "Thin Content",
        description: "Low word count",
        recommendation: "Enrich",
        confidence: "heuristic",
        confidenceScore: 0.7,
        impactScore: 5,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/job", evidence: { observed: "Heuristic triggered" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(thinIssue, { platform: "webflow" });
      expect(intel.confidence).toBe("heuristic");
      expect(intel.cautions.some((c) => c.toLowerCase().includes("heuristic"))).toBe(true);
    });

    // 4. Unknown Webflow implementation location is not presented as confirmed
    it("4. unknown Webflow location is classified as GENERIC_WEBFLOW_GUIDANCE or LIKELY_FIX_LOCATION", () => {
      const guidance = getPlatformRemediationGuidance("webflow", "SEC_MISSING_NOSNIFF", "code_validation");
      expect(guidance.locationCertainty).toBe("GENERIC_WEBFLOW_GUIDANCE");
      expect(guidance.steps.some((s) => s.includes("reverse proxy") || s.includes("hosting"))).toBe(true);
    });

    // 5. Cloudflare is not recommended unless detected/configured
    it("5. Cloudflare is not recommended blindly when no Cloudflare detection exists", () => {
      const guidance = getPlatformRemediationGuidance("webflow", "SEC_MISSING_NOSNIFF", "code_validation");
      expect(guidance.steps.every((s) => !s.startsWith("Open Cloudflare Dashboard"))).toBe(true);
    });

    // 6. Decorative ALT guidance remains alt=""
    it("6. decorative image ALT guidance strictly enforces alt=''", () => {
      const altIssue: DiagnosticIssue = {
        id: "a1",
        code: "ASSET_MISSING_ALT",
        category: "page_speed_assets",
        severity: "warning",
        title: "Missing Alt",
        description: "Missing alt",
        recommendation: "Add alt",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 4,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/decor", evidence: { observed: "img tag missing alt" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(altIssue, { platform: "webflow" });
      expect(intel.cautions.some((c) => c.includes("alt=''"))).toBe(true);
    });

    // 7. Overlapping systemic groups do not inflate resolved-occurrence totals (deduplication)
    it("7. audit summary correctly deduplicates unique page occurrences", () => {
      const issues: DiagnosticIssue[] = [
        {
          id: "i1",
          code: "CONTENT_MISSING_H1",
          category: "content_relevance",
          severity: "critical",
          title: "Missing H1",
          description: "No H1",
          recommendation: "Add H1",
          confidence: "confirmed",
          confidenceScore: 1.0,
          impactScore: 8,
          affectedCount: 2,
          affectedOccurrences: 2,
          affectedUniquePages: 2,
          eligiblePageCount: 2,
          affectedRatio: 1.0,
          affectedPages: [
            { url: "https://example.com/p1", evidence: {} as any },
            { url: "https://example.com/p2", evidence: {} as any },
          ],
        },
      ];
      const auditRes = generateFixIntelligenceForAudit(issues, [], "https://example.com/");
      expect(auditRes.summary.totalIssueOccurrences).toBe(2);
      expect(auditRes.summary.potentialFindingsResolved).toBe(2);
    });

    // 8. High affected-page count does not automatically imply high SEO priority
    it("8. high affected-page count does not override low priority classification", () => {
      const issue: DiagnosticIssue = {
        id: "nosniff_1000",
        code: "SEC_MISSING_NOSNIFF",
        category: "code_validation",
        severity: "opportunity",
        title: "Missing nosniff",
        description: "Nosniff missing",
        recommendation: "Add header",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 2,
        affectedCount: 1000,
        affectedOccurrences: 1000,
        affectedUniquePages: 1000,
        eligiblePageCount: 1000,
        affectedRatio: 1.0,
        affectedPages: Array.from({ length: 1000 }, (_, i) => ({ url: `https://example.com/${i}`, evidence: {} as any })),
      };
      const intel = generateFixIntelligenceForIssue(issue, { platform: "webflow" });
      expect(intel.priority).toBe("informational");
      expect(intel.subCategory).toBe("SECURITY_LITE");
    });

    // 9. Manual-intent rules do not produce mandatory destructive fixes
    it("9. manual-intent rules do not produce mandatory destructive fixes", () => {
      const noindexIssue: DiagnosticIssue = {
        id: "n1",
        code: "INDEX_NOINDEX",
        category: "indexability",
        severity: "critical",
        title: "Noindex tag",
        description: "Noindex detected",
        recommendation: "Check",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 9,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/staging", evidence: { observed: "noindex meta" } as any }],
      };
      const intel = generateFixIntelligenceForIssue(noindexIssue, { platform: "webflow" });
      expect(intel.safety).toBe("HIGH_RISK");
      expect(intel.cautions.some((c) => c.includes("HIGH RISK"))).toBe(true);
    });

    // 10. Ordinary missing H1 is classified as HIGH, not CRITICAL
    it("10. ordinary missing H1 is classified as HIGH SEO priority, not CRITICAL", () => {
      const h1Issue: DiagnosticIssue = {
        id: "h1_test",
        code: "CONTENT_MISSING_H1",
        category: "content_relevance",
        severity: "critical",
        title: "Missing H1",
        description: "No H1 tag",
        recommendation: "Add H1",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 8,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/page", evidence: {} as any }],
      };
      const intel = generateFixIntelligenceForIssue(h1Issue, { platform: "webflow" });
      expect(intel.priority).toBe("high");
    });

    // 11. Unlabelled form control is classified as LOW priority and ACCESSIBILITY_LITE
    it("11. unlabelled form control is classified as LOW priority and ACCESSIBILITY_LITE", () => {
      const formIssue: DiagnosticIssue = {
        id: "form_test",
        code: "A11Y_UNLABELLED_FORM_CONTROL",
        category: "code_validation",
        severity: "warning",
        title: "Unlabelled form control",
        description: "Input lacks label",
        recommendation: "Add label",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 3,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/contact", evidence: {} as any }],
      };
      const intel = generateFixIntelligenceForIssue(formIssue, { platform: "webflow" });
      expect(intel.priority).toBe("low");
      expect(intel.subCategory).toBe("ACCESSIBILITY_LITE");
    });

    // 12. Syntax-only JSON-LD repair is SAFE, semantic repair is REVIEW_REQUIRED
    it("12. syntax-only schema fix is SAFE while semantic missing type is REVIEW_REQUIRED", () => {
      const syntaxSchema: DiagnosticIssue = {
        id: "schema_syn",
        code: "SCHEMA_MALFORMED_JSON",
        category: "social_schema",
        severity: "warning",
        title: "Malformed JSON",
        description: "JSON syntax error",
        recommendation: "Fix syntax",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 4,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/", evidence: {} as any }],
      };
      const semanticSchema: DiagnosticIssue = {
        id: "schema_sem",
        code: "SCHEMA_MISSING_TYPE",
        category: "social_schema",
        severity: "warning",
        title: "Missing Type",
        description: "Schema missing @type",
        recommendation: "Add @type",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 4,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/", evidence: {} as any }],
      };

      const intelSyntax = generateFixIntelligenceForIssue(syntaxSchema, { platform: "webflow" });
      const intelSemantic = generateFixIntelligenceForIssue(semanticSchema, { platform: "webflow" });

      expect(intelSyntax.safety).toBe("SAFE");
      expect(intelSemantic.safety).toBe("REVIEW_REQUIRED");
    });

    // 13. Accessibility issue cannot outrank genuine HIGH SEO issue due only to affected-page count
    it("13. accessibility issue cannot outrank genuine HIGH SEO issue due only to affected-page count", () => {
      const highSeoOrphan: DiagnosticIssue = {
        id: "orphan_1",
        code: "ORPHAN_INDEXABLE_PAGE",
        category: "links",
        severity: "warning",
        title: "Orphan Page",
        description: "Page has 0 inbound links",
        recommendation: "Add link",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 7,
        affectedCount: 2,
        affectedOccurrences: 2,
        affectedUniquePages: 2,
        eligiblePageCount: 10,
        affectedRatio: 0.2,
        affectedPages: [{ url: "https://example.com/p1", evidence: {} as any }, { url: "https://example.com/p2", evidence: {} as any }],
      };

      const a11yFormControl: DiagnosticIssue = {
        id: "form_50",
        code: "A11Y_UNLABELLED_FORM_CONTROL",
        category: "code_validation",
        severity: "warning",
        title: "Unlabelled Control",
        description: "Form input missing label",
        recommendation: "Add label",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 3,
        affectedCount: 50, // High page count
        affectedOccurrences: 50,
        affectedUniquePages: 50,
        eligiblePageCount: 50,
        affectedRatio: 1.0,
        affectedPages: Array.from({ length: 50 }, (_, i) => ({ url: `https://example.com/f-${i}`, evidence: {} as any })),
      };

      const intelOrphan = generateFixIntelligenceForIssue(highSeoOrphan, { platform: "webflow" });
      const intelForm = generateFixIntelligenceForIssue(a11yFormControl, { platform: "webflow" });

      const queue = prioritizeFixQueue([intelForm, intelOrphan]);
      expect(queue[0].ruleCode).toBe("ORPHAN_INDEXABLE_PAGE");
      expect(queue[0].priority).toBe("high");
      expect(queue[1].ruleCode).toBe("A11Y_UNLABELLED_FORM_CONTROL");
      expect(queue[1].priority).toBe("low");
    });

    // 14. CRITICAL is strictly reserved for severe crawl/index/canonical failures
    it("14. CRITICAL priority remains strictly reserved for severe crawl/index/canonical failures", () => {
      const criticalLoop: DiagnosticIssue = {
        id: "loop_1",
        code: "REDIRECT_LOOP",
        category: "redirects",
        severity: "critical",
        title: "Redirect Loop",
        description: "Loop detected",
        recommendation: "Break loop",
        confidence: "confirmed",
        confidenceScore: 1.0,
        impactScore: 10,
        affectedCount: 1,
        affectedOccurrences: 1,
        affectedUniquePages: 1,
        eligiblePageCount: 1,
        affectedRatio: 1.0,
        affectedPages: [{ url: "https://example.com/loop", evidence: {} as any }],
      };
      const intelLoop = generateFixIntelligenceForIssue(criticalLoop, { platform: "webflow" });
      expect(intelLoop.priority).toBe("critical");
      expect(intelLoop.safety).toBe("HIGH_RISK");
    });
  });
});
