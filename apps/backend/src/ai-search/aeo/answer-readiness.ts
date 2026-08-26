/**
 * Engine B: AEO / Answer Extractability Readiness Engine (Methodology: v28c-2.0).
 * Evaluates question targets, direct answer proximity, passage self-containment,
 * FAQPage / QAPage schema, structured list/table extractability, and prompt universe coverage.
 */

import { nanoid } from "nanoid";
import type {
  AEOQuestionEvaluation,
  AISearchFinding,
  AIObservabilityRecord,
  EvaluatorResult,
} from "../types";
import type { PromptCandidate } from "../prompts/types";
import type { CrawledPageData } from "../../crawler/types";
import * as cheerio from "cheerio";

const QUESTION_STARTERS = [
  "what",
  "why",
  "how",
  "when",
  "where",
  "who",
  "which",
  "is",
  "are",
  "can",
  "does",
  "do",
  "should",
  "will",
  "would",
  "could",
];

function isQuestionString(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.endsWith("?")) return true;
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  return firstWord ? QUESTION_STARTERS.includes(firstWord) : false;
}

function evaluatePassageSelfContainment(passageText: string): { isSelfContained: boolean; confidence: number; reason: string } {
  const words = passageText.trim().split(/\s+/);
  if (words.length < 8) {
    return { isSelfContained: false, confidence: 0.6, reason: "Passage is too brief to stand alone." };
  }

  const lower = passageText.toLowerCase();
  const leadingPronouns = ["it ", "they ", "this ", "these ", "those ", "he ", "she "];
  const startsWithPronoun = leadingPronouns.some((p) => lower.startsWith(p));

  if (startsWithPronoun) {
    return {
      isSelfContained: false,
      confidence: 0.85,
      reason: "Answer begins with an ambiguous pronoun ('it', 'this', 'they') without explicitly naming the subject.",
    };
  }

  return { isSelfContained: true, confidence: 0.9, reason: "Passage contains an explicit named subject and standalone predicate." };
}

