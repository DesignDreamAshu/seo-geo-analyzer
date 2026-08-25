/**
 * Content Extractability and Structural Semantic Analyzer.
 * Evaluates semantic document containers, table/list markup, and raw vs rendered content parity.
 */

import * as cheerio from "cheerio";
import { CrawledPageData } from "../types";

export interface ExtractabilityResult {
  hasSemanticMain: boolean;
  hasSemanticArticle: boolean;
  hasClearH1: boolean;
  headingsOutlineValid: boolean;
  structuredElements: {
    tablesCount: number;
    listsCount: number;
    definitionListsCount: number;
  };
  rawHtmlPrimaryContentPresent: boolean;
  averageParagraphWordCount: number;
  longUndifferentiatedTextBlocks: number;
  contentExtractionConfidence: "high" | "moderate" | "low";
  notes: string[];
}

export function evaluateContentExtractability(page: CrawledPageData): ExtractabilityResult {
  const $ = cheerio.load(page.html || "");
  const notes: string[] = [];

  const hasSemanticMain = $("main").length > 0;
  const hasSemanticArticle = $("article").length > 0;
  const hasClearH1 = (page.rawFacts?.h1Count || 0) === 1;
  const headingsOutlineValid = page.headingsHierarchyValid ?? true;

  const tablesCount = $("table").length;
  const listsCount = $("ul, ol").length;
  const definitionListsCount = $("dl").length;

  // Evaluate paragraph word counts in primary content
  const paragraphs = $("main p, article p, body p");
  let totalWords = 0;
  let validParagraphs = 0;
  let longUndifferentiatedTextBlocks = 0;

  paragraphs.each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) {
      const words = text.split(/\s+/).length;
      totalWords += words;
      validParagraphs++;
      if (words > 250) {
        longUndifferentiatedTextBlocks++;
      }
    }
  });

  const averageParagraphWordCount = validParagraphs > 0 ? Math.round(totalWords / validParagraphs) : 0;

  // Evaluate raw HTML vs rendered DOM availability
  let rawHtmlPrimaryContentPresent = true;
  const rawWordCount = page.rawFacts?.rawDocumentWordCount || page.wordCount || 0;
  if (rawWordCount < 50 && page.renderedFacts?.attempted && page.classification.primaryClass !== "form_application" && page.classification.primaryClass !== "utility_legal") {
    rawHtmlPrimaryContentPresent = false;
    notes.push("Primary body content is sparse in raw HTML and may depend heavily on client-side JavaScript rendering.");
  }

  if (!hasSemanticMain && !hasSemanticArticle) {
    notes.push("Document lacks semantic <main> or <article> container, relying on generic <div> wrappers.");
  }

  let contentExtractionConfidence: "high" | "moderate" | "low" = "high";
  if (!rawHtmlPrimaryContentPresent) {
    contentExtractionConfidence = "low";
  } else if (!hasSemanticMain && !hasClearH1) {
    contentExtractionConfidence = "moderate";
  }

  return {
    hasSemanticMain,
    hasSemanticArticle,
    hasClearH1,
    headingsOutlineValid,
    structuredElements: {
      tablesCount,
      listsCount,
      definitionListsCount,
    },
    rawHtmlPrimaryContentPresent,
    averageParagraphWordCount,
    longUndifferentiatedTextBlocks,
    contentExtractionConfidence,
    notes,
  };
}
