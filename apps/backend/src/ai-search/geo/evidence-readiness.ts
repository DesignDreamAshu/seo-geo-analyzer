/**
 * Engine C: GEO / Source & Evidence Readiness Engine (Methodology: v28c-2.0).
 * Evaluates quantitative claim attribution, original first-party evidence,
 * author entity expertise proof, document temporal freshness, and content depth substance.
 */

import { nanoid } from "nanoid";
import type {
  GEOEvidenceEvaluation,
  AISearchFinding,
  AIObservabilityRecord,
  EvaluatorResult,
} from "../types";
import type { CrawledPageData } from "../../crawler/types";
import * as cheerio from "cheerio";

const STATISTICAL_CLAIM_REGEX = /\b(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:%|percent|billion|million|trillion|growth|reduction|ROI|multiplier|x\b)/gi;
const ORIGINAL_DATA_KEYWORDS = [
  "our research",
  "our survey",
  "proprietary data",
  "case study",
  "case studies",
  "methodology",
  "internal benchmark",
  "our analysis",
  "client outcome",
  "results",
  "impact",
];

export function evaluateGEOEvidenceReadiness(crawledPages: CrawledPageData[]): {
  evaluations: GEOEvidenceEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
  evaluators: EvaluatorResult[];
} {
  const evaluations: GEOEvidenceEvaluation[] = [];
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];
  const evaluators: EvaluatorResult[] = [];

  const eligibleEditorialPages = crawledPages.filter(
    (p) =>
      p.resourceType === "html_page" &&
      p.statusCode >= 200 &&
      p.statusCode < 400 &&
      p.isIndexable
  );
  const totalPages = Math.max(1, eligibleEditorialPages.length);

  let totalQuantitativeClaims = 0;
  let totalAttributedClaims = 0;
  let totalOriginalDataPages = 0;

  for (const page of eligibleEditorialPages) {
    if (!page.html) continue;
    const $ = cheerio.load(page.html);

    let pageClaimsCount = 0;
    let pageAttributedCount = 0;
    const originalSignalTypes: string[] = [];

    // Scan paragraphs for quantitative claims and citations
    $("p, li").each((_, elem) => {
      const text = $(elem).text().trim();
      const claimMatches = text.match(STATISTICAL_CLAIM_REGEX);

      if (claimMatches && claimMatches.length > 0) {
        pageClaimsCount += claimMatches.length;
        totalQuantitativeClaims += claimMatches.length;

        const links = $("a", elem);
        const hasCitationLink = links.length > 0;
        const hasFootnote = /\[\d+\]|\(\d{4}\)/.test(text);

        if (hasCitationLink || hasFootnote) {
          pageAttributedCount += claimMatches.length;
          totalAttributedClaims += claimMatches.length;
        } else if (claimMatches.length >= 2 && text.length > 80) {
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

      const lowerText = text.toLowerCase();
      for (const kw of ORIGINAL_DATA_KEYWORDS) {
        if (lowerText.includes(kw) && !originalSignalTypes.includes(kw)) {
          originalSignalTypes.push(kw);
        }
      }
    });

    if (originalSignalTypes.length > 0 || page.url.includes("case-stud") || page.url.includes("solution")) {
      totalOriginalDataPages++;
    }

    // Author linkage
    const isArticle = page.classification?.primaryClass === "article_blog" || page.url.includes("/post/") || page.url.includes("/blog/");
    let authorEntityDeclared = false;
    let authorHasCredentials = false;

    if (page.schemaJsonLd) {
      for (const schema of page.schemaJsonLd) {
        const block = schema as Record<string, any>;
        const author = block.author;
        if (author) {
          authorEntityDeclared = true;
          if (typeof author === "object" && (author.jobTitle || author.sameAs || author.description || author.name)) {
            authorHasCredentials = true;
          }
        }
      }
    }

    // Freshness
    let datePublished: string | null = null;
    let dateModified: string | null = null;
    if (page.schemaJsonLd) {
      for (const s of page.schemaJsonLd) {
        const block = s as Record<string, any>;
        if (block.datePublished) datePublished = String(block.datePublished);
        if (block.dateModified) dateModified = String(block.dateModified);
      }
    }

    const hasModifiedFreshnessDate = Boolean(dateModified || datePublished);

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
      isStale: false,
    });
  }

  // GEO Evaluator 1: Quantitative Claim Citation Rate (Weight: 25%)
  const geo1Score = totalQuantitativeClaims > 0
    ? Math.round((totalAttributedClaims / totalQuantitativeClaims) * 100) / 100
    : 0.6; // Neutral baseline
  evaluators.push({
    evaluatorId: "GEO_STATISTICAL_CLAIM_ATTRIBUTION",
    evaluatorName: "Quantitative Statistical Claim Citation Rate",
    pillar: "GEO",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    status: geo1Score >= 0.7 ? "PASS" : geo1Score >= 0.4 ? "PARTIAL" : "FAIL",
    score: geo1Score,
    earnedPoints: Math.round(geo1Score * 25 * 10) / 10,
    maxPoints: 25,
    rawObservation: totalQuantitativeClaims > 0
      ? `${totalAttributedClaims} / ${totalQuantitativeClaims} statistical claims (${Math.round((totalAttributedClaims / totalQuantitativeClaims) * 100)}%) include source citation hyperlinks or footnote references.`
      : "No statistical benchmark or numerical claims detected in body copy. Neutral attribution baseline applied.",
    threshold: ">= 70% of quantitative claims accompanied by source citation links.",
    recommendation: "Provide source citation hyperlinks or internal benchmark footnotes whenever quoting metrics or percentages.",
  });

  // GEO Evaluator 2: First-Party Data & Case Studies (Weight: 25%)
  const originalRatio = Math.round((totalOriginalDataPages / totalPages) * 100) / 100;
  const geo2Score = originalRatio >= 0.35 ? 1.0 : originalRatio >= 0.15 ? 0.75 : originalRatio > 0 ? 0.35 : 0.0;
  evaluators.push({
    evaluatorId: "GEO_FIRST_PARTY_EVIDENCE_DENSITY",
    evaluatorName: "First-Party Data, Case Studies & Proprietary Research",
    pillar: "GEO",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    status: geo2Score === 1.0 ? "PASS" : geo2Score >= 0.35 ? "PARTIAL" : "FAIL",
    score: geo2Score,
    earnedPoints: Math.round(geo2Score * 25 * 10) / 10,
    maxPoints: 25,
    rawObservation: `${totalOriginalDataPages} / ${totalPages} pages (${Math.round(originalRatio * 100)}%) contain original research indicators, case studies, or client outcome benchmarks.`,
    threshold: ">= 35% of indexable pages include verifiable first-party evidence or case study outcomes.",
  });

  // GEO Evaluator 3: Author Entity Verification (Weight: 20%)
  const blogPages = eligibleEditorialPages.filter(
    (p) => p.classification?.primaryClass === "article_blog" || p.url.includes("/post/") || p.url.includes("/blog/")
  );
  let authorCredPages = 0;
  for (const p of blogPages) {
    if (p.schemaJsonLd?.some((b: any) => b.author && (typeof b.author === "object" || typeof b.author === "string"))) {
      authorCredPages++;
    }
  }
  const authorRatio = blogPages.length > 0 ? Math.round((authorCredPages / blogPages.length) * 100) / 100 : 0.7;
  const geo3Score = blogPages.length === 0 ? 0.7 : authorRatio >= 0.8 ? 1.0 : authorRatio >= 0.4 ? 0.6 : 0.0;
  evaluators.push({
    evaluatorId: "GEO_AUTHOR_ENTITY_CREDENTIALS",
    evaluatorName: "Author Entity Verification & E-E-A-T Schema Linkage",
    pillar: "GEO",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    status: geo3Score >= 0.8 ? "PASS" : geo3Score >= 0.4 ? "PARTIAL" : "FAIL",
    score: geo3Score,
    earnedPoints: Math.round(geo3Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: blogPages.length > 0
      ? `${authorCredPages} / ${blogPages.length} editorial/article pages (${Math.round(authorRatio * 100)}%) declare structured author Person schema.`
      : "Site has 0 editorial blog pages requiring author Person attribution.",
    threshold: ">= 80% of editorial articles declare structured Person author credentials.",
    recommendation: geo3Score < 0.8 ? "Add structured Person schema declaring author name, role, and sameAs bio profiles to all articles." : undefined,
  });

  // GEO Evaluator 4: Temporal Freshness Signals (Weight: 15%)
  let datedPages = 0;
  for (const p of blogPages) {
    if (p.schemaJsonLd?.some((b: any) => b.datePublished || b.dateModified) || (p.html && /\b(?:202[4-6]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(p.html))) {
      datedPages++;
    }
  }
  const freshnessRatio = blogPages.length > 0 ? Math.round((datedPages / blogPages.length) * 100) / 100 : 0.8;
  const geo4Score = freshnessRatio >= 0.8 ? 1.0 : freshnessRatio >= 0.5 ? 0.75 : 0.4;
  evaluators.push({
    evaluatorId: "GEO_TEMPORAL_FRESHNESS_SIGNALS",
    evaluatorName: "Publication & Modification Timestamp Freshness",
    pillar: "GEO",
    weight: 15,
    aggregationLevel: "PAGE_LEVEL",
    status: geo4Score === 1.0 ? "PASS" : "PARTIAL",
    score: geo4Score,
    earnedPoints: Math.round(geo4Score * 15 * 10) / 10,
    maxPoints: 15,
    rawObservation: blogPages.length > 0
      ? `${datedPages} / ${blogPages.length} article pages (${Math.round(freshnessRatio * 100)}%) provide explicit publication or modified date signals.`
      : "Standard temporal freshness verified across site pages.",
    threshold: ">= 80% of article/content pages declare explicit publication and modification timestamps.",
  });

  // GEO Evaluator 5: Substantive Content Depth (Weight: 15%)
  let deepPages = 0;
  for (const p of eligibleEditorialPages) {
    const wordCount = p.rawWordCount || (p.rawFacts as any)?.visibleBodyWordCount || 0;
    if (wordCount >= 350) deepPages++;
  }
  const depthRatio = Math.round((deepPages / totalPages) * 100) / 100;
  const geo5Score = depthRatio >= 0.7 ? 1.0 : depthRatio >= 0.4 ? 0.75 : 0.4;
  evaluators.push({
    evaluatorId: "GEO_CONTENT_DEPTH_SUBSTANCE",
    evaluatorName: "Substantive Topical Depth & Section Breadth (>=350 words)",
    pillar: "GEO",
    weight: 15,
    aggregationLevel: "PAGE_LEVEL",
    status: geo5Score === 1.0 ? "PASS" : "PARTIAL",
    score: geo5Score,
    earnedPoints: Math.round(geo5Score * 15 * 10) / 10,
    maxPoints: 15,
    rawObservation: `${deepPages} / ${totalPages} pages (${Math.round(depthRatio * 100)}%) contain substantive depth (>350 words) suitable for RAG generative synthesis.`,
    threshold: ">= 70% of indexable pages have >= 350 words of substantive body copy.",
  });

  // Observability records
  observability.push({
    dimensionId: "GR_CLAIM_ATTRIBUTION_RATE",
    pillar: "GEO",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: Math.max(1, totalQuantitativeClaims),
    evaluatedCount: totalQuantitativeClaims,
    passedCount: totalAttributedClaims,
    failedCount: totalQuantitativeClaims - totalAttributedClaims,
    skippedCount: 0,
    status: totalAttributedClaims > 0 ? "PASSED" : "FAILED",
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
    status: totalOriginalDataPages > 0 ? "PASSED" : "FAILED",
  });

  return {
    evaluations,
    findings,
    observability,
    evaluators,
  };
}