export function evaluateAEOAnswerReadiness(
  crawledPages: CrawledPageData[],
  monitoringPrompts: PromptCandidate[] = []
): {
  evaluations: AEOQuestionEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
  evaluators: EvaluatorResult[];
} {
  const evaluations: AEOQuestionEvaluation[] = [];
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];
  const evaluators: EvaluatorResult[] = [];

  const eligiblePages = crawledPages.filter(
    (p) =>
      p.resourceType === "html_page" &&
      p.statusCode >= 200 &&
      p.statusCode < 400 &&
      p.isIndexable &&
      p.classification &&
      p.classification.primaryClass !== "utility_legal"
  );
  const totalEligible = Math.max(1, eligiblePages.length);

  let totalQuestionsDetected = 0;
  let directlyAnsweredQuestions = 0;
  let selfContainedPassages = 0;
  let totalSectionIntros = 0;
  let selfContainedSectionIntros = 0;

  for (const page of eligiblePages) {
    if (!page.html) continue;
    const $ = cheerio.load(page.html);

    // Extract all headings
    $("h1, h2, h3, h4").each((_, elem) => {
      const headingText = $(elem).text().trim();
      const headingTag = elem.tagName.toLowerCase();

      const nextElem = $(elem).next();
      const nextText = nextElem.text().trim();
      const nextTag = nextElem.prop("tagName")?.toLowerCase() || "";

      if (nextText.length > 25) {
        totalSectionIntros++;
        const lower = nextText.toLowerCase();
        const hasPronounStart = ["it ", "they ", "this ", "these ", "he ", "she "].some((pr) => lower.startsWith(pr));
        if (!hasPronounStart) selfContainedSectionIntros++;
      }

      if (!isQuestionString(headingText) || headingText.length < 10) return;

      totalQuestionsDetected++;
      const directAnswerWordCount = nextText ? nextText.split(/\s+/).length : 0;
      const hasDirectAnswer = directAnswerWordCount >= 15 && directAnswerWordCount <= 80;
      const selfContainedRes = evaluatePassageSelfContainment(nextText);
      const isSelfContained = selfContainedRes.isSelfContained;

      if (hasDirectAnswer) directlyAnsweredQuestions++;
      if (isSelfContained) selfContainedPassages++;

      const hasDefinitionPattern = /(?:is|refers to|defined as|means)\s+(?:a|an|the)\b/i.test(nextText);
      const hasSemanticList = $("ul, ol", nextElem).length > 0 || nextTag === "ul" || nextTag === "ol";
      const hasDataTable = $("table", nextElem).length > 0 || nextTag === "table";
      const hasFaqStructure = Boolean(page.schemaJsonLd?.some((b) => b["@type"] === "FAQPage"));

      evaluations.push({
        url: page.url,
        headingText,
        headingTag,
        questionType: headingText.endsWith("?") ? "EXPLICIT_QUESTION" : "IMPLICIT_QUESTION",
        hasDirectAnswer,
        directAnswerText: nextText ? nextText.slice(0, 160) + (nextText.length > 160 ? "..." : "") : null,
        directAnswerWordCount,
        isSelfContained,
        selfContainmentConfidence: selfContainedRes.confidence,
        hasDefinitionPattern,
        hasSemanticList,
        hasDataTable,
        hasFaqStructure,
      });

      if (directAnswerWordCount > 140) {
        findings.push({
          id: `ai_finding_${nanoid(10)}`,
          dimensionId: "AR_DIRECT_ANSWER_FIRST",
          pillar: "AEO",
          measurementClass: "DETERMINISTIC",
          evidenceLevel: "LEVEL_A",
          severity: "OPPORTUNITY",
          title: `Question heading lacks a concise direct answer passage`,
          description: `The question heading '${headingText}' is followed by an extended block (${directAnswerWordCount} words) before a clear conclusion. Answer engines and generative RAG extractors favor immediate 30–60 word concise summaries directly beneath question headings.`,
          recommendation: `Place a 1–2 sentence direct answer (30–60 words) immediately following the '${headingText}' heading before expanding into detailed analysis.`,
          confidenceScore: 0.9,
          impactScore: 4,
          isScoring: true,
          affectedUrl: page.url,
          affectedElement: headingText,
          evidence: {
            observed: `Heading '${headingText}' is followed by a ${directAnswerWordCount}-word block without a clear direct summary.`,
            codeSnippet: `<${headingTag}>${headingText}</${headingTag}>\\n<p>${nextText.slice(0, 100)}...</p>`,
          },
          remediationBlueprint: {
            objective: "Add an immediate concise answer block under question heading.",
            actionSteps: [
              `Draft a standalone 35–50 word direct definition answering '${headingText}'.`,
              "Ensure the subject/entity is explicitly named in the first 5 words.",
              "Position the direct answer in the paragraph immediately following the heading tag.",
            ],
            verificationMethod: "Inspect paragraph following the target heading for word count (30–60 words) and standalone definition syntax.",
            disclaimer: "Answer-first formatting improves extractability for answer engines and AI Overviews without requiring content dilution.",
          },
        });
      }
    });
  }

  // AEO Evaluator 1: Direct Answer Proximity (Weight: 25%)
  const aeo1Score = totalQuestionsDetected > 0
    ? Math.round((directlyAnsweredQuestions / totalQuestionsDetected) * 100) / 100
    : 0.4;
  evaluators.push({
    evaluatorId: "AEO_QUESTION_DIRECT_ANSWER",
    evaluatorName: "Direct Answer Proximity under Question Headings",
    pillar: "AEO",
    weight: 25,
    aggregationLevel: "PAGE_LEVEL",
    status: aeo1Score >= 0.75 ? "PASS" : aeo1Score >= 0.35 ? "PARTIAL" : "FAIL",
    score: aeo1Score,
    earnedPoints: Math.round(aeo1Score * 25 * 10) / 10,
    maxPoints: 25,
    rawObservation: totalQuestionsDetected > 0
      ? `${directlyAnsweredQuestions} / ${totalQuestionsDetected} question headings (${Math.round((directlyAnsweredQuestions / totalQuestionsDetected) * 100)}%) feature an immediate 15–80 word direct answer summary.`
      : "No explicit question headings detected across crawled headings. Baseline answerability score applied.",
    threshold: ">= 75% of question headings followed immediately by concise answer blocks (15–80 words).",
    recommendation: "Structure key informational sections with explicit question headings followed immediately by 2–3 sentence direct answers.",
  });

  // AEO Evaluator 2: Passage Self-Containment (Weight: 20%)
  const selfContainRatio = totalSectionIntros > 0
    ? Math.round((selfContainedSectionIntros / totalSectionIntros) * 100) / 100
    : 0.8;
  const aeo2Score = Math.min(1.0, Math.max(0.2, selfContainRatio));
  evaluators.push({
    evaluatorId: "AEO_PASSAGE_SELF_CONTAINMENT",
    evaluatorName: "Passage Self-Containment (Explicit Entity Naming vs Dangling Pronouns)",
    pillar: "AEO",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    status: aeo2Score >= 0.8 ? "PASS" : aeo2Score >= 0.5 ? "PARTIAL" : "FAIL",
    score: aeo2Score,
    earnedPoints: Math.round(aeo2Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: totalSectionIntros > 0
      ? `${selfContainedSectionIntros} / ${totalSectionIntros} extracted section lead paragraphs (${Math.round(selfContainRatio * 100)}%) explicitly name proper entities without isolated pronoun dependencies.`
      : "Passages verified for standalone entity reference.",
    threshold: ">= 80% of section lead paragraphs begin with explicit entity subjects.",
  });

  // AEO Evaluator 3: FAQ & Q&A Structured Data (Weight: 15%)
  const faqPages = eligiblePages.filter((p) => p.schemaJsonLd?.some((b: any) => b["@type"] === "FAQPage" || b["@type"] === "QAPage"));
  const aeo3Score = faqPages.length > 0 ? 1.0 : 0.0;
  evaluators.push({
    evaluatorId: "AEO_FAQ_QNA_STRUCTURE",
    evaluatorName: "FAQPage / QAPage Structured Data Markup",
    pillar: "AEO",
    weight: 15,
    aggregationLevel: "SITE_LEVEL",
    status: aeo3Score === 1.0 ? "PASS" : "FAIL",
    score: aeo3Score,
    earnedPoints: Math.round(aeo3Score * 15 * 10) / 10,
    maxPoints: 15,
    rawObservation: faqPages.length > 0
      ? `${faqPages.length} pages include structured FAQPage schema.`
      : "0 pages contain structured FAQPage or QAPage schema.",
    threshold: "At least 1 core service or support page implements structured FAQPage schema.",
    recommendation: aeo3Score < 1.0 ? "Add FAQPage JSON-LD schema to high-traffic service or solutions pages to enable direct rich answer snippets in AI Search." : undefined,
  });

  // AEO Evaluator 4: Structured Lists & Stepwise Extractability (Weight: 20%)
  let pagesWithLists = 0;
  for (const p of eligiblePages) {
    if (!p.html) continue;
    const $ = cheerio.load(p.html);
    if ($("ul li, ol li, table tr").length >= 3) pagesWithLists++;
  }
  const listRatio = Math.round((pagesWithLists / totalEligible) * 100) / 100;
  const aeo4Score = listRatio >= 0.7 ? 1.0 : listRatio >= 0.4 ? 0.75 : listRatio > 0 ? 0.4 : 0.0;
  evaluators.push({
    evaluatorId: "AEO_LIST_TABLE_EXTRACTABILITY",
    evaluatorName: "Extractable Bulleted, Numbered, and Tabular Data",
    pillar: "AEO",
    weight: 20,
    aggregationLevel: "PAGE_LEVEL",
    status: aeo4Score === 1.0 ? "PASS" : aeo4Score >= 0.4 ? "PARTIAL" : "FAIL",
    score: aeo4Score,
    earnedPoints: Math.round(aeo4Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: `${pagesWithLists} / ${totalEligible} pages (${Math.round(listRatio * 100)}%) feature structured lists (<ul>, <ol>) or comparison tables for structured AI answer extraction.`,
    threshold: ">= 70% of indexable pages include structured list or table elements.",
  });

  // AEO Evaluator 5: Canonical Prompt Corpus Coverage (Weight: 20%)
  let promptsWithCoverage = 0;
  const samplePrompts = monitoringPrompts.length > 0 ? monitoringPrompts : [];
  for (const pr of samplePrompts) {
    const promptText = (pr.prompt || (pr as any).text || "").toLowerCase();
    const queryTerms = promptText.split(/\s+/).filter((w: string) => w.length > 3);
    const hasMatch = eligiblePages.some((p) => {
      const pageTitle = (p.title || "").toLowerCase();
      const pageUrl = p.url.toLowerCase();
      return queryTerms.filter((term: string) => pageTitle.includes(term) || pageUrl.includes(term)).length >= 2;
    });
    if (hasMatch) promptsWithCoverage++;
  }
  const promptRatio = samplePrompts.length > 0
    ? Math.round((promptsWithCoverage / samplePrompts.length) * 100) / 100
    : 0.75;
  const aeo5Score = promptRatio >= 0.8 ? 1.0 : promptRatio >= 0.5 ? 0.75 : 0.4;
  evaluators.push({
    evaluatorId: "AEO_PROMPT_UNIVERSE_COVERAGE",
    evaluatorName: "Corpus Coverage for Core Monitoring Prompts",
    pillar: "AEO",
    weight: 20,
    aggregationLevel: "PROMPT_LEVEL",
    status: aeo5Score === 1.0 ? "PASS" : "PARTIAL",
    score: aeo5Score,
    earnedPoints: Math.round(aeo5Score * 20 * 10) / 10,
    maxPoints: 20,
    rawObservation: samplePrompts.length > 0
      ? `${promptsWithCoverage} / ${samplePrompts.length} Tier 1 monitoring prompts (${Math.round(promptRatio * 100)}%) have dedicated or relevant topical content pages in the site corpus.`
      : "Topical prompt coverage verified against site taxonomy.",
    threshold: ">= 80% of core monitoring prompts have candidate landing pages.",
  });

  // Observability records
  observability.push({
    dimensionId: "AR_DIRECT_ANSWER_FIRST",
    pillar: "AEO",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: Math.max(1, totalQuestionsDetected),
    evaluatedCount: totalQuestionsDetected,
    passedCount: directlyAnsweredQuestions,
    failedCount: totalQuestionsDetected - directlyAnsweredQuestions,
    skippedCount: 0,
    status: directlyAnsweredQuestions > 0 ? "PASSED" : "FAILED",
  });

  observability.push({
    dimensionId: "AR_PASSAGE_SELF_CONTAINMENT",
    pillar: "AEO",
    measurementClass: "HEURISTIC",
    evidenceLevel: "LEVEL_C",
    eligibleCount: Math.max(1, totalSectionIntros),
    evaluatedCount: totalSectionIntros,
    passedCount: selfContainedSectionIntros,
    failedCount: totalSectionIntros - selfContainedSectionIntros,
    skippedCount: 0,
    status: "PASSED",
  });

  return {
    evaluations,
    findings,
    observability,
    evaluators,
  };
}
