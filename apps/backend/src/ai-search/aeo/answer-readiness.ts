/**
 * Engine B: AEO / Answer Extractability Readiness Engine
 * Evaluates question targets, direct answer proximity, passage self-containment,
 * definition clarity, semantic list formatting, and FAQ extractability.
 */

import { nanoid } from "nanoid";
import type {
  AEOQuestionEvaluation,
  AISearchFinding,
  AIObservabilityRecord,
} from "../types";
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

export function evaluateAEOAnswerReadiness(crawledPages: CrawledPageData[]): {
  evaluations: AEOQuestionEvaluation[];
  findings: AISearchFinding[];
  observability: AIObservabilityRecord[];
} {
  const evaluations: AEOQuestionEvaluation[] = [];
  const findings: AISearchFinding[] = [];
  const observability: AIObservabilityRecord[] = [];

  const eligiblePages = crawledPages.filter(
    (p) =>
      p.resourceType === "html_page" &&
      p.statusCode >= 200 &&
      p.statusCode < 400 &&
      p.isIndexable &&
      p.classification &&
      p.classification.primaryClass !== "utility_legal"
  );

  let totalQuestionsDetected = 0;
  let directlyAnsweredQuestions = 0;
  let selfContainedPassages = 0;

  for (const page of eligiblePages) {
    if (!page.html) continue;
    const $ = cheerio.load(page.html);

    // Extract all headings
    $("h1, h2, h3, h4").each((_, elem) => {
      const headingText = $(elem).text().trim();
      const headingTag = elem.tagName.toLowerCase();

      if (!isQuestionString(headingText) || headingText.length < 10) return;

      totalQuestionsDetected++;
      const nextElem = $(elem).next();
      const nextText = nextElem.text().trim();
      const nextTag = nextElem.prop("tagName")?.toLowerCase() || "";

      const directAnswerWordCount = nextText ? nextText.split(/\s+/).length : 0;
      const hasDirectAnswer = directAnswerWordCount >= 10 && directAnswerWordCount <= 90;
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

      // Finding: Question heading with long meandering intro instead of concise answer
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

      // Finding: Pronoun ambiguity at start of answer passage
      if (!isSelfContained && directAnswerWordCount >= 10 && directAnswerWordCount <= 120) {
        findings.push({
          id: `ai_finding_${nanoid(10)}`,
          dimensionId: "AR_PASSAGE_SELF_CONTAINMENT",
          pillar: "AEO",
          measurementClass: "HEURISTIC",
          evidenceLevel: "LEVEL_C",
          severity: "OPPORTUNITY",
          title: `Answer passage has pronoun dependency ('${nextText.split(" ")[0]}')`,
          description: `The passage under '${headingText}' begins with a relative pronoun without restating the subject. RAG vector search extractors frequently retrieve isolated passages where pronoun references lose contextual meaning.`,
          recommendation: `Replace leading pronouns ('It', 'This', 'They') with the explicit entity name (e.g. 'ServiceNow ITOM is...').`,
          confidenceScore: selfContainedRes.confidence,
          impactScore: 2,
          isScoring: true,
          affectedUrl: page.url,
          affectedElement: headingText,
          evidence: {
            observed: selfContainedRes.reason,
            codeSnippet: nextText.slice(0, 120),
          },
          remediationBlueprint: {
            objective: "Ensure answer passage is self-contained without pronoun ambiguity.",
            actionSteps: [
              "Replace leading pronouns with the exact proper noun or product name.",
              "Verify the first sentence makes complete sense when read in isolation.",
            ],
            verificationMethod: "Inspect the first sentence under heading for explicit entity presence.",
          },
        });
      }
    });
  }

  // Observability Records
  observability.push({
    dimensionId: "AR_DIRECT_ANSWER_FIRST",
    pillar: "AEO",
    measurementClass: "DETERMINISTIC",
    evidenceLevel: "LEVEL_A",
    eligibleCount: Math.max(1, totalQuestionsDetected),
    evaluatedCount: totalQuestionsDetected,
    passedCount: directlyAnsweredQuestions,
    failedCount: totalQuestionsDetected - directlyAnsweredQuestions,
    skippedCount: totalQuestionsDetected === 0 ? 1 : 0,
    status: totalQuestionsDetected === 0 ? "SKIPPED" : directlyAnsweredQuestions > 0 ? "PASSED" : "FAILED",
  });

  observability.push({
    dimensionId: "AR_PASSAGE_SELF_CONTAINMENT",
    pillar: "AEO",
    measurementClass: "HEURISTIC",
    evidenceLevel: "LEVEL_C",
    eligibleCount: Math.max(1, totalQuestionsDetected),
    evaluatedCount: totalQuestionsDetected,
    passedCount: selfContainedPassages,
    failedCount: totalQuestionsDetected - selfContainedPassages,
    skippedCount: totalQuestionsDetected === 0 ? 1 : 0,
    status: totalQuestionsDetected === 0 ? "SKIPPED" : "PASSED",
  });

  return {
    evaluations,
    findings,
    observability,
  };
}
