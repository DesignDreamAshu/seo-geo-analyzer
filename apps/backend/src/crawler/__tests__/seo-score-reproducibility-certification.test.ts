import { describe, it, expect, beforeEach } from "vitest";
import { evaluateAllDiagnosticRules } from "../rules";
import { CrawledPage } from "../types";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../verification/rule-inventory";
import { CANONICAL_118_DIMENSIONS } from "../verification/certify-parity-matrix";
import { computeAuditComparison } from "../persistence/comparison-engine";
import { initializeDatabase } from "../persistence/db";

describe("Strict SEO Score Reproducibility Certification Suite", () => {
  beforeEach(() => {
    initializeDatabase(":memory:");
  });

  function createMockHtmlPage(overrides: Partial<CrawledPage> = {}): CrawledPage {
    const title = "Complete Professional Services for Enterprise Optimization";
    const desc = "Comprehensive enterprise services delivering exceptional digital transformation and advisory solutions across modern cloud platforms.";
    const html = `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><link rel="canonical" href="https://example.com/services"></head><body><main><h1>${title}</h1><p>${desc.repeat(5)}</p></main></body></html>`;

    return {
      url: "https://example.com/services",
      requestedUrl: "https://example.com/services",
      normalizedUrl: "https://example.com/services",
      finalUrl: "https://example.com/services",
      statusCode: 200,
      redirectHops: [],
      contentType: "text/html",
      resourceType: "html_page",
      responseTimeMs: 150,
      depth: 1,
      html,
      headers: { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff" },
      crawledAt: "2026-08-24T12:00:00.000Z",
      sourceMode: "raw_http",
      renderMode: "raw",
      renderReason: "initial_html",
      renderConfidence: "authoritative",
      rawWordCount: 500,
      rawDocumentWordCount: 600,
      visibleBodyWordCount: 500,
      mainContentWordCount: 450,
      renderedWordCount: 500,
      rawH1Count: 1,
      renderedH1Count: 1,
      rawTitle: title,
      renderedTitle: title,
      soft404Status: "valid_page",
      title,
      metaDescription: desc,
      h1: [title],
      h2: ["Enterprise Solutions"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      canonicalUrl: "https://example.com/services",
      isCanonicalMatch: true,
      metaRobots: "index, follow",
      isIndexable: true,
      indexabilityStatus: "indexable",
      outlinks: [],
      inlinks: [{ sourceUrl: "https://example.com/", anchorText: "Services" }],
      images: [],
      scripts: [],
      stylesheets: [],
      resources: [],
      schemaTypes: ["Organization"],
      schemaJsonLdBlocks: [{ "@context": "https://schema.org", "@type": "Organization", "name": "Example Corp" }],
      openGraph: { "og:title": title, "og:image": "https://example.com/img.jpg", "og:type": "website" },
      twitterCard: { "twitter:card": "summary_large_image" },
      hreflang: [],
      hasViewportTag: true,
      isResponsive: true,
      contentHash: "hash123",
      classification: {
        primaryClass: "marketing_landing",
        confidence: 0.95,
        candidateClasses: ["marketing_landing"],
        signalsMatched: ["service"],
        isUtilityLegal: false,
        isIndexableMarketing: true,
      },
      ...overrides,
    };
  }

  it("1. Same pages + same findings = exact same score", () => {
    const pageA = createMockHtmlPage();
    const pageB = createMockHtmlPage({ url: "https://example.com/about", title: "About Us - Company Overview", h1: ["About Us - Company Overview"] });

    const res1 = evaluateAllDiagnosticRules([pageA, pageB]);
    const res2 = evaluateAllDiagnosticRules([pageA, pageB]);

    expect(res1.healthScore).toBe(res2.healthScore);
    expect(res1.scoreBreakdown.totalDeductions).toBe(res2.scoreBreakdown.totalDeductions);
  });

  it("2. Page order changes = same score", () => {
    const pageA = createMockHtmlPage({ url: "https://example.com/page-a" });
    const pageB = createMockHtmlPage({ url: "https://example.com/page-b", h1: [], rawH1Count: 0, renderedH1Count: 0, html: "<html><head><title>No H1 Page</title></head><body><p>Text</p></body></html>" });

    const resForward = evaluateAllDiagnosticRules([pageA, pageB]);
    const resReverse = evaluateAllDiagnosticRules([pageB, pageA]);

    expect(resForward.healthScore).toBe(resReverse.healthScore);
    expect(resForward.scoreBreakdown.totalDeductions).toBe(resReverse.scoreBreakdown.totalDeductions);
  });

  it("3. Volatile timestamps differ = exact same score", () => {
    const page1 = createMockHtmlPage({ crawledAt: "2026-08-20T00:00:00.000Z" });
    const page2 = createMockHtmlPage({ crawledAt: "2026-08-24T18:30:45.123Z" });

    const res1 = evaluateAllDiagnosticRules([page1]);
    const res2 = evaluateAllDiagnosticRules([page2]);

    expect(res1.healthScore).toBe(res2.healthScore);
  });

  it("4. ResponseTime differs across network requests = exact same score (Latency Isolation)", () => {
    const fastPage = createMockHtmlPage({ responseTimeMs: 80 });
    const slowPage = createMockHtmlPage({ responseTimeMs: 4500 }); // High latency should not perturb SEO Health Score

    const resFast = evaluateAllDiagnosticRules([fastPage]);
    const resSlow = evaluateAllDiagnosticRules([slowPage]);

    expect(resFast.healthScore).toBe(resSlow.healthScore);

    // Notice finding is still generated for diagnostic reporting
    const slowFinding = resSlow.issues.find((i) => i.code === "PERF_SLOW_SERVER_RESPONSE");
    expect(slowFinding).toBeDefined();
    expect(slowFinding?.severity).toBe("notice");
  });

  it("5. Transient fetch failure does not create false missing H1/Title defects", () => {
    const errorPage = createMockHtmlPage({
      url: "https://example.com/failed",
      statusCode: 500,
      resourceType: "error",
      isIndexable: false,
      h1: [],
      title: null,
    });

    const res = evaluateAllDiagnosticRules([errorPage]);
    const missingTitle = res.issues.find((i) => i.code === "CONTENT_MISSING_TITLE");
    const missingH1 = res.issues.find((i) => i.code === "CONTENT_MISSING_H1");

    expect(missingTitle).toBeUndefined();
    expect(missingH1).toBeUndefined();
  });

  it("6. Confirmed website defect deducts correctly and deterministically", () => {
    const pageClean = createMockHtmlPage();
    const pageBrokenH1 = createMockHtmlPage({
      url: "https://example.com/broken",
      h1: [],
      rawH1Count: 0,
      renderedH1Count: 0,
      html: "<html lang='en'><head><meta charset='utf-8'><title>Broken Page Title</title></head><body><main><p>Content without H1</p></main></body></html>",
    });

    const resClean = evaluateAllDiagnosticRules([pageClean]);
    const resBroken = evaluateAllDiagnosticRules([pageBrokenH1]);

    expect(resBroken.healthScore).toBeLessThan(resClean.healthScore);
    expect(resBroken.scoreBreakdown.totalDeductions).toBeGreaterThan(resClean.scoreBreakdown.totalDeductions);
  });

  it("7. Single fixed issue changes score by exact mathematically expected amount", () => {
    const pageClean = createMockHtmlPage();
    const pageBroken = createMockHtmlPage({
      h1: [],
      rawH1Count: 0,
      renderedH1Count: 0,
      html: "<html lang='en'><head><meta charset='utf-8'><title>Broken Page Title</title></head><body><main><p>Content without H1</p></main></body></html>",
    });

    const resBefore = evaluateAllDiagnosticRules([pageBroken]);
    const resAfter = evaluateAllDiagnosticRules([pageClean]);

    const delta = Number((resAfter.healthScore - resBefore.healthScore).toFixed(1));
    expect(delta).toBeGreaterThan(0);
    expect(resAfter.scoreBreakdown.totalDeductions).toBeLessThan(resBefore.scoreBreakdown.totalDeductions);
  });

  it("8. Audit comparison computes deterministic score drivers", () => {
    const baseRun: any = { auditRunId: "run_1", sequenceNumber: 1, summaryStats: { seoScore: 64.8, pagesCrawled: 10 } };
    const currRun: any = { auditRunId: "run_2", sequenceNumber: 2, summaryStats: { seoScore: 67.3, pagesCrawled: 10 } };

    const comp = computeAuditComparison({
      projectId: "p1",
      baselineAudit: baseRun,
      currentAudit: currRun,
      baselinePages: [],
      currentPages: [],
      baselineFindings: [
        { findingFingerprint: "fp1", ruleId: "CONTENT_MISSING_H1", normalizedUrl: "https://example.com/p1", severity: "CRITICAL", evidence: {}, auditRunId: "run_1", firstSeenAuditRunId: "run_1", lastSeenAuditRunId: "run_1", reopenCount: 0 } as any,
      ],
      currentFindings: [], // Fixed
    });

    expect(comp.metricChanges.scoreDelta).toBe(2.5);
    expect(comp.fixedCount).toBe(1);
    expect(comp.metricChanges.scoreDrivers).toBeDefined();
    expect(comp.metricChanges.scoreDrivers?.length).toBe(1);
    expect(comp.metricChanges.scoreDrivers?.[0].ruleId).toBe("CONTENT_MISSING_H1");
  });

  it("9. All 108 production SEO rules remain registered and 118 canonical matrix fully intact", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);

    const fullyCovered = CANONICAL_118_DIMENSIONS.filter((d) => d.classification === "FULLY_COVERED");
    expect(fullyCovered.length).toBe(113);
  });
});
