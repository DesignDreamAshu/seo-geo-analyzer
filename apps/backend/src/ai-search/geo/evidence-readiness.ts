/**
 * Engine C: GEO / Source & Evidence Readiness Engine
 * Evaluates quantitative claim attribution, original first-party evidence,
 * author entity expertise proof, and document temporal freshness.
 */

import { nanoid } from "nanoid";
import type {
  GEOEvidenceEvaluation,
  AISearchFinding,
  AIObservabilityRecord,
} from "../types";
import type { CrawledPageData } from "../../crawler/types";
import * as cheerio from "cheerio";

const STATISTICAL_CLAIM_REGEX = /\b(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:%|percent|billion|million|trillion|growth|reduction|ROI|multiplier|x\b)/gi;
const ORIGINAL_DATA_KEYWORDS = [
  "our research",
  "our survey",
  "proprietary data",
  "case study",
  "methodology",
  "internal benchmark",
  "our analysis of",
  "client outcome",
];

export function evaluateGEOEvidenceReadiness(crawledPages: CrawledPageData[]): {
  evaluations: GEOEvidenceEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
} {
  const evaluations: GEOEvidenceEvaluation[] = [];
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];

  const eligibleEditorialPages = crawledPages.filter(
    (p) =>
      p.resourceType === "html_page" &&
      p.statusCode >= 200 &&
      p.statusCode < 400 &&
      p.isIndexable &&
      p.classification &&
      (p.classification.primaryClass === "article_blog" ||
        p.classification.primaryClass === "marketing_landing" ||
        p.classification.primaryClass === "homepage")
  );

  let totalQuantitativeClaims = 0;
  let totalAttributedClaims = 0;
  let totalOriginalDataPages = 0;
  let totalAuthorVerifiedPages = 0;

  for (const page of eligibleEditorialPages) {
    if (!page.html) continue;
    const $ = cheerio.load(page.html);

    let pageClaimsCount = 0;
    let pageAttributedCount = 0;
    const originalSignalTypes: string[] = [];

    // 1. Scan paragraphs for quantitative claims and citations
    $("p, li").each((_, elem) => {
      const text = $(elem).text().trim();
      const claimMatches = text.match(STATISTICAL_CLAIM_REGEX);

      if (claimMatches && claimMatches.length > 0) {
        pageClaimsCount += claimMatches.length;
        totalQuantitativeClaims += claimMatches.length;

        // Check if paragraph contains an outbound source link or citation
        const links = $("a", elem);
        const hasCitationLink = links.length > 0;
        const hasFootnote = /\[\d+\]|\(\d{4}\)/.test(text);

        if (hasCitationLink || hasFootnote) {
          pageAttributedCount += claimMatches.length;
          totalAttributedClaims += claimMatches.length;
        } else if (claimMatches.length >= 2 && text.length > 80) {
          // Unattributed multi-claim paragraph
          findings.push({
            id: `ai_finding_${nanoid(10)}`,
            dimensionId: "GR_CLAIM_ATTRIBUTION_RATE",
            pillar: "GEO",
            measurementClass: "DETERMINISTIC",
            evidenceLevel: "LEVEL_A",
            severity: "OPPORTUNITY",
            title: `Quantitative statistical claim lacks source citation or attribution`,
            description: `A statistical claim ('${claimMatches[0]}') is stated without an inline hyperlink, reference, or attribution. Generative AI citation engines prioritize claims with verifiable primary citations when synthesizing factual source passages.`,
            recommendation: `Add a citation hyperlink to the primary research study, survey, or internal benchmark supporting this statistic.`,
            confidenceScore: 0.85,
            impactScore: 3,
            isScoring: true,
            affectedUrl: page.url,
            evidence: {
              observed: `Unattributed statistical claim in paragraph: "${text.slice(0, 140)}..."`,
              codeSnippet: text.slice(0, 160),
            },
            remediationBlueprint: {
              objective: "Attribute quantitative claims to trusted primary or first-party sources.",
              actionSteps: [
                "Identify the primary dataset or source publication for the statistic.",
                "Insert an anchor link or footnote explicitly naming the source and publication year.",
              ],
              verificationMethod: "Verify anchor link or footnote presence within the same container element.",
            },
          });
        }
      }

      // Check original research / data signals
      const lowerText = text.toLowerCase();
      for (const kw of ORIGINAL_DATA_KEYWORDS) {
        if (lowerText.includes(kw) && !originalSignalTypes.includes(kw)) {
          originalSignalTypes.push(kw);
        }
      }
    });

    if (originalSignalTypes.length > 0) totalOriginalDataPages++;

    // 2. Author Entity Expertise Linkage (articles)
    const isArticle = page.classification.primaryClass === "article_blog";
    let authorEntityDeclared = false;
    let authorHasCredentials = false;

    if (isArticle) {
      const articleSchemas = page.schemaJsonLd?.filter(
        (b) => b["@type"] === "Article" || b["@type"] === "BlogPosting" || b["@type"] === "NewsArticle"
      );
      if (articleSchemas && articleSchemas.length > 0) {
        for (const schema of articleSchemas) {
          const author = (schema as Record<string, any>).author;
          if (author) {
            authorEntityDeclared = true;
            if (typeof author === "object" && (author.jobTitle || author.sameAs || author.description)) {
              authorHasCredentials = true;
              totalAuthorVerifiedPages++;
            }
          }
        }
      }

      if (!authorEntityDeclared) {
        findings.push({
          id: `ai_finding_${nanoid(10)}`,
          dimensionId: "GR_AUTHOR_EXPERTISE_PROOF",
          pillar: "GEO",
          measurementClass: "DETERMINISTIC",
          evidenceLevel: "LEVEL_A",
          severity: "OPPORTUNITY",
          title: `Article lacks explicit author Person schema credentials`,
          description: `This article does not connect the author to an explicit Person schema entity with role credentials or sameAs references. AI citation models cross-reference verified author expertise when weighting generative answers.`,
          recommendation: `Add structured 'author': {'@type': 'Person', 'name': '...', 'jobTitle': '...', 'sameAs': ['...']} inside Article JSON-LD schema.`,
          confidenceScore: 0.9,
          impactScore: 3,
          isScoring: true,
          affectedUrl: page.url,
          evidence: {
            observed: "Article JSON-LD schema missing structured author Person entity.",
          },
          remediationBlueprint: {
            objective: "Link article author to explicit Person entity schema.",
            actionSteps: [
              "Include author name, job title, and official LinkedIn or bio URL in Article schema.",
            ],
            verificationMethod: "Validate JSON-LD Article.author entity properties.",
          },
        });
      }
    }

    // 3. Temporal Freshness
    let datePublished: string | null = null;
    let dateModified: string | null = null;
    if (page.schemaJsonLd) {
      for (const s of page.schemaJsonLd) {
        const block = s as Record<string, any>;
        if (block.datePublished) datePublished = String(block.datePublished);
        if (block.dateModified) dateModified = String(block.dateModified);
      }
    }

    const hasModifiedFreshnessDate = Boolean(dateModified);

    evaluations.push({
      url: page.url,
      quantitativeClaimsCount: pageClaimsCount,
      attributedClaimsCount: pageAttributedCount,
      unattributedClaimsCount: pageClaimsCount - pageAttributedCount,
      hasOriginalDataSignals: originalSignalTypes.length > 0,
      originalDataSignalTypes: originalSignalTypes,
      authorEntityDeclared,
      authorHasCredentials,
      hasModifiedFreshnessDate,
      datePublished,
      dateModified,
      isEvergreen: !datePublished,
      isStale: false, // Baseline: not stale unless explicit time-decay verified
    });
  }

  // Observability Records
  observability.push({
    dimensionId: "GR_CLAIM_ATTRIBUTION_RATE",
    pillar: "GEO",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: Math.max(1, totalQuantitativeClaims),
    evaluatedCount: totalQuantitativeClaims,
    passedCount: totalAttributedClaims,
    failedCount: totalQuantitativeClaims - totalAttributedClaims,
    skippedCount: totalQuantitativeClaims === 0 ? 1 : 0,
    status: totalQuantitativeClaims === 0 ? "SKIPPED" : totalAttributedClaims > 0 ? "PASSED" : "FAILED",
  });

  observability.push({
    dimensionId: "GR_ORIGINAL_DATA_INDICATORS",
    pillar: "GEO",
    measurementClass: "HEURISTIC",
    evidenceLevel: "LEVEL_C",
    eligibleCount: Math.max(1, eligibleEditorialPages.length),
    evaluatedCount: eligibleEditorialPages.length,
    passedCount: totalOriginalDataPages,
    failedCount: eligibleEditorialPages.length - totalOriginalDataPages,
    skippedCount: 0,
    status: totalOriginalDataPages > 0 ? "PASSED" : "SKIPPED",
  });

  return {
    evaluations,
    findings,
    observability,
  };
}
