import { describe, it, expect } from "vitest";
import { evaluateOnSiteAISearchReadiness } from "../engine";
import { evaluateRobotsAccessForAgent } from "../technical/crawler-accessibility";
import { CANONICAL_118_DIMENSIONS } from "../../crawler/verification/certify-parity-matrix";
import { IMPLEMENTED_DIAGNOSTIC_RULES } from "../../crawler/verification/rule-inventory";
import type { CrawledPageData } from "../../crawler/types";

describe("Phase 28B: On-Site AI Search Readiness Engine", () => {
  it("preserves 100% SEO isolation invariants (108 rules, 118 canonical matrix)", () => {
    expect(IMPLEMENTED_DIAGNOSTIC_RULES.length).toBe(108);
    expect(CANONICAL_118_DIMENSIONS.length).toBe(118);
  });

  it("evaluates robots.txt AI crawler policies with RFC 9309 semantics", () => {
    const robotsTxt = `
User-agent: *
Disallow: /private/

User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /
    `.trim();

    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
        html: `<html><head><title>Home</title></head><body><h1>Welcome</h1></body></html>`,
      } as any,
    ];

    const report = evaluateOnSiteAISearchReadiness(mockPages, { robotsTxtContent: robotsTxt });

    const oai = report.crawlerAccessibility.agents.find((a) => a.agentName === "OAI-SearchBot");
    expect(oai?.accessState).toBe("ALLOWED");

    const gpt = report.crawlerAccessibility.agents.find((a) => a.agentName === "GPTBot");
    expect(gpt?.accessState).toBe("BLOCKED");

    const perplexity = report.crawlerAccessibility.agents.find((a) => a.agentName === "PerplexityBot");
    expect(perplexity?.accessState).toBe("BLOCKED");

    // Check that blocking OAI-SearchBot or Perplexity creates finding
    const perplexityFinding = report.findings.find((f) => f.dimensionId === "TC_ROBOTS_PERPLEXITYBOT");
    expect(perplexityFinding).toBeDefined();
    expect(perplexityFinding?.severity).toBe("WARNING");
  });

  it("evaluates llms.txt non-penalty experimental advisory correctly", () => {
    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
        html: `<html><body><h1>Company</h1></body></html>`,
      } as any,
    ];

    const reportWithout = evaluateOnSiteAISearchReadiness(mockPages, { llmsTxtContent: null });
    expect(reportWithout.crawlerAccessibility.llmsTxt.present).toBe(false);
    // Non-scoring experimental notice: 0 impact score
    const llmsFinding = reportWithout.findings.find((f) => f.dimensionId === "TC_LLMS_TXT_VALIDITY");
    expect(llmsFinding?.severity).toBe("NOTICE");
    expect(llmsFinding?.isScoring).toBe(false);

    const reportWith = evaluateOnSiteAISearchReadiness(mockPages, {
      llmsTxtContent: "# Example\n> Clean docs\n- [API](https://example.com/docs)",
    });
    expect(reportWith.crawlerAccessibility.llmsTxt.present).toBe(true);
  });

  it("evaluates AEO Answer Readiness on question headings", () => {
    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/faq",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "article_blog", confidence: 1.0, signals: [] },
        html: `
          <html><body>
            <h2>What is Generative Engine Optimization?</h2>
            <p>Generative Engine Optimization (GEO) is the practice of optimizing digital content so that multi-modal artificial intelligence systems and generative answer engines can accurately cite, reference, and synthesize information from your web domain.</p>
          </body></html>
        `,
      } as any,
    ];

    const report = evaluateOnSiteAISearchReadiness(mockPages);
    expect(report.aeoEvaluations.length).toBe(1);
    expect(report.aeoEvaluations[0].hasDirectAnswer).toBe(true);
    expect(report.aeoEvaluations[0].isSelfContained).toBe(true);
    expect(report.scores.aeoReadiness.score).toBeGreaterThanOrEqual(50);
  });

  it("detects quantitative claims and attribution in GEO Evidence engine", () => {
    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/research",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "article_blog", confidence: 1.0, signals: [] },
        html: `
          <html><body>
            <p>According to our survey, over 78% of enterprise executives observed a 45% reduction in latency.</p>
            <p>In another test, productivity increased by 35% without any external link or citation anywhere.</p>
          </body></html>
        `,
        schemaJsonLd: [
          {
            "@type": "Article",
            headline: "AI Research",
            author: { "@type": "Person", name: "Dr. Jane Doe", jobTitle: "Chief AI Scientist" },
          },
        ],
      } as any,
    ];

    const report = evaluateOnSiteAISearchReadiness(mockPages);
    expect(report.geoEvaluations.length).toBe(1);
    expect(report.geoEvaluations[0].quantitativeClaimsCount).toBeGreaterThanOrEqual(2);
    expect(report.geoEvaluations[0].authorHasCredentials).toBe(true);
  });

  it("evaluates Entity Grounding and sameAs profiles", () => {
    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
        html: `<html><body><h1>Acme Inc</h1></body></html>`,
        schemaJsonLd: [
          {
            "@type": "Organization",
            name: "Acme Inc",
            url: "https://example.com",
            sameAs: [
              "https://www.wikidata.org/wiki/Q12345",
              "https://www.linkedin.com/company/acme-inc",
            ],
          },
        ],
      } as any,
    ];

    const report = evaluateOnSiteAISearchReadiness(mockPages);
    expect(report.entityEvaluations[0].hasOrganizationSchema).toBe(true);
    expect(report.entityEvaluations[0].orgSameAsCount).toBe(2);
    expect(report.scores.entityGrounding.score).toBeGreaterThanOrEqual(65);
  });

  it("provides transparent denominators across all 4 sub-scores", () => {
    const mockPages: CrawledPageData[] = [
      {
        url: "https://example.com/",
        statusCode: 200,
        resourceType: "html_page",
        isIndexable: true,
        classification: { primaryClass: "homepage", confidence: 1.0, signals: [] },
        html: `<html><body><h1>Homepage</h1></body></html>`,
      } as any,
    ];

    const report = evaluateOnSiteAISearchReadiness(mockPages);
    const { scores } = report;

    expect(scores.technicalAccessibility.evaluatedDimensions).toBeGreaterThanOrEqual(1);
    expect(scores.aeoReadiness.eligibleDimensions).toBeGreaterThanOrEqual(0);
    expect(scores.geoEvidenceReadiness.eligibleDimensions).toBeGreaterThanOrEqual(0);
    expect(scores.entityGrounding.evaluatedDimensions).toBeGreaterThanOrEqual(1);
  });
});
